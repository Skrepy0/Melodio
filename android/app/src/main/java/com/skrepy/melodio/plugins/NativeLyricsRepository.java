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
            return new JSONArray(Arrays.asList(LyricCacheIdentity.normalize(title), LyricCacheIdentity.normalize(artist), duration)).toString();
        }
    }
    private static final class Job {
        final Query query;
        Job(Query query) { this.query = query; }
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
        Job job = new Job(query);
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

    private String recordKey(JSONObject row) {
        return "v3:" + new JSONArray(Arrays.asList(LyricCacheIdentity.normalize(row.optString("title")),
                LyricCacheIdentity.normalize(row.optString("artist")), row.optLong("duration", 0))).toString();
    }
    private JSONObject matchRecord(List<JSONObject> records, String title, String artist, long duration) {
        List<JSONObject> peers = new ArrayList<>();
        List<Long> durations = new ArrayList<>();
        for (JSONObject row : records) {
            if (LyricCacheIdentity.normalize(row.optString("title")).equals(LyricCacheIdentity.normalize(title))
                    && LyricCacheIdentity.normalize(row.optString("artist")).equals(LyricCacheIdentity.normalize(artist))) {
                peers.add(row); durations.add(row.optLong("duration", 0));
            }
        }
        int index = LyricCacheIdentity.findDuration(duration, durations);
        return index < 0 ? null : peers.get(index);
    }
    private void mergeRecord(List<JSONObject> records, JSONObject incoming, boolean preferIncoming) throws Exception {
        JSONObject existing = matchRecord(records, incoming.optString("title"), incoming.optString("artist"), incoming.optLong("duration", 0));
        if (existing == null) records.add(incoming);
        else if (incoming.optLong("cachedAt", 0) > existing.optLong("cachedAt", 0)
                || (preferIncoming && incoming.optLong("cachedAt", 0) == existing.optLong("cachedAt", 0))) {
            incoming.put("duration", existing.optLong("duration", 0));
            records.set(records.indexOf(existing), incoming);
        }
    }
    private void persistRecords(List<JSONObject> records, List<String> legacy) {
        SharedPreferences.Editor edit = cache.edit();
        for (String key : cache.getAll().keySet()) if (key.startsWith("v3:")) edit.remove(key);
        for (int i = Math.max(0, records.size() - 100); i < records.size(); i++) {
            JSONObject row = records.get(i);
            edit.putString(recordKey(row), row.toString());
        }
        // The replacement and legacy removal are one atomic preferences transaction.
        for (String key : legacy) edit.remove(key);
        if (!edit.commit()) throw new IllegalStateException("Cannot persist lyrics cache");
    }
    private synchronized List<JSONObject> records() {
        List<JSONObject> rows = new ArrayList<>();
        List<JSONObject> merged = new ArrayList<>();
        List<String> migrated = new ArrayList<>();
        for (Map.Entry<String, ?> entry : cache.getAll().entrySet()) {
            if (!(entry.getValue() instanceof String)) continue;
            try {
                JSONObject row;
                if (entry.getKey().startsWith("v3:")) row = new JSONObject((String) entry.getValue());
                else if (entry.getKey().startsWith("v2:")) {
                    JSONArray identity = new JSONArray(entry.getKey().substring(3));
                    row = new JSONObject();
                    row.put("title", identity.optString(0)); row.put("artist", identity.optString(1));
                    row.put("album", identity.optString(2)); row.put("duration", identity.optLong(3));
                    row.put("lyrics", entry.getValue()); row.put("cachedAt", 0); row.put("source", "unknown");

                } else continue;
                row.put("version", 3);
                if (!LyricTimeline.parse(row.optString("lyrics")).lines.isEmpty()) {
                    if (entry.getKey().startsWith("v3:")) merged.add(row);
                    else rows.add(row);
                    if (entry.getKey().startsWith("v2:")) migrated.add(entry.getKey());
                }
            } catch (Exception ignored) { }
        }
        rows.sort(java.util.Comparator.comparingLong((JSONObject row) -> row.optLong("duration", 0))
                .thenComparingLong(row -> row.optLong("cachedAt", 0)).thenComparing(row -> row.toString()));
        for (JSONObject row : rows) {
            try { mergeRecord(merged, row, false); } catch (Exception ignored) { }
        }
        if (!migrated.isEmpty()) persistRecords(merged, migrated);
        return merged;
    }
    synchronized void importCache(JSONArray entries) throws Exception {
        List<JSONObject> rows = records();
        for (int i = 0; i < entries.length(); i++) {
            JSONObject row = entries.optJSONObject(i);
            if (row == null || LyricTimeline.parse(row.optString("lyrics")).lines.isEmpty()) continue;
            row.put("version", 3);
            mergeRecord(rows, row, false); // Native wins legacy ties; newer timestamps win normally.
        }
        persistRecords(rows, java.util.Collections.emptyList());
    }
    synchronized JSONArray listCache() {
        JSONArray result = new JSONArray();
        for (JSONObject stored : records()) {
            try {
                JSONObject row = new JSONObject(stored.toString());
                row.put("id", recordKey(stored));
                row.put("lineCount", LyricTimeline.parse(row.optString("lyrics")).lines.size());
                row.remove("lyrics"); result.put(row);
            } catch (Exception ignored) { }
        }
        return result;
    }
    synchronized String readCache(String id) {
        for (JSONObject row : records()) if (recordKey(row).equals(id)) return row.optString("lyrics");
        return "";
    }
    synchronized void deleteCache(String id) {
        List<JSONObject> rows = records();
        JSONObject target = null;
        for (JSONObject row : rows) if (recordKey(row).equals(id)) target = row;
        if (target == null) return;
        JSONObject selected = target;
        List<Job> obsolete = new ArrayList<>();
        java.util.Iterator<Map.Entry<String, Job>> iterator = jobs.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Job> entry = iterator.next();
            Query query = entry.getValue().query;
            if (matchRecord(rows, query.title, query.artist, query.duration) == selected) {
                obsolete.add(entry.getValue()); iterator.remove();
            }
        }
        for (Job job : obsolete) job.cancel();
        rows.remove(target);
        persistRecords(rows, java.util.Collections.emptyList());
    }
    synchronized void clearCache() { cancelAll(); if (!cache.edit().clear().commit()) throw new IllegalStateException("Cannot clear lyrics cache"); }

    private LyricTimeline resolve(Query query, boolean online, int retries, String endpoint, Job job) throws Exception {
        String raw = query.source;
        if (raw != null && !raw.trim().isEmpty()) {
            try {
                if (raw.matches("(?is)^https?://.*")) raw = get(raw.trim(), job, deadline(3000));
                LyricTimeline supplied = LyricTimeline.parse(raw);
                if (!supplied.lines.isEmpty()) return supplied;
            } catch (Exception error) { job.check(); if (!online) throw error; }
        }
        LyricTimeline stored;
        synchronized (this) {
            JSONObject found = matchRecord(records(), query.title, query.artist, query.duration);
            stored = LyricTimeline.parse(found == null ? "" : found.optString("lyrics"));
        }
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
                        JSONObject record = new JSONObject();
                        record.put("version", 3); record.put("title", query.title); record.put("artist", query.artist);
                        record.put("album", query.album); record.put("duration", query.duration);
                        record.put("source", meting ? "meting" : "lrclib");
                        record.put("lyrics", text); record.put("cachedAt", System.currentTimeMillis());
                        List<JSONObject> rows = records();
                        mergeRecord(rows, record, true);
                        persistRecords(rows, java.util.Collections.emptyList());
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
