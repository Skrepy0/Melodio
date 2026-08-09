package com.skrepy.melodio.plugins;

import android.os.Build;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CoverResolver {

    private static final String TAG = "CoverResolver";
    private static final String DEFAULT_COVER;
    private static final int TIMEOUT_MS = 4000;

    static {
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"#888\"><path d=\"M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\"/></svg>";
        byte[] bytes = svg.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        DEFAULT_COVER = "data:image/svg+xml;base64," + base64;
    }

    private final ExecutorService executor = Executors.newCachedThreadPool();

    private final String UserAgent;

    public CoverResolver(String UserAgent) {
        this.UserAgent = UserAgent;
    }

    /**
     * 将 Capacitor 特有的本地文件 URL 转换为标准 file:// URI
     */
    private static String normalizeUri(String uri) {
        if (uri.startsWith("https://localhost/_capacitor_file_/") ||
                uri.startsWith("http://localhost/_capacitor_file_/")) {
            String prefix = uri.startsWith("https://") ?
                    "https://localhost/_capacitor_file_" :
                    "http://localhost/_capacitor_file_";
            String filePath = uri.substring(prefix.length());
            if (!filePath.startsWith("/")) {
                filePath = "/" + filePath;
            }
            return "file://" + filePath;
        }
        if (uri.startsWith("/")) {
            return "file://" + uri;
        }
        return uri; // 可能是 http(s) 或 content 等
    }

    /**
     * 检查 URL 或文件路径是否可访问（网络图片可加载，本地文件存在）
     */
    private static boolean isAccessible(String uri) {
        if (uri.startsWith("http://") || uri.startsWith("https://")) {
            return isImageLoadable(uri);
        } else {
            return isLocalFileReadable(uri);
        }
    }

    /**
     * 通过 HEAD 请求检查网络图片是否可加载（不超过 TIMEOUT_MS）
     */
    private static boolean isImageLoadable(String imageUrl) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(imageUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setRequestMethod("HEAD");
            connection.setInstanceFollowRedirects(true);
            int responseCode = connection.getResponseCode();
            return responseCode >= 200 && responseCode < 400;
        } catch (Exception e) {
            Log.w(TAG, "Image load check failed for " + imageUrl, e);
            return false;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * 检查本地文件是否存在且可读
     */
    private static boolean isLocalFileReadable(String path) {
        try {
            if (path.startsWith("file://")) {
                path = path.substring(7);
            }
            // 处理 content:// 或其他 scheme 暂时返回 false
            if (path.startsWith("content://")) {
                // 对于 content URI，可以使用 ContentResolver 检查，但此处简化
                return false;
            }
            File file = new File(path);
            return file.exists() && file.canRead();
        } catch (Exception e) {
            return false;
        }
    }

    // 辅助方法：执行 HTTP GET 请求（不带自定义头）
    private static String httpGet(String urlStr) throws Exception {
        return httpGet(urlStr, null);
    }

    // 辅助方法：执行 HTTP GET 请求（带自定义 User-Agent）
    private static String httpGet(String urlStr, String userAgent) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            if (userAgent != null) {
                conn.setRequestProperty("User-Agent", userAgent);
            }
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                return sb.toString();
            }
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * 异步解析封面 URL
     *
     * @param song 歌曲对象
     * @return CompletableFuture，完成后返回封面 URL 字符串
     */
    public CompletableFuture<String> resolveCoverUrlAsync(Song song) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return resolveCoverUrlSync(song);
            } catch (Exception e) {
                Log.e(TAG, "resolveCoverUrl error", e);
                return DEFAULT_COVER;
            }
        }, executor);
    }

    /**
     * 同步解析封面
     */
    public String resolveCoverUrlSync(Song song) {
        if (song == null) return DEFAULT_COVER;

        String uri = song.albumArtUri();
        if (uri != null && !uri.isEmpty()) {
            String fileUri = normalizeUri(uri);
            if (isAccessible(fileUri)) {
                return fileUri;
            }
        }

        String onlineCover = fetchCoverFromWeb(song.title(), song.artist());
        if (onlineCover != null && isImageLoadable(onlineCover)) {
            return onlineCover;
        }

        return DEFAULT_COVER;
    }

    /**
     * 从网络获取封面（iTunes -> Deezer -> MusicBrainz）
     *
     * @param title  歌曲标题
     * @param artist 艺术家
     * @return 封面 URL，若全部失败则返回 null
     */
    private String fetchCoverFromWeb(String title, String artist) {
        // 1. iTunes
        try {
            String query = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                query = URLEncoder.encode(title + " " + artist, StandardCharsets.UTF_8);
            }
            String urlStr = "https://itunes.apple.com/search?term=" + query + "&media=music&limit=1";
            String json = httpGet(urlStr);
            if (json != null) {
                JSONObject obj = new JSONObject(json);
                JSONArray results = obj.optJSONArray("results");
                if (results != null && results.length() > 0) {
                    JSONObject first = results.getJSONObject(0);
                    String art = first.optString("artworkUrl100");
                    if (!art.isEmpty()) {
                        return art.replace("100x100bb", "600x600bb");
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "iTunes fetch failed", e);
        }

        // 2. Deezer
        try {
            String query = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                query = URLEncoder.encode("track:\"" + title + "\" artist:\"" + artist + "\"", StandardCharsets.UTF_8);
            }
            String urlStr = "https://api.deezer.com/search?q=" + query + "&limit=1";
            String json = httpGet(urlStr);
            if (json != null) {
                JSONObject obj = new JSONObject(json);
                JSONArray data = obj.optJSONArray("data");
                if (data != null && data.length() > 0) {
                    JSONObject first = data.getJSONObject(0);
                    JSONObject album = first.optJSONObject("album");
                    if (album != null) {
                        String cover = album.optString("cover_big");
                        if (cover.isEmpty()) {
                            cover = album.optString("cover_xl");
                        }
                        if (!cover.isEmpty()) {
                            return cover;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Deezer fetch failed", e);
        }

        // 3. MusicBrainz + Cover Art Archive
        try {
            String query = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                query = URLEncoder.encode("recording:\"" + title + "\" AND artist:\"" + artist + "\"", StandardCharsets.UTF_8);
            }
            String urlStr = "https://musicbrainz.org/ws/2/recording/?query=" + query + "&fmt=json&limit=1";
            String json = httpGet(urlStr, UserAgent);
            if (json != null) {
                JSONObject obj = new JSONObject(json);
                JSONArray recordings = obj.optJSONArray("recordings");
                if (recordings != null && recordings.length() > 0) {
                    JSONObject first = recordings.getJSONObject(0);
                    JSONArray releases = first.optJSONArray("releases");
                    if (releases != null && releases.length() > 0) {
                        JSONObject release = releases.getJSONObject(0);
                        JSONObject releaseGroup = release.optJSONObject("release-group");
                        if (releaseGroup != null) {
                            String mbid = releaseGroup.optString("id");
                            if (!mbid.isEmpty()) {
                                String coverUrl = "https://coverartarchive.org/release-group/" + mbid + "/front-250";
                                // 发送 HEAD 请求验证是否存在
                                HttpURLConnection conn = null;
                                try {
                                    URL url = new URL(coverUrl);
                                    conn = (HttpURLConnection) url.openConnection();
                                    conn.setRequestMethod("HEAD");
                                    conn.setConnectTimeout(TIMEOUT_MS);
                                    conn.setReadTimeout(TIMEOUT_MS);
                                    int code = conn.getResponseCode();
                                    if (code >= 200 && code < 400) {
                                        return coverUrl;
                                    }
                                } finally {
                                    if (conn != null) conn.disconnect();
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "MusicBrainz fetch failed", e);
        }

        return null; // 全部失败
    }

    public void resolveCoverUrl(Song song, CoverCallback callback) {
        resolveCoverUrlAsync(song).thenAccept(callback::onSuccess)
                .exceptionally(ex -> {
                    callback.onError((Exception) ex);
                    return null;
                });
    }

    // -------------------- 回调方式（备选） --------------------
    public interface CoverCallback {
        void onSuccess(String coverUrl);

        void onError(Exception e);
    }
}