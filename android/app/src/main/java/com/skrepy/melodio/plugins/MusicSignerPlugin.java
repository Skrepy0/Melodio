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

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.skrepy.melodio.BuildConfig;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okio.BufferedSink;
import okio.Okio;

@CapacitorPlugin(name = "MusicSigner")
public class MusicSignerPlugin extends Plugin {

    private static final String TAG = "MusicSignerPlugin";
    private static final String backendUrl = "https://api-melodio.skrepy.dpdns.org";
    private static final OkHttpClient unsafeDownloadClient = createUnsafeOkHttpClient();
    private volatile okhttp3.Call currentCall = null;

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
    public void search(PluginCall pluginCall) {
        if (currentCall != null && !currentCall.isCanceled()) {
            currentCall.cancel();
            currentCall = null;
        }

        String secretKey = BuildConfig.API_SECRET;

        String keyword = pluginCall.getString("keyword");
        if (keyword == null || keyword.isEmpty()) {
            pluginCall.reject("Missing keyword");
            return;
        }
        int limit = Objects.requireNonNull(pluginCall.getInt("limit", 5));

        List<String> clients = new ArrayList<>();
        JSONArray clientsArray = pluginCall.getArray("clients");
        if (clientsArray != null) {
            for (int i = 0; i < clientsArray.length(); i++) {
                try {
                    clients.add(clientsArray.getString(i));
                } catch (JSONException e) {
                    pluginCall.reject("Invalid clients array");
                    return;
                }
            }
        }

        long timestamp = System.currentTimeMillis() / 1000;
        String nonce = "cap_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 10000);
        String path = "/api/v1/music/search_stream";
        String method = "GET";
        int totalTimeOut = Objects.requireNonNull(pluginCall.getInt("totalTimeOut", 30));
        Collections.sort(clients);
        List<ParamPair> params = new ArrayList<>();
        params.add(new ParamPair("keyword", keyword));
        params.add(new ParamPair("limit", String.valueOf(limit)));
        params.add(new ParamPair("timeout", String.valueOf(totalTimeOut)));
        for (String client : clients) {
            params.add(new ParamPair("music_client", client));
        }
        params.sort(Comparator.comparing(a -> a.key));

        StringBuilder querySb = new StringBuilder();
        for (int i = 0; i < params.size(); i++) {
            if (i > 0) querySb.append("&");
            querySb.append(params.get(i).key).append("=").append(params.get(i).value);
        }
        String queryStr = querySb.toString();

        String signStr = method + "&" + path + "&" + queryStr + "&" + timestamp + "&" + nonce;
        String signature = hmacSha256(secretKey, signStr);
        String url = backendUrl + path + "?" + queryStr;

        Request request = new Request.Builder()
                .url(url)
                .addHeader("X-Timestamp", String.valueOf(timestamp))
                .addHeader("X-Nonce", nonce)
                .addHeader("X-Signature", signature)
                .build();
        int eachSongTimeOut = Objects.requireNonNull(pluginCall.getInt("eachSongTimeOut", 10));
        int timeOut = Math.min(eachSongTimeOut * clients.size() * limit, 300);
        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(timeOut, TimeUnit.SECONDS)
                .readTimeout(timeOut, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();

        final okhttp3.Call call = client.newCall(request);
        currentCall = call;

        call.enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(@NonNull okhttp3.Call okCall, @NonNull IOException e) {
                if (okCall.isCanceled()) {
                    Log.d(TAG, "Search request cancelled");
                    return;
                }
                Log.e(TAG, "SSE request failed", e);
                pluginCall.reject("Network error: " + e.getMessage());
            }

            @Override
            public void onResponse(@NonNull okhttp3.Call okCall, @NonNull okhttp3.Response response) {
                if (okCall.isCanceled()) {
                    Log.d(TAG, "Response ignored due to cancellation");
                    return;
                }

                boolean resolved = false;

                try {
                    Log.d(TAG, "Response code: " + response.code());

                    if (!response.isSuccessful()) {
                        String errorBody = "";
                        try (okhttp3.ResponseBody body = response.body()) {
                            if (body != null) {
                                errorBody = body.string();
                            }
                        } catch (Exception e) {
                            errorBody = "Unable to read error body: " + e.getMessage();
                        }
                        Log.e(TAG, "Request failed with code: " + response.code() + ", body: " + errorBody);
                        pluginCall.reject("Request failed with code: " + response.code() + "\nBody: " + errorBody);
                        return;
                    }

                    try (okhttp3.ResponseBody body = response.body()) {
                        if (body == null) {
                            pluginCall.reject("Empty response");
                            return;
                        }

                        java.io.BufferedReader reader = new java.io.BufferedReader(
                                new java.io.InputStreamReader(body.byteStream(), StandardCharsets.UTF_8));
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                String jsonData = line.substring(6).trim();
                                if (jsonData.isEmpty()) continue;
                                try {
                                    JSONObject eventJson = new JSONObject(jsonData);
                                    String status = eventJson.optString("status");
                                    if ("partial".equals(status)) {
                                        JSObject partialResult = new JSObject();
                                        partialResult.put("source", eventJson.getString("source"));
                                        partialResult.put("items", eventJson.getJSONArray("items"));
                                        notifyListeners("searchPartial", partialResult);
                                    } else if ("done".equals(status)) {
                                        JSObject doneResult = new JSObject();
                                        doneResult.put("status", "done");
                                        pluginCall.resolve(doneResult);
                                        resolved = true;
                                        break;
                                    }
                                } catch (JSONException e) {
                                    Log.w(TAG, "Failed to parse SSE event: " + jsonData, e);
                                }
                            }
                        }

                        if (!resolved) {
                            JSObject doneResult = new JSObject();
                            doneResult.put("status", "done");
                            pluginCall.resolve(doneResult);
                            resolved = true;
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error reading SSE stream", e);
                        if (!resolved) {
                            pluginCall.reject("Stream error: " + e.getMessage());
                            resolved = true;
                        }
                    }
                } catch (Exception e) {
                    if (!resolved) {
                        pluginCall.reject("Unexpected error: " + e.getMessage());
                    }
                } finally {
                    if (currentCall == okCall) {
                        currentCall = null;
                    }
                }
            }
        });
    }

    @PluginMethod
    public void cancelSearch(PluginCall pluginCall) {
        if (currentCall != null && !currentCall.isCanceled()) {
            currentCall.cancel();
            currentCall = null;
            Log.d(TAG, "Search cancelled by user");
        }
        pluginCall.resolve();
    }

    private String hmacSha256(String key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("HMAC error", e);
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

        performDownload(call, url, fileName);
    }

    private void performDownload(PluginCall call, String url, String fileName) {
        Request request = new Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .addHeader("Accept", "*/*")
                .addHeader("Connection", "keep-alive")
                .build();

        try {
            Response response = unsafeDownloadClient.newCall(request).execute();
            if (!response.isSuccessful()) {
                call.reject("Download failed: " + response.code());
                return;
            }

            String mimeType = response.header("Content-Type");

            if (mimeType == null || !mimeType.startsWith("audio/")) {
                mimeType = "audio/flac";
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                downloadViaMediaStore(call, response, fileName, mimeType);
            } else {
                downloadToPrivateDirAndScan(call, response, fileName);
            }
        } catch (IOException e) {
            Log.e(TAG, "Download error", e);
            call.reject("Download error: " + e.getMessage());
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void downloadViaMediaStore(PluginCall call, Response response, String fileName, String mimeType) throws IOException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Audio.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Audio.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC);
        values.put(MediaStore.Audio.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri itemUri = getContext().getContentResolver().insert(collection, values);
        if (itemUri == null) {
            call.reject("Failed to create MediaStore entry");
            return;
        }

        try (OutputStream out = getContext().getContentResolver().openOutputStream(itemUri)) {
            if (out == null) {
                call.reject("Failed to open output stream");
                return;
            }
            long fileSize = 0;
            try (BufferedSink sink = Okio.buffer(Okio.sink(out))) {
                if (response.body() != null) {
                    fileSize = sink.writeAll(response.body().source());
                }
            }

            values.clear();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            getContext().getContentResolver().update(itemUri, values, null, null);

            JSObject result = new JSObject();
            result.put("uri", itemUri.toString());
            result.put("path", itemUri.toString());
            result.put("size", fileSize);
            call.resolve(result);
        }
    }

    private void downloadToPrivateDirAndScan(PluginCall call, Response response, String fileName) throws IOException {
        File downloadDir = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "music");
        if (!downloadDir.exists() && !downloadDir.mkdirs()) {
            call.reject("Cannot create download directory");
            return;
        }

        File outputFile = new File(downloadDir, fileName);
        long fileSize = 0;
        try (BufferedSink sink = Okio.buffer(Okio.sink(outputFile))) {
            if (response.body() != null) {
                fileSize = sink.writeAll(response.body().source());
            }
        }

        Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
        scanIntent.setData(Uri.fromFile(outputFile));
        getContext().sendBroadcast(scanIntent);
        MediaScannerConnection.scanFile(getContext(),
                new String[]{outputFile.getAbsolutePath()}, null, null);

        JSObject result = new JSObject();
        result.put("path", outputFile.getAbsolutePath());
        result.put("size", fileSize);
        call.resolve(result);
    }

    private static class ParamPair {
        String key;
        String value;

        ParamPair(String key, String value) {
            this.key = key;
            this.value = value;
        }
    }
}