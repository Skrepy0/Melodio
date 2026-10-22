package com.skrepy.melodio.plugins;

import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/** Shared by the native player and foreground UI; background skips never depend on JS. */
final class NativeLyricsRepository {
    static final class Query {
        final String url, title, artist, album, source;
        final long duration;
        Query(String url, String title, String artist, String album, String source, long duration) {
            this.url = url; this.title = title; this.artist = artist; this.album = album;
            this.source = source; this.duration = duration;
        }
        String key() {
            return new JSONArray(Arrays.asList(title, artist, album, duration, source)).toString();
        }
    }
    private static final class Job {
        final CompletableFuture<LyricTimeline> future = new CompletableFuture<>();
        volatile boolean cancelled;
        volatile Call call;
        volatile Thread thread;
        void check() { if (cancelled || Thread.currentThread().isInterrupted()) throw new CancellationException(); }
        void cancel() {
            cancelled = true;
            if (call != null) call.cancel();
            if (thread != null) thread.interrupt();
            future.cancel(false);
        }
    }
    private final SharedPreferences cache;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(4, TimeUnit.SECONDS).readTimeout(4, TimeUnit.SECONDS).build();
    private final Map<String, Job> jobs = new HashMap<>();
    NativeLyricsRepository(SharedPreferences cache) { this.cache = cache; }

    synchronized CompletableFuture<LyricTimeline> load(Query query, boolean online, int retries, String endpoint) {
        String key = query.key() + online + retries + endpoint;
        Job existing = jobs.get(key);
        if (existing != null && !existing.cancelled) return existing.future;
        Job job = new Job();
        jobs.put(key, job);
        executor.submit(() -> {
            job.thread = Thread.currentThread();
            try {
                job.check();
                job.future.complete(resolve(query, online, Math.max(0, Math.min(10, retries)), endpoint, job));
            } catch (Exception error) {
                job.future.completeExceptionally(error);
            } finally {
                job.thread = null;
                Thread.interrupted();
                synchronized (this) { if (jobs.get(key) == job) jobs.remove(key); }
            }
        });
        return job.future;
    }

    synchronized void cancelExcept(Query query) {
        String prefix = query.key();
        List<Job> obsolete = new ArrayList<>();
        java.util.Iterator<Map.Entry<String, Job>> iterator = jobs.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Job> entry = iterator.next();
            if (!entry.getKey().startsWith(prefix)) { obsolete.add(entry.getValue()); iterator.remove(); }
        }
        for (Job job : obsolete) job.cancel();
    }

    synchronized void cancelAll() {
        // Completion handlers can re-enter; remove the jobs before completing them.
        List<Job> pending = new ArrayList<>(jobs.values());
        jobs.clear();
        for (Job job : pending) job.cancel();
    }
    void close() { cancelAll(); executor.shutdownNow(); }

    synchronized JSONArray listCache() {
        JSONArray result = new JSONArray();
        for (Map.Entry<String, ?> entry : cache.getAll().entrySet()) {
            if (!entry.getKey().startsWith("v2:") || !(entry.getValue() instanceof String)) continue;
            try {
                JSONArray identity = new JSONArray(entry.getKey().substring(3));
                LyricTimeline timeline = LyricTimeline.parse((String) entry.getValue());
                if (timeline.lines.isEmpty()) continue;
                JSONObject row = new JSONObject();
                row.put("id", entry.getKey());
                row.put("title", identity.optString(0));
                row.put("artist", identity.optString(1));
                row.put("album", identity.optString(2));
                row.put("duration", identity.optLong(3));
                row.put("lineCount", timeline.lines.size());
                result.put(row);
            } catch (Exception ignored) { }
        }
        return result;
    }
    synchronized String readCache(String id) {
        return id != null && id.startsWith("v2:") ? cache.getString(id, "") : "";
    }
    synchronized void deleteCache(String id) {
        if (id == null || !id.startsWith("v2:")) return;
        String prefix = id.substring(3);
        List<Job> obsolete = new ArrayList<>();
        java.util.Iterator<Map.Entry<String, Job>> iterator = jobs.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Job> entry = iterator.next();
            if (entry.getKey().startsWith(prefix)) { obsolete.add(entry.getValue()); iterator.remove(); }
        }
        for (Job job : obsolete) job.cancel();
        cache.edit().remove(id).apply();
    }
    synchronized void clearCache() {
        cancelAll();
        cache.edit().clear().apply();
    }

    private LyricTimeline resolve(Query query, boolean online, int retries, String endpoint, Job job) throws Exception {
        String raw = query.source;
        if (raw != null && !raw.trim().isEmpty()) {
            try {
                if (raw.matches("(?is)^https?://.*")) raw = get(raw.trim(), job, deadline(3000));
                LyricTimeline supplied = LyricTimeline.parse(raw);
                if (!supplied.lines.isEmpty()) return supplied;
            } catch (Exception error) { job.check(); if (!online) throw error; }
        }
        String cacheKey = "v2:" + query.key();
        LyricTimeline stored = LyricTimeline.parse(cache.getString(cacheKey, ""));
        if (!stored.lines.isEmpty()) return stored;
        if (!online || query.title.trim().isEmpty() || query.artist.trim().isEmpty()
                || Arrays.asList("未知艺术家", "unknown", "unknown artist", "<unknown>").contains(normalize(query.artist))) return LyricTimeline.EMPTY;
        Exception last = null;
        for (int attempt = 0; attempt <= retries; attempt++) {
            last = null;
            for (boolean meting : new boolean[]{true, false}) {
                job.check();
                try {
                    String text = meting ? meting(query, endpoint, job) : lrclib(query, job);
                    job.check();
                    LyricTimeline result = LyricTimeline.parse(text);
                    if (result.lines.isEmpty()) continue;
                    synchronized (this) {
                        job.check();
                        SharedPreferences.Editor edit = cache.edit();
                        Map<String, ?> entries = cache.getAll();
                        if (entries.size() >= 100 && !entries.containsKey(cacheKey)) edit.remove(entries.keySet().iterator().next());
                        edit.putString(cacheKey, text).apply();
                    }
                    return result;
                } catch (Exception error) { job.check(); last = error; }
            }
            if (attempt < retries) Thread.sleep(Math.min(1000L << attempt, 5000));
        }
        if (last != null) throw last;
        return LyricTimeline.EMPTY;
    }

    private String meting(Query query, String endpoint, Job job) throws Exception {
        long until = deadline(4000);
        HttpUrl base = HttpUrl.get(endpoint);
        if (!base.isHttps()) throw new IOException("Meting requires HTTPS");
        HttpUrl search = base.newBuilder().query(null).addQueryParameter("server", "netease")
                .addQueryParameter("type", "search").addQueryParameter("id", query.title.trim() + " " + query.artist.trim())
                .addQueryParameter("limit", "10").addQueryParameter("page", "1").build();
        JSONArray records = new JSONArray(get(search.toString(), job, until));
        int candidates = 0;
        for (int i = 0; i < records.length() && candidates < 2; i++) {
            JSONObject row = records.optJSONObject(i);
            if (row == null || !normalize(row.optString("name")).equals(normalize(query.title))
                    || !matchesArtist(row.optString("artist"), query.artist)) continue;
            if (row.has("duration") && query.duration > 0 && Math.abs(row.optDouble("duration", -1) * 1000 - query.duration) > 5000) continue;
            candidates++;
            HttpUrl url = base.resolve(row.optString("lrc"));
            if (url == null || !url.isHttps() || !url.host().equals(base.host()) || url.port() != base.port()
                    || !url.username().isEmpty() || !url.password().isEmpty()) continue;
            String text = get(url.toString(), job, until);
            if (!LyricTimeline.parse(text).lines.isEmpty()) return text;
        }
        return "";
    }

    private String lrclib(Query query, Job job) throws Exception {
        HttpUrl url = HttpUrl.get("https://lrclib.net/api/search").newBuilder()
                .addQueryParameter("track_name", query.title.trim()).addQueryParameter("artist_name", query.artist.trim()).build();
        JSONArray records = new JSONArray(get(url.toString(), job, deadline(4000)));
        String best = "";
        double bestScore = Double.NEGATIVE_INFINITY;
        for (int i = 0; i < records.length(); i++) {
            JSONObject row = records.optJSONObject(i);
            if (row == null || !normalize(row.optString("trackName")).equals(normalize(query.title))
                    || !matchesArtist(row.optString("artistName"), query.artist)) continue;
            double difference = Math.abs(row.optDouble("duration", -1) * 1000 - query.duration);
            if (query.duration > 0 && difference > 5000) continue;
            String text = row.optString("syncedLyrics", "");
            if (LyricTimeline.parse(text).lines.isEmpty()) continue;
            double score = (normalize(row.optString("albumName")).equals(normalize(query.album)) ? 100000 : 0) - difference;
            if (score > bestScore) { best = text; bestScore = score; }
        }
        return best;
    }

    private static long deadline(int milliseconds) { return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(milliseconds); }
    private String get(String url, Job job, long deadline) throws IOException {
        job.check();
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) throw new IOException("Lyrics request timed out");
        Call call = client.newCall(new Request.Builder().url(url).build());
        call.timeout().timeout(remaining, TimeUnit.NANOSECONDS);
        job.call = call;
        try {
            job.check();
            try (Response response = call.execute()) {
                if (!response.isSuccessful() || response.body() == null) throw new IOException("Lyrics HTTP " + response.code());
                if (!response.request().url().isHttps()) throw new IOException("Insecure lyrics redirect");
                try (InputStream stream = response.body().byteStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096];
                    int count;
                    while ((count = stream.read(buffer)) != -1) {
                        job.check();
                        if (bytes.size() + count > 1024 * 1024) throw new IOException("Lyrics response too large");
                        bytes.write(buffer, 0, count);
                    }
                    return bytes.toString(StandardCharsets.UTF_8.name());
                }
            }
        } finally { job.call = null; }
    }
    private static String normalize(String text) { return Normalizer.normalize(text.trim(), Normalizer.Form.NFKC).toLowerCase(Locale.ROOT); }
    private static boolean matchesArtist(String actual, String expected) {
        List<String> candidates = Arrays.asList(normalize(actual).split("\\s*[、,;/&()（）]+\\s*"));
        for (String artist : normalize(expected).split("\\s*[、,;/&()（）]+\\s*")) {
            if (!artist.isEmpty() && !candidates.contains(artist)) return false;
        }
        return true;
    }
}
