package com.skrepy.melodio.plugins;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import androidx.annotation.RequiresApi;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okio.BufferedSink;
import okio.BufferedSource;
import okio.Okio;

@CapacitorPlugin(name = "Downloader")
public class DownloaderPlugin extends Plugin {
    private static final String TAG = "DownloaderPlugin";
    private static final OkHttpClient unsafeDownloadClient = createUnsafeOkHttpClient();

    private static OkHttpClient createUnsafeOkHttpClient() {
        try {
            @SuppressLint("CustomX509TrustManager") final TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @SuppressLint("TrustAllX509TrustManager")
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        }

                        @SuppressLint("TrustAllX509TrustManager")
                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                    }
            };
            final SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAllCerts, new SecureRandom());

            return new OkHttpClient.Builder()
                    .sslSocketFactory(sslContext.getSocketFactory(), (X509TrustManager) trustAllCerts[0])
                    .hostnameVerifier((hostname, session) -> true)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(180, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName");
        if (url == null || fileName == null) {
            call.reject("Missing url or fileName");
            return;
        }

        // 保持调用存活，以便后续发送进度（notifyListeners 不需要 keepAlive，但 resolve 需要）
        call.setKeepAlive(true);

        // 在后台线程执行下载
        new Thread(() -> performDownloadWithProgress(call, url, fileName)).start();
    }

    private void performDownloadWithProgress(PluginCall call, String url, String fileName) {
        Request request = new Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .addHeader("Accept", "*/*")
                .addHeader("Connection", "keep-alive")
                .build();

        try {
            Response response = unsafeDownloadClient.newCall(request).execute();
            if (!response.isSuccessful()) {
                sendError(call, "Download failed: " + response.code());
                return;
            }

            String mimeType = response.header("Content-Type");
            if (mimeType == null || !mimeType.startsWith("audio/")) {
                mimeType = "audio/flac";
            }

            // 获取文件总大小（可能为 -1）
            long contentLength = response.body() != null ? response.body().contentLength() : -1;
            if (contentLength <= 0) {
                // 如果服务器没有返回 Content-Length，则无法计算百分比，但仍然可以下载
                // 可以发送 indeterminate 进度，或只报告 loaded 而不报告 total
            }

            // 准备输出（根据 Android 版本决定存储方式）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                downloadViaMediaStoreWithProgress(call, response, fileName, mimeType, contentLength);
            } else {
                downloadToPrivateDirWithProgress(call, response, fileName, contentLength);
            }

        } catch (IOException e) {
            Log.e(TAG, "Download error", e);
            sendError(call, "Download error: " + e.getMessage());
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void downloadViaMediaStoreWithProgress(PluginCall call, Response response,
                                                   String fileName, String mimeType, long totalSize) throws IOException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Audio.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Audio.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC);
        values.put(MediaStore.Audio.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri itemUri = getContext().getContentResolver().insert(collection, values);
        if (itemUri == null) {
            sendError(call, "Failed to create MediaStore entry");
            return;
        }

        try (OutputStream out = getContext().getContentResolver().openOutputStream(itemUri)) {
            if (out == null) {
                sendError(call, "Failed to open output stream");
                return;
            }

            BufferedSink sink = Okio.buffer(Okio.sink(out));
            BufferedSource source = response.body().source();

            long loaded = 0;
            final int BUFFER_SIZE = 8192; // 8KB
            long lastUpdateTime = System.currentTimeMillis();
            long lastUpdateLoaded = 0;

            while (!source.exhausted()) {
                long read = source.read(sink.buffer(), BUFFER_SIZE);
                if (read == -1) break;
                sink.emit();
                loaded += read;

                // 每 200ms 或每 512KB 发送一次进度
                long now = System.currentTimeMillis();
                if (now - lastUpdateTime > 200 || (loaded - lastUpdateLoaded) > 512 * 1024) {
                    sendProgress(call, loaded, totalSize);
                    lastUpdateTime = now;
                    lastUpdateLoaded = loaded;
                }
            }
            sink.flush();

            // 移除 pending 标记
            values.clear();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            getContext().getContentResolver().update(itemUri, values, null, null);

            // 最终结果
            JSObject result = new JSObject();
            result.put("uri", itemUri.toString());
            result.put("path", itemUri.toString());
            result.put("size", loaded);
            sendSuccess(call, result);

        } catch (Exception e) {
            // 如果出错，删除 MediaStore 条目
            getContext().getContentResolver().delete(itemUri, null, null);
            sendError(call, "Download error: " + e.getMessage());
        }
    }

    private void downloadToPrivateDirWithProgress(PluginCall call, Response response,
                                                  String fileName, long totalSize) throws IOException {
        File downloadDir = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "music");
        if (!downloadDir.exists() && !downloadDir.mkdirs()) {
            sendError(call, "Cannot create download directory");
            return;
        }

        File outputFile = new File(downloadDir, fileName);
        try (BufferedSink sink = Okio.buffer(Okio.sink(outputFile))) {
            BufferedSource source = response.body().source();

            long loaded = 0;
            final int BUFFER_SIZE = 8192;
            long lastUpdateTime = System.currentTimeMillis();
            long lastUpdateLoaded = 0;

            while (!source.exhausted()) {
                long read = source.read(sink.buffer(), BUFFER_SIZE);
                if (read == -1) break;
                sink.emit();
                loaded += read;

                long now = System.currentTimeMillis();
                if (now - lastUpdateTime > 200 || (loaded - lastUpdateLoaded) > 512 * 1024) {
                    sendProgress(call, loaded, totalSize);
                    lastUpdateTime = now;
                    lastUpdateLoaded = loaded;
                }
            }
            sink.flush();
        }

        // 扫描文件
        Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
        scanIntent.setData(Uri.fromFile(outputFile));
        getContext().sendBroadcast(scanIntent);
        MediaScannerConnection.scanFile(getContext(),
                new String[]{outputFile.getAbsolutePath()}, null, null);

        JSObject result = new JSObject();
        result.put("path", outputFile.getAbsolutePath());
        result.put("size", outputFile.length());
        sendSuccess(call, result);
    }

    private void sendProgress(PluginCall call, long loaded, long total) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getContext().getMainExecutor().execute(() -> {
                JSObject progress = new JSObject();
                progress.put("event", "progress");
                progress.put("loaded", loaded);
                progress.put("total", total);
                progress.put("progress", total > 0 ? (int) ((loaded * 100) / total) : -1);
                // 每次 resolve 都会触发前端的 then 回调
                call.resolve(progress);
            });
        }
    }

    private void sendSuccess(PluginCall call, JSObject result) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getContext().getMainExecutor().execute(() -> {
                // 最后成功，调用 resolve 并自动结束（无需再保持）
                call.resolve(result);
                call.setKeepAlive(false);
            });
        }
    }

    private void sendError(PluginCall call, String message) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getContext().getMainExecutor().execute(() -> {
                call.reject(message);
                call.setKeepAlive(false);
            });
        }
    }
}
