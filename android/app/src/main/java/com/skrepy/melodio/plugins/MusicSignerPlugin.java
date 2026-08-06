package com.skrepy.melodio.plugins;

import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okio.BufferedSink;
import okio.Okio;

@CapacitorPlugin(name = "MusicSigner")
public class MusicSignerPlugin extends Plugin {

    private static final String TAG = "MusicSignerPlugin";

    private static final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(120, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();

    @PluginMethod
    public void search(PluginCall call) {
        String secretKey = BuildConfig.API_SECRET;

        String keyword = call.getString("keyword");
        if (keyword == null || keyword.isEmpty()) {
            call.reject("Missing keyword");
            return;
        }

        int limit = call.getInt("limit", 5);

        List<String> clients = new ArrayList<>();
        JSONArray clientsArray = call.getArray("clients");
        if (clientsArray != null) {
            for (int i = 0; i < clientsArray.length(); i++) {
                try {
                    clients.add(clientsArray.getString(i));
                } catch (JSONException e) {
                    call.reject("Invalid clients array");
                    return;
                }
            }
        }

        long timestamp = System.currentTimeMillis() / 1000;
        String nonce = "cap_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 10000);
        String path = "/api/v1/music/search";
        String method = "GET";

        List<ParamPair> params = new ArrayList<>();
        params.add(new ParamPair("keyword", keyword));
        params.add(new ParamPair("limit", String.valueOf(limit)));
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

        String baseUrl = "https://api-melodio.skrepy.dpdns.org";
        String url = baseUrl + path + "?" + queryStr;

        Request request = new Request.Builder()
                .url(url)
                .addHeader("X-Timestamp", String.valueOf(timestamp))
                .addHeader("X-Nonce", nonce)
                .addHeader("X-Signature", signature)
                .build();

        try {
            Response response = client.newCall(request).execute();
            String body = response.body() != null ? response.body().string() : null;
            if (response.isSuccessful() && body != null) {
                JSONObject json = new JSONObject(body);
                int total = json.optInt("total", 0);
                JSONArray itemsArray = json.optJSONArray("items");
                if (itemsArray == null) {
                    itemsArray = new JSONArray();
                }

                JSObject result = new JSObject();
                result.put("total", total);
                result.put("items", itemsArray);
                call.resolve(result);
            } else {
                call.reject("Request failed with code: " + response.code());
            }
        } catch (Exception e) {
            Log.e(TAG, "Network error", e);
            call.reject("Network error: " + e.getMessage());
        }
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

    /**
     * 下载文件并注册到系统媒体库，使扫描器能够发现。
     * 根据Android版本使用不同的存储策略：
     * - Android 10+：通过MediaStore API直接写入公共Music目录，无需权限且自动索引。
     * - Android 9及以下：回退到应用私有外部目录，然后触发媒体扫描。
     */
    private void performDownload(PluginCall call, String url, String fileName) {
        Request request = new Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .addHeader("Accept", "*/*")
                .addHeader("Connection", "keep-alive")
                .build();

        try {
            Response response = client.newCall(request).execute();
            if (!response.isSuccessful()) {
                call.reject("Download failed: " + response.code());
                return;
            }

            String mimeType = response.header("Content-Type");
            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = "audio/*";
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

    /**
     * Android 10+ 使用MediaStore插入，直接写入公共Music目录
     */
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
            long fileSize;
            try (BufferedSink sink = Okio.buffer(Okio.sink(out))) {
                fileSize = sink.writeAll(response.body().source());
            }

            // 写入完成，取消pending状态
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

    /**
     * Android 9及以下写入私有目录，并触发媒体扫描
     */
    private void downloadToPrivateDirAndScan(PluginCall call, Response response, String fileName) throws IOException {
        File downloadDir = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "music");
        if (!downloadDir.exists() && !downloadDir.mkdirs()) {
            call.reject("Cannot create download directory");
            return;
        }

        File outputFile = new File(downloadDir, fileName);
        long fileSize;
        try (BufferedSink sink = Okio.buffer(Okio.sink(outputFile))) {
            fileSize = sink.writeAll(response.body().source());
        }

        // 触发媒体扫描（发送广播 + 主动扫描该文件）
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