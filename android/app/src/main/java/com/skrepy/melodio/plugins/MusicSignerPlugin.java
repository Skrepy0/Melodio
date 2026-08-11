package com.skrepy.melodio.plugins;

import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.skrepy.melodio.BuildConfig;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import okhttp3.OkHttpClient;
import okhttp3.Request;

@CapacitorPlugin(name = "MusicSigner")
public class MusicSignerPlugin extends Plugin {

    private static final String TAG = "MusicSignerPlugin";
    private static final String backendUrl = "https://api-melodio.skrepy.dpdns.org";
    private volatile okhttp3.Call currentCall = null;

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

    private static class ParamPair {
        String key;
        String value;

        ParamPair(String key, String value) {
            this.key = key;
            this.value = value;
        }
    }
}