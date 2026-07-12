package com.skrepy.melodio.plugins;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {

    private static final String TAG = "NativeAudio";
    private static final String CHANNEL_ID = "melodio_audio_channel";
    private static final int NOTIF_ID = 1;
    private final List<SongItem> playlist = new ArrayList<>();
    private MediaPlayer mediaPlayer;
    private MediaSessionCompat mediaSession;
    private PlaybackStateCompat.Builder stateBuilder;
    private int currentIndex = -1;
    private boolean prepared = false;
    private boolean isPlaying = false;
    private int loadGeneration = 0;
    private PluginCall pendingPlayCall;
    private Handler progressHandler;
    private Runnable progressRunnable;
    private String title = "";
    private String artist = "";
    private String album = "";
    private String cover = "";
    private int durationSec = 0;
    private boolean repeatOne = false;
    private float playbackSpeed = 1.0f;

    //焦点管理
    private boolean audioFocusEnabled = true;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;
    private boolean audioFocusGranted = false;

    @Override
    public void load() {
        Log.d(TAG, "Plugin loaded, initializing...");
        initPlayer();
        initSession();
        createChannel();
    }

    private void initPlayer() {
        mediaPlayer = new MediaPlayer();
        mediaPlayer.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());

        mediaPlayer.setOnCompletionListener(mp -> {
            if (repeatOne) {
                mediaPlayer.seekTo(0);
                mediaPlayer.start();
                updateState(true);
                startProgress();
            } else {
                nextInternal();
            }
        });

        mediaPlayer.setOnErrorListener((mp, what, extra) -> {
            Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
            notifyError(what, extra);
            nextInternal();
            return true;
        });

        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        focusChangeListener = focusChange -> {
            Log.d(TAG, "AudioFocus changed: " + focusChange);
            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_LOSS:
                    // 永久失去焦点（例如其他应用开始播放），暂停
                    pauseInternal();
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    // 暂时失去焦点（例如通知音），不暂停
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    // 短暂失去焦点，不暂停
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    // 重新获得焦点，无操作
                    break;
            }
        };
    }

    private void requestAudioFocus() {
        if (!audioFocusEnabled) {
            audioFocusGranted = true;
            return;
        }
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes audioAttributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
            AudioFocusRequest focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(audioAttributes).setOnAudioFocusChangeListener(focusChangeListener).build();
            audioFocusGranted = audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } else {
            int result = audioManager.requestAudioFocus(focusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            audioFocusGranted = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        }
        Log.d(TAG, "AudioFocus requested: " + audioFocusGranted);
    }

    private void abandonAudioFocus() {
        if (!audioFocusEnabled || audioManager == null || focusChangeListener == null) return;
        audioManager.abandonAudioFocus(focusChangeListener);
        audioFocusGranted = false;
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        boolean repeat = Boolean.TRUE.equals(call.getBoolean("repeatOne", false));
        this.repeatOne = repeat;
        Log.d(TAG, "Repeat mode set to: " + repeat);
        call.resolve();
    }

    private void initSession() {
        mediaSession = new MediaSessionCompat(getContext(), "MelodioAudio");
        mediaSession.setActive(true);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                playInternal();
            }

            @Override
            public void onPause() {
                pauseInternal();
            }

            @Override
            public void onSkipToNext() {
                nextInternal();
            }

            @Override
            public void onSkipToPrevious() {
                prevInternal();
            }

            @Override
            public void onSeekTo(long pos) {
                if (prepared) mediaPlayer.seekTo((int) pos);
            }
        });
        Log.d(TAG, "MediaSession initialized");
    }

    @PluginMethod
    public void setCurrentIndex(PluginCall call) {
        Integer indexObj = call.getInt("index");
        int index = (indexObj != null) ? indexObj : -1;
        if (index >= 0 && index < playlist.size()) {
            currentIndex = index;
            Log.d(TAG, "Current index updated to: " + index);
            call.resolve();
        } else {
            call.reject("Invalid index");
        }
    }

    @PluginMethod
    public void setPlaylist(PluginCall call) {
        JSArray arr = call.getArray("songs");
        if (arr == null) {
            Log.e(TAG, "setPlaylist: songs array is null");
            call.reject("songs required");
            return;
        }

        playlist.clear();
        for (int i = 0; i < arr.length(); i++) {
            try {
                JSONObject o = arr.getJSONObject(i);
                SongItem s = new SongItem();
                s.url = o.getString("url");
                s.title = o.optString("title", "Unknown");
                s.artist = o.optString("artist", "");
                s.album = o.optString("album", "");
                s.cover = o.optString("coverUrl", "");
                Log.d(TAG, "s.cover:" + s.cover);
                playlist.add(s);
            } catch (Exception e) {
                Log.w(TAG, "Failed to parse song at index " + i, e);
            }
        }

        if (currentIndex < 0 || currentIndex >= playlist.size()) {
            currentIndex = -1;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            Log.d(TAG, "Playlist set: " + playlist.size() + " songs. First URL: " + (playlist.isEmpty() ? "none" : playlist.getFirst().url) + ", currentIndex=" + currentIndex);
        }
        call.resolve();
    }

    private void loadBitmap(String urlString, BitmapCallback callback) {
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                if (urlString.startsWith("data:")) {
                    String base64Str = urlString.substring(urlString.indexOf(",") + 1);
                    byte[] decodedBytes = android.util.Base64.decode(base64Str, android.util.Base64.DEFAULT);
                    bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                } else if (urlString.startsWith("file://")) {
                    bitmap = BitmapFactory.decodeFile(urlString.substring(7));
                } else {
                    URL url = new URL(urlString);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    bitmap = BitmapFactory.decodeStream(input);
                    input.close();
                }
            } catch (Exception e) {
                Log.e(TAG, "loadBitmap failed: " + e.getMessage());
            }
            Bitmap finalBitmap = bitmap;
            new Handler(Looper.getMainLooper()).post(() -> callback.onResult(finalBitmap));
        }).start();
    }

    @PluginMethod
    public void playIndex(PluginCall call) {
        Integer indexObj = call.getInt("index");
        int index = (indexObj != null) ? indexObj : 0;
        boolean autoPlay = Boolean.TRUE.equals(call.getBoolean("autoPlay", true)); // 默认 true

        Log.d(TAG, "playIndex called with index=" + index + ", autoPlay=" + autoPlay + " (playlist size=" + playlist.size() + ")");

        if (index < 0 || index >= playlist.size()) {
            Log.e(TAG, "playIndex: invalid index " + index);
            call.reject("invalid index");
            return;
        }

        pendingPlayCall = call;
        loadAndPlay(index, autoPlay);
    }

    private void loadAndPlay(int index, boolean autoPlay) {
        if (index < 0 || index >= playlist.size()) {
            Log.e(TAG, "loadAndPlay: invalid index " + index);
            return;
        }

        currentIndex = index;
        SongItem song = playlist.get(index);
        Log.d(TAG, "loadAndPlay: loading index=" + index + " url=" + song.url + " autoPlay=" + autoPlay);

        loadGeneration++;
        final int gen = loadGeneration;

        prepared = false;
        isPlaying = false;

        try {
            mediaPlayer.reset();
            Log.v(TAG, "MediaPlayer reset done");

            String dataSource = song.url;
            if (dataSource.startsWith("file://") && !dataSource.startsWith("file:///")) {
                dataSource = "file://" + dataSource.substring(7);
                Log.d(TAG, "Fixed file:// URL to: " + dataSource);
            }

            Log.d(TAG, "Setting data source to: " + dataSource);
            if (dataSource.startsWith("file://")) {
                mediaPlayer.setDataSource(getContext(), Uri.parse(dataSource));
            } else {
                mediaPlayer.setDataSource(dataSource);
            }
            Log.v(TAG, "DataSource set, preparing async...");

            mediaPlayer.setOnPreparedListener(mp -> {
                Log.d(TAG, "onPrepared called, generation=" + gen + " current=" + loadGeneration);
                if (gen != loadGeneration) {
                    Log.w(TAG, "Skipping onPrepared because loadGeneration changed (gen=" + gen + " current=" + loadGeneration + ")");
                    return;
                }

                prepared = true;

                durationSec = mp.getDuration() / 1000;
                Log.d(TAG, "Media prepared, duration=" + durationSec + "s");

                title = song.title;
                artist = song.artist;
                album = song.album;
                cover = song.cover;

                updateMetadata(song);

                if (autoPlay) {
                    mp.start();
                    applyPlaybackRate();
                    isPlaying = true;
                    Log.d(TAG, "Playback started");
                    updateState(true);
                    startProgress();
                } else {
                    isPlaying = false;
                    updateState(false);
                    Log.d(TAG, "Prepared but not started (paused)");
                }

                notifySongChanged();

                if (pendingPlayCall != null) {
                    pendingPlayCall.resolve();
                    pendingPlayCall = null;
                }
            });

            mediaPlayer.prepareAsync();
            Log.d(TAG, "prepareAsync initiated");

        } catch (Exception e) {
            Log.e(TAG, "Exception in loadAndPlay for url=" + song.url, e);
            notifyError(-1, -1);
            nextInternal();
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        Log.d(TAG, "play() called, prepared=" + prepared);
        if (mediaPlayer == null || !prepared) {
            call.reject("Player not ready");
            return;
        }
        playInternal();
        call.resolve();
    }

    private void playInternal() {
        if (!prepared) {
            Log.w(TAG, "playInternal: not prepared, ignoring");
            return;
        }
        if (!audioFocusGranted) {
            requestAudioFocus();
            if (!audioFocusGranted) {
                // 可提示用户或静默处理
                return;
            }
        }
        if (!mediaPlayer.isPlaying()) {
            mediaPlayer.start();
            applyPlaybackRate();
            isPlaying = true;
            updateState(true);
            startProgress();
            notifyPlayState(false);
            Log.d(TAG, "playInternal: started playback");
        } else {
            Log.d(TAG, "playInternal: already playing");
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Log.d(TAG, "pause() called, prepared=" + prepared + " isPlaying=" + isPlaying);
        pauseInternal();
        call.resolve();
    }

    private void pauseInternal() {
        if (!prepared) {
            Log.w(TAG, "pauseInternal: not prepared, ignoring");
            return;
        }
        if (mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            isPlaying = false;
            updateState(false);
            stopProgress();
            notifyPlayState(true);
            abandonAudioFocus();
            Log.d(TAG, "pauseInternal: paused");
        } else {
            Log.d(TAG, "pauseInternal: already paused");
        }
    }

    private void notifyPlayState(boolean playing) {
        JSObject data = new JSObject();
        data.put("isPlaying", playing);
        notifyListeners("playStateChange", data);
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double timeSecObj = call.getDouble("time");
        double timeSec = (timeSecObj != null) ? timeSecObj : 0.0;
        int msec = (int) (timeSec * 1000);
        Log.d(TAG, "seek to " + timeSec + "s (" + msec + "ms)");
        if (prepared) {
            mediaPlayer.seekTo(msec);
            call.resolve();
        } else {
            call.reject("Player not ready");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Log.d(TAG, "stop() called");
        if (prepared) {
            mediaPlayer.pause();
            mediaPlayer.seekTo(0);
        }
        isPlaying = false;
        updateState(false);
        stopProgress();
        call.resolve();
    }

    private void nextInternal() {
        if (playlist.isEmpty()) return;
        int n = (currentIndex + 1) % playlist.size();
        Log.d(TAG, "nextInternal: switching to index=" + n);
        loadAndPlay(n, true);
    }

    private void prevInternal() {
        if (playlist.isEmpty()) return;
        int p = (currentIndex - 1 + playlist.size()) % playlist.size();
        Log.d(TAG, "prevInternal: switching to index=" + p);
        loadAndPlay(p, true);
    }

    private void updateState(boolean playing) {
        if (stateBuilder == null) stateBuilder = new PlaybackStateCompat.Builder();
        long pos = prepared ? mediaPlayer.getCurrentPosition() : 0;
        stateBuilder.setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, pos, 1.0f);
        stateBuilder.setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO);
        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void updateMetadata(SongItem song) {
        MediaMetadataCompat.Builder b = new MediaMetadataCompat.Builder().putString(MediaMetadataCompat.METADATA_KEY_TITLE, song.title).putString(MediaMetadataCompat.METADATA_KEY_ARTIST, song.artist).putString(MediaMetadataCompat.METADATA_KEY_ALBUM, song.album).putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationSec * 1000L);

        if (song.cover != null && !song.cover.isEmpty()) {
            loadBitmap(song.cover, bitmap -> {
                if (bitmap != null) {
                    b.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap);
                }
                mediaSession.setMetadata(b.build());
                showNotification();
            });
        } else {
            mediaSession.setMetadata(b.build());
            showNotification();
        }
    }

    private void showNotification() {
        if (!canPostNotification()) {
            Log.w(TAG, "Notification permission not granted");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            Log.w(TAG, "Activity is null, can't show notification");
            return;
        }
        Intent intent = new Intent(getContext(), activity.getClass());
        PendingIntent pi = PendingIntent.getActivity(getContext(), 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        android.app.Notification n = new androidx.core.app.NotificationCompat.Builder(getContext(), CHANNEL_ID).setSmallIcon(getContext().getApplicationInfo().icon).setContentTitle(title).setContentText(artist).setContentIntent(pi).setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC).setPriority(androidx.core.app.NotificationCompat.PRIORITY_LOW).setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(mediaSession.getSessionToken())).build();
        try {
            NotificationManagerCompat.from(getContext()).notify(NOTIF_ID, n);
        } catch (SecurityException e) {
            Log.e(TAG, "Notification failed", e);
        }
    }

    private boolean canPostNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean granted = getContext().checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            Log.d(TAG, "POST_NOTIFICATIONS granted: " + granted);
            return granted;
        }
        return true;
    }

    @PluginMethod
    public void setAudioFocusEnabled(PluginCall call) {
        Boolean enabledObj = call.getBoolean("enabled");
        boolean enabled = (enabledObj != null) ? enabledObj : true;
        this.audioFocusEnabled = enabled;
        Log.d(TAG, "Audio focus enabled: " + enabled);
        call.resolve();
    }

    private void notifySongChanged() {
        JSObject o = new JSObject();
        o.put("index", currentIndex);
        o.put("title", title);
        o.put("artist", artist);
        notifyListeners("songChanged", o);
        Log.d(TAG, "songChanged event sent: index=" + currentIndex + " title=" + title);
    }

    private void notifyError(int w, int e) {
        JSObject o = new JSObject();
        o.put("what", w);
        o.put("extra", e);
        notifyListeners("error", o);
        Log.e(TAG, "error event sent: what=" + w + " extra=" + e);
    }

    private void startProgress() {
        if (progressHandler == null) progressHandler = new Handler(Looper.getMainLooper());
        stopProgress();
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                if (prepared && isPlaying) {
                    int pos = mediaPlayer.getCurrentPosition();
                    JSObject o = new JSObject();
                    o.put("position", pos / 1000.0);
                    notifyListeners("timeupdate", o);
                    updateState(true);
                    progressHandler.postDelayed(this, 1000);
                }
            }
        };
        progressHandler.post(progressRunnable);
        Log.d(TAG, "Progress updates started");
    }

    private void stopProgress() {
        if (progressHandler != null && progressRunnable != null) {
            progressHandler.removeCallbacks(progressRunnable);
            Log.d(TAG, "Progress updates stopped");
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(CHANNEL_ID, "Music", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(c);
            Log.d(TAG, "Notification channel created");
        }
    }

    @Override
    protected void handleOnDestroy() {
        Log.d(TAG, "Plugin destroyed");
        stopProgress();
        if (mediaPlayer != null) mediaPlayer.release();
        if (mediaSession != null) mediaSession.release();
        abandonAudioFocus();
        audioManager = null;
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName", "backup.json");
        String data = call.getString("data", "");

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        bridge.saveCall(call);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent dataIntent = result.getData();
            if (dataIntent != null) {
                Uri uri = dataIntent.getData();
                if (uri != null) {
                    try {
                        OutputStream outputStream = getContext().getContentResolver().openOutputStream(uri);
                        if (outputStream != null) {
                            outputStream.write(Objects.requireNonNull(call.getString("data", "")).getBytes());
                            outputStream.close();
                            JSObject ret = new JSObject();
                            ret.put("uri", uri.toString());
                            call.resolve(ret);
                            return;
                        }
                    } catch (Exception e) {
                        call.reject("Write failed: " + e.getMessage());
                        return;
                    }
                }
            }
        }
        call.reject("User cancelled");
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json"); // 仅显示 JSON 文件
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

        bridge.saveCall(call);
        startActivityForResult(call, intent, "openFileResult");
    }

    @ActivityCallback
    private void openFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent dataIntent = result.getData();
            if (dataIntent != null) {
                Uri uri = dataIntent.getData();
                if (uri != null) {
                    try {
                        InputStream inputStream = getContext().getContentResolver().openInputStream(uri);
                        if (inputStream != null) {
                            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
                            StringBuilder stringBuilder = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                stringBuilder.append(line);
                            }
                            reader.close();
                            inputStream.close();

                            JSObject ret = new JSObject();
                            ret.put("data", stringBuilder.toString());
                            call.resolve(ret);
                            return;
                        }
                    } catch (Exception e) {
                        call.reject("Read failed: " + e.getMessage());
                        return;
                    }
                }
            }
        }
        call.reject("User cancelled");
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        Double rateObj = call.getDouble("rate");
        float rate = (rateObj != null) ? rateObj.floatValue() : 1.0f;
        rate = Math.max(0.5f, Math.min(2.0f, rate));
        this.playbackSpeed = rate;
        applyPlaybackRate(); 
        call.resolve();
    }

    private void applyPlaybackRate() {
        if (mediaPlayer != null && prepared) {
            try {
                PlaybackParams params = new PlaybackParams();
                params.setSpeed(playbackSpeed);
                mediaPlayer.setPlaybackParams(params);
            } catch (Exception e) {
                Log.e(TAG, "Failed to set playback rate", e);
            }
        }
    }

    private interface BitmapCallback {
        void onResult(Bitmap bitmap);
    }

    static class SongItem {
        String url, title, artist, album, cover;
    }
}