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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.Call;
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
    private final Map<String, DownloadTaskState> taskStates = new ConcurrentHashMap<>();

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
    public void startDownload(PluginCall call) {
        String taskId = call.getString("taskId");
        String url = call.getString("url");
        String fileName = call.getString("fileName");
        if (taskId == null || url == null || fileName == null) {
            call.reject("Missing taskId, url or fileName");
            return;
        }

        DownloadTaskState existing = taskStates.get(taskId);
        if (existing != null && ("queued".equals(existing.status) || "downloading".equals(existing.status))) {
            call.reject("Task is already downloading");
            return;
        }

        DownloadTaskState state = existing != null ? existing : new DownloadTaskState();
        state.taskId = taskId;
        state.url = url;
        state.fileName = fileName;
        state.pauseRequested = false;
        state.shouldResume = false;
        state.status = "queued";
        taskStates.put(taskId, state);

        new Thread(() -> performDownload(call, state, false)).start();
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        String taskId = call.getString("taskId");
        DownloadTaskState state = taskId == null ? null : taskStates.get(taskId);
        if (state == null) {
            call.reject("Download task not found");
            return;
        }

        state.pauseRequested = true;
        state.shouldResume = true;
        state.status = "paused";
        Call currentCall = state.currentCall;
        if (currentCall != null) {
            currentCall.cancel();
        }
        notifyProgress(state);

        JSObject result = new JSObject();
        result.put("taskId", taskId);
        result.put("status", "paused");
        call.resolve(result);
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        String taskId = call.getString("taskId");
        String url = call.getString("url");
        String fileName = call.getString("fileName");
        Long loaded = call.getLong("loaded");
        DownloadTaskState state = taskId == null ? null : taskStates.get(taskId);
        if (state == null) {
            if (taskId == null || url == null || fileName == null) {
                call.reject("Missing taskId, url or fileName");
                return;
            }
            state = new DownloadTaskState();
            state.taskId = taskId;
            taskStates.put(taskId, state);
        }

        if (url != null) {
            state.url = url;
        }
        if (fileName != null) {
            state.fileName = fileName;
        }
        if (loaded != null && loaded >= 0) {
            state.loaded = loaded;
        }

        if (state.url == null || state.fileName == null) {
            call.reject("Download task missing resume data");
            return;
        }

        state.pauseRequested = false;
        state.shouldResume = true;
        state.status = "queued";

        DownloadTaskState finalState = state;
        new Thread(() -> performDownload(call, finalState, true)).start();
    }

    private void performDownload(PluginCall call, DownloadTaskState state, boolean resume) {
        state.status = "downloading";
        notifyProgress(state);

        Request.Builder requestBuilder = new Request.Builder()
                .url(state.url)
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .addHeader("Accept", "*/*")
                .addHeader("Connection", "keep-alive");

        long downloaded = getDownloadedBytes(state);
        boolean tryResume = resume && downloaded > 0;
        if (tryResume) {
            requestBuilder.addHeader("Range", "bytes=" + downloaded + "-");
            state.loaded = downloaded;
        } else if (!resume) {
            resetTaskFiles(state);
            state.loaded = 0;
        }

        Call currentCall = unsafeDownloadClient.newCall(requestBuilder.build());
        state.currentCall = currentCall;

        try (Response response = currentCall.execute()) {
            if (!response.isSuccessful() && response.code() != 206) {
                sendError(call, state, "Download failed: " + response.code());
                return;
            }
            if (response.body() == null) {
                sendError(call, state, "Empty response body");
                return;
            }

            if (tryResume && response.code() == 200) {
                Log.w(TAG, "Server does not support range resume, restarting task: " + state.taskId);
                resetTaskFiles(state);
                state.loaded = 0;
                state.pauseRequested = false;
                performDownload(call, state, false);
                return;
            }

            String mimeType = response.header("Content-Type");
            if (mimeType == null || !mimeType.startsWith("audio/")) {
                mimeType = "audio/flac";
            }
            state.mimeType = mimeType;

            long responseLength = response.body().contentLength();
            state.total = responseLength > 0 ? state.loaded + responseLength : -1;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                downloadViaMediaStore(call, state, response, tryResume);
            } else {
                downloadToPrivateDir(call, state, response, tryResume);
            }
        } catch (IOException e) {
            if (state.pauseRequested) {
                state.status = "paused";
                notifyProgress(state);
                return;
            }
            Log.e(TAG, "Download error", e);
            sendError(call, state, "Download error: " + e.getMessage());
        } finally {
            state.currentCall = null;
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void downloadViaMediaStore(PluginCall call, DownloadTaskState state, Response response, boolean resume) throws IOException {
        ensureMediaStoreEntry(state);
        if (state.mediaStoreUri == null) {
            sendError(call, state, "Failed to create MediaStore entry");
            return;
        }

        try (OutputStream out = getContext().getContentResolver().openOutputStream(state.mediaStoreUri, resume ? "wa" : "w")) {
            if (out == null) {
                sendError(call, state, "Failed to open output stream");
                return;
            }
            writeResponseToSink(call, state, response.body().source(), Okio.buffer(Okio.sink(out)));

            if ("paused".equals(state.status)) {
                return;
            }

            ContentValues values = new ContentValues();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            getContext().getContentResolver().update(state.mediaStoreUri, values, null, null);

            JSObject result = new JSObject();
            result.put("taskId", state.taskId);
            result.put("uri", state.mediaStoreUri.toString());
            result.put("path", state.mediaStoreUri.toString());
            result.put("size", state.loaded);
            state.status = "completed";
            notifyProgress(state);
            call.resolve(result);
        } catch (Exception e) {
            if (!state.pauseRequested && state.mediaStoreUri != null) {
                getContext().getContentResolver().delete(state.mediaStoreUri, null, null);
                state.mediaStoreUri = null;
            }
            if (state.pauseRequested) {
                state.status = "paused";
                notifyProgress(state);
                return;
            }
            sendError(call, state, "Download error: " + e.getMessage());
        }
    }

    private void downloadToPrivateDir(PluginCall call, DownloadTaskState state, Response response, boolean resume) throws IOException {
        File downloadDir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "music");
        if (!downloadDir.exists() && !downloadDir.mkdirs()) {
            sendError(call, state, "Cannot create download directory");
            return;
        }

        if (state.outputFile == null) {
            state.outputFile = new File(downloadDir, state.fileName);
        }

        try (BufferedSink sink = Okio.buffer(Okio.appendingSink(state.outputFile))) {
            if (!resume && state.outputFile.exists() && !state.outputFile.delete()) {
                Log.w(TAG, "Unable to delete existing output file before restart: " + state.outputFile.getAbsolutePath());
            }
        }

        if (!resume) {
            state.outputFile = new File(downloadDir, state.fileName);
            if (state.outputFile.exists() && !state.outputFile.delete()) {
                Log.w(TAG, "Unable to delete old file: " + state.outputFile.getAbsolutePath());
            }
        }

        try (BufferedSink sink = Okio.buffer(Okio.appendingSink(state.outputFile))) {
            writeResponseToSink(call, state, response.body().source(), sink);

            if ("paused".equals(state.status)) {
                return;
            }
        }

        Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
        scanIntent.setData(Uri.fromFile(state.outputFile));
        getContext().sendBroadcast(scanIntent);
        MediaScannerConnection.scanFile(getContext(), new String[]{state.outputFile.getAbsolutePath()}, null, null);

        JSObject result = new JSObject();
        result.put("taskId", state.taskId);
        result.put("path", state.outputFile.getAbsolutePath());
        result.put("size", state.outputFile.length());
        state.status = "completed";
        notifyProgress(state);
        call.resolve(result);
    }

    private void writeResponseToSink(PluginCall call, DownloadTaskState state, BufferedSource source, BufferedSink sink) throws IOException {
        final int BUFFER_SIZE = 8192;
        long lastUpdateTime = System.currentTimeMillis();
        long lastUpdateLoaded = state.loaded;

        while (!source.exhausted()) {
            if (state.pauseRequested) {
                sink.flush();
                state.status = "paused";
                notifyProgress(state);
                return;
            }

            long read = source.read(sink.buffer(), BUFFER_SIZE);
            if (read == -1) break;
            sink.emit();
            state.loaded += read;

            long now = System.currentTimeMillis();
            if (now - lastUpdateTime > 200 || (state.loaded - lastUpdateLoaded) > 512 * 1024) {
                notifyProgress(state);
                lastUpdateTime = now;
                lastUpdateLoaded = state.loaded;
            }
        }
        sink.flush();
        notifyProgress(state);
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void ensureMediaStoreEntry(DownloadTaskState state) {
        if (state.mediaStoreUri != null) return;

        ContentValues values = new ContentValues();
        values.put(MediaStore.Audio.Media.DISPLAY_NAME, state.fileName);
        values.put(MediaStore.Audio.Media.MIME_TYPE, state.mimeType);
        values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC);
        values.put(MediaStore.Audio.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        state.mediaStoreUri = getContext().getContentResolver().insert(collection, values);
    }

    private void resetTaskFiles(DownloadTaskState state) {
        state.pauseRequested = false;
        state.shouldResume = false;
        state.total = -1;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (state.mediaStoreUri != null) {
                getContext().getContentResolver().delete(state.mediaStoreUri, null, null);
                state.mediaStoreUri = null;
            }
        } else if (state.outputFile != null && state.outputFile.exists() && !state.outputFile.delete()) {
            Log.w(TAG, "Unable to delete output file: " + state.outputFile.getAbsolutePath());
        }
    }

    private long getDownloadedBytes(DownloadTaskState state) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return state.loaded;
        }
        if (state.outputFile != null && state.outputFile.exists()) {
            return state.outputFile.length();
        }
        return state.loaded;
    }

    private void notifyProgress(DownloadTaskState state) {
        JSObject progress = new JSObject();
        progress.put("taskId", state.taskId);
        progress.put("loaded", state.loaded);
        progress.put("total", state.total);
        progress.put("progress", state.total > 0 ? (int) ((state.loaded * 100) / state.total) : -1);
        progress.put("status", state.status);
        notifyListeners("downloadProgress", progress, true);
    }

    private void sendError(PluginCall call, DownloadTaskState state, String message) {
        state.status = "failed";
        notifyProgress(state);
        call.reject(message);
    }

    private static final class DownloadTaskState {
        String taskId;
        String url;
        String fileName;
        volatile String status = "queued";
        volatile long loaded = 0;
        volatile long total = -1;
        volatile boolean pauseRequested = false;
        volatile boolean shouldResume = false;
        volatile Call currentCall;
        volatile File tempFile;
        volatile File outputFile;
        volatile Uri mediaStoreUri;
        volatile String mimeType = "audio/flac";
    }
}
