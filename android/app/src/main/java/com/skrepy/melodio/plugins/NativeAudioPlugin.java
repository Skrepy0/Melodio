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

import com.getcapacitor.Bridge;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {

    private static final String TAG = "NativeAudio";
    private static final String CHANNEL_ID = "melodio_audio_channel";
    private static final int NOTIF_ID = 1;
    private static final int COVER_CONNECT_TIMEOUT_MS = 5000;
    private static final int COVER_READ_TIMEOUT_MS = 5000;
    /** Hard cap on a downloaded cover so a misbehaving URL cannot exhaust memory. */
    private static final int MAX_COVER_BYTES = 10 * 1024 * 1024;
    private static final String PREFS_NAME = "melodio_playback";
    private static final String KEY_LAST_INDEX = "lastIndex";
    private static final String KEY_LAST_POSITION_MS = "lastPositionMs";
    /**
     * Set to true when the WebView renderer process is destroyed (e.g., app was in
     * background and Android reclaimed memory). When true, all native-to-JS events
     * are suppressed to avoid "Application attempted to call on a destroyed WebView"
     * crashes. Audio keeps playing (MediaPlayer runs in the main app process, not the
     * WebView renderer process), but no JS callbacks are sent until the WebView is
     * recreated when the user returns to the app.
     */
    private static volatile boolean webViewDestroyed = false;
    private static volatile NativeAudioPlugin instance = null;
    private final List<SongItem> playlist = new ArrayList<>();
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private MediaPlayer mediaPlayer;
    private MediaSessionCompat mediaSession;
    private PlaybackStateCompat.Builder stateBuilder;
    private int currentIndex = -1;
    private boolean prepared = false;
    private boolean isPlaying = false;
    private int loadGeneration = 0;
    private PluginCall pendingPlayCall;
    private volatile boolean loading = false;
    private Handler progressHandler;
    private Runnable progressRunnable;
    private String title = "";
    private String artist = "";
    private String album = "";
    private int durationSec = 0;
    private boolean repeatOne = false;
    private float playbackSpeed = 1.0f;
    private final CoverResolver coverResolver = new CoverResolver();
    private Bitmap currentAlbumArt;
    //焦点管理
    private boolean audioFocusEnabled = true;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;
    private boolean audioFocusGranted = false;

    /**
     * Called from MainActivity.onRenderProcessGone to stop all native-to-JS
     * communication before the WebView is destroyed. Audio continues playing.
     */
    public static void onWebViewRendererDestroyed() {
        webViewDestroyed = true;
        if (instance != null) {
            // Progress events stop here, so snapshot the position now.
            instance.persistPlaybackState();
            instance.stopProgress();
        }
        Log.w(TAG, "WebView renderer destroyed - suppressing all native-to-JS events");
    }

    @Override
    public void load() {
        Log.d(TAG, "Plugin loaded, initializing...");
        instance = this;
        webViewDestroyed = false;
        initPlayer();
        initSession();
        createChannel();
    }

    private String resolveFinalUrl(String urlString) throws IOException {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);   // 手动处理，方便调试
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestMethod("HEAD");            // 只获取头部，减少流量
            connection.connect();

            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_TEMP ||
                    status == HttpURLConnection.HTTP_MOVED_PERM ||
                    status == HttpURLConnection.HTTP_SEE_OTHER ||
                    status == 307 || status == 308) {
                String newUrl = connection.getHeaderField("Location");
                if (newUrl != null) {
                    // 递归跟随（最多 5 次，防止死循环）
                    if (connection.getURL().toString().equals(newUrl)) {
                        return newUrl;  // 防止原地跳转
                    }
                    connection.disconnect();
                    return resolveFinalUrl(newUrl);
                }
            }
            // 其他状态码，直接返回原始 URL（可能是最终地址）
            return urlString;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
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
            } else if (currentIndex + 1 < playlist.size()) {
                // Sequential mode: advance while there is a next track.
                nextInternal();
            } else {
                // End of the queue in sequential mode: stop instead of wrapping.
                Log.d(TAG, "Playlist finished (sequential mode)");
                isPlaying = false;
                updateState(false);
                stopProgress();
                notifyPlayState(false);
                persistPlaybackState();
            }
        });

        mediaPlayer.setOnErrorListener((mp, what, extra) -> {
            Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
            rejectPendingCall("MediaPlayer error what=" + what + " extra=" + extra);
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
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
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
            boolean sameTrack = index == currentIndex;
            currentIndex = index;
            Log.d(TAG, "Current index updated to: " + index);
            if (!sameTrack) {
                // The selected track changed without loading it: its progress is
                // unknown, so record a fresh start for the fallback snapshot.
                playbackPrefs().edit()
                        .putInt(KEY_LAST_INDEX, index)
                        .putLong(KEY_LAST_POSITION_MS, 0)
                        .apply();
            }
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

    /**
     * Downloads/decodes an already-resolved cover URL. No lookup happens here:
     * the web layer owns online cover search and passes the final URL with the
     * song data.
     */
    private void loadBitmap(String urlString, BitmapCallback callback) {
        networkExecutor.submit(() -> {
            Bitmap bitmap = null;
            try {
                if (urlString.startsWith("data:")) {
                    String base64Str = urlString.substring(urlString.indexOf(",") + 1);
                    byte[] decodedBytes = android.util.Base64.decode(base64Str, android.util.Base64.DEFAULT);
                    bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                } else if (urlString.startsWith("file://")) {
                    bitmap = BitmapFactory.decodeFile(urlString.substring(7));
                } else if (urlString.startsWith("content://")) {
                    try (InputStream input = getContext().getContentResolver()
                            .openInputStream(Uri.parse(urlString))) {
                        if (input != null) {
                            byte[] bytes = readCapped(input, MAX_COVER_BYTES);
                            if (bytes != null) {
                                bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                            }
                        }
                    }
                } else if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
                    HttpURLConnection connection = null;
                    try {
                        URL url = new URL(urlString);
                        connection = (HttpURLConnection) url.openConnection();
                        connection.setDoInput(true);
                        connection.setConnectTimeout(COVER_CONNECT_TIMEOUT_MS);
                        connection.setReadTimeout(COVER_READ_TIMEOUT_MS);
                        connection.setInstanceFollowRedirects(true);
                        connection.connect();
                        try (InputStream input = connection.getInputStream()) {
                            byte[] bytes = readCapped(input, MAX_COVER_BYTES);
                            if (bytes != null) {
                                bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                            }
                        }
                    } finally {
                        if (connection != null) connection.disconnect();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "loadBitmap failed: " + e.getMessage());
            }
            Bitmap finalBitmap = bitmap;
            new Handler(Looper.getMainLooper()).post(() -> callback.onResult(finalBitmap));
        });
    }

    /** Reads at most {@code maxBytes}; returns null when the limit is exceeded. */
    private static byte[] readCapped(InputStream input, int maxBytes) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int total = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > maxBytes) {
                Log.w(TAG, "Cover download exceeded " + maxBytes + " bytes, aborting");
                return null;
            }
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    @PluginMethod
    public void playIndex(PluginCall call) {
        Integer indexObj = call.getInt("index");
        int index = (indexObj != null) ? indexObj : 0;
        boolean autoPlay = Boolean.TRUE.equals(call.getBoolean("autoPlay", true));

        Log.d(TAG, "playIndex called with index=" + index + ", autoPlay=" + autoPlay + " (playlist size=" + playlist.size() + ")");

        if (index < 0 || index >= playlist.size()) {
            Log.e(TAG, "playIndex: invalid index " + index);
            call.reject("invalid index");
            return;
        }

        // Supersede any previous pending call — only the latest request matters
        rejectPendingCall("superseded by newer playIndex call");

        pendingPlayCall = call;
        loadAndPlay(index, autoPlay);
    }

    private void loadAndPlay(int index, boolean autoPlay) {
        if (index < 0 || index >= playlist.size()) {
            rejectPendingCall("invalid index");
            return;
        }

        loading = true;
        SongItem song = playlist.get(index);
        Log.d(TAG, "loadAndPlay: loading index=" + index + " url=" + song.url + " autoPlay=" + autoPlay);

        loadGeneration++;
        final int gen = loadGeneration;

        prepared = false;
        isPlaying = false;

        networkExecutor.submit(() -> {
            String resolvedUrl = song.url;
            try {
                if (song.url.startsWith("http://") || song.url.startsWith("https://")) {
                    Log.d(TAG, "Resolving final URL for: " + song.url);
                    resolvedUrl = resolveFinalUrl(song.url);
                    Log.d(TAG, "Resolved final URL: " + resolvedUrl);
                }
            } catch (IOException e) {
                Log.e(TAG, "Failed to resolve URL, fallback to original: " + e.getMessage());
                resolvedUrl = song.url;
            }

            final String finalUrl = resolvedUrl;

            new Handler(Looper.getMainLooper()).post(() -> {
                if (gen != loadGeneration) {
                    Log.w(TAG, "Skipping loadAndPlay — superseded (gen=" + gen + " current=" + loadGeneration + ")");
                    loading = false;
                    return;
                }

                try {
                    mediaPlayer.reset();
                    Log.v(TAG, "MediaPlayer reset done");

                    String dataSource = finalUrl;
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
                            Log.w(TAG, "Skipping onPrepared — superseded");
                            loading = false;
                            return;
                        }

                        currentIndex = index;
                        prepared = true;
                        durationSec = mp.getDuration() / 1000;
                        title = song.title;
                        artist = song.artist;
                        album = song.album;

                        updateMetadata(song);

                        if (autoPlay) {
                            mp.start();
                            applyPlaybackRate(true);
                            isPlaying = true;
                            updateState(true);
                            startProgress();
                        } else {
                            isPlaying = false;
                            updateState(false);
                        }

                        notifySongChanged();
                        persistPlaybackState();
                        resolvePendingCall();
                        loading = false;
                    });

                    mediaPlayer.prepareAsync();

                } catch (Exception e) {
                    Log.e(TAG, "Exception in loadAndPlay after resolve: " + finalUrl, e);
                    rejectPendingCall("load failed: " + e.getMessage());
                    loading = false;
                    notifyError(-1, -1);
                    nextInternal();
                }
            });
        });
    }

    /**
     * Resolve the current pending call. Safe to call when none is pending.
     */
    private void resolvePendingCall() {
        if (pendingPlayCall != null) {
            pendingPlayCall.resolve();
            pendingPlayCall = null;
        }
    }

    /**
     * Reject the current pending call with a reason. Safe to call when none is pending.
     */
    private void rejectPendingCall(String reason) {
        if (pendingPlayCall != null) {
            Log.d(TAG, "Rejecting pending call: " + reason);
            pendingPlayCall.reject(reason);
            pendingPlayCall = null;
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
                return;
            }
        }
        if (!mediaPlayer.isPlaying()) {
            mediaPlayer.start();
            applyPlaybackRate(true);
            isPlaying = true;
            updateState(true);
            startProgress();
            notifyPlayState(true);
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
            notifyPlayState(false);
            abandonAudioFocus();
            persistPlaybackState();
            Log.d(TAG, "pauseInternal: paused");
        } else {
            Log.d(TAG, "pauseInternal: already paused");
        }
    }

    private void notifyPlayState(boolean playing) {
        if (isWebViewDestroyed()) {
            Log.d(TAG, "notifyPlayState: WebView destroyed, suppressing event");
            return;
        }
        JSObject data = new JSObject();
        data.put("isPlaying", playing);
        notifyListeners("playStateChange", data);
    }

    /**
     * Check if the WebView has been destroyed. Returns true if either:
     * 1. The plugin's own webViewDestroyed flag is set, OR
     * 2. The bridge's isRendererDestroyed flag is set
     */
    private boolean isWebViewDestroyed() {
        if (webViewDestroyed) return true;
        try {
            Bridge bridge = getBridge();
            if (bridge != null) {
                return bridge.isRendererDestroyed;
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to check bridge renderer state", e);
        }
        return false;
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
        if (!repeatOne && currentIndex + 1 >= playlist.size()) {
            // Sequential mode: the queue is finished, do not wrap around.
            Log.d(TAG, "nextInternal: end of playlist (sequential mode)");
            if (prepared && mediaPlayer.isPlaying()) pauseInternal();
            return;
        }
        int n = (currentIndex + 1) % playlist.size();
        Log.d(TAG, "nextInternal: switching to index=" + n);
        // Notification/MediaSession skips keep the user's current play state
        // instead of forcing playback.
        loadAndPlay(n, isPlaying);
    }

    private void prevInternal() {
        if (playlist.isEmpty()) return;
        if (!repeatOne && currentIndex <= 0) {
            Log.d(TAG, "prevInternal: start of playlist (sequential mode)");
            return;
        }
        int p = (currentIndex - 1 + playlist.size()) % playlist.size();
        Log.d(TAG, "prevInternal: switching to index=" + p);
        loadAndPlay(p, isPlaying);
    }

    private void updateState(boolean playing) {
        if (stateBuilder == null) stateBuilder = new PlaybackStateCompat.Builder();
        long pos = prepared ? mediaPlayer.getCurrentPosition() : 0;
        stateBuilder.setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, pos, 1.0f);
        stateBuilder.setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO);
        mediaSession.setPlaybackState(stateBuilder.build());
    }

    /**
     * Re-reads the current track's metadata. Called by the web layer after it
     * resolves a cover asynchronously, so the notification can pick it up
     * without waiting for the next track change.
     */
    @PluginMethod
    public void refreshCurrentMetadata(PluginCall call) {
        if (!prepared || currentIndex < 0 || currentIndex >= playlist.size()) {
            call.resolve();
            return;
        }
        updateMetadata(playlist.get(currentIndex));
        call.resolve();
    }

    private void updateMetadata(SongItem song) {
        MediaMetadataCompat.Builder b = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, song.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, song.artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, song.album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationSec * 1000L);

        // The JS layer already resolved the cover (local artwork or a web
        // result); anything unusable falls back to the default icon.
        String coverUrl = coverResolver.resolveCoverUrlSync(
                new Song(song.cover, song.title, song.artist));
        loadCover(coverUrl, b);
    }

    private void loadCover(String coverUrl, MediaMetadataCompat.Builder builder) {
        if (coverUrl == null || coverUrl.isEmpty() || CoverResolver.DEFAULT_COVER.equals(coverUrl)) {
            // No usable artwork: keep the session metadata without album art.
            mediaSession.setMetadata(builder.build());
            showNotification();
            return;
        }

        loadBitmap(coverUrl, bitmap -> {
            if (bitmap != null) {
                if (currentAlbumArt != null && !currentAlbumArt.isRecycled()) {
                    currentAlbumArt.recycle();
                }
                currentAlbumArt = bitmap;
                builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap);
            }
            mediaSession.setMetadata(builder.build());
            showNotification();
        });
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
        if (isWebViewDestroyed()) {
            Log.d(TAG, "notifySongChanged: WebView destroyed, suppressing event");
            return;
        }
        JSObject o = new JSObject();
        o.put("index", currentIndex);
        o.put("title", title);
        o.put("artist", artist);
        // Carry the real playback state: the web layer must not assume a track
        // change means "playing" (e.g. after a restore that only prepares).
        o.put("isPlaying", isPlaying);
        o.put("duration", durationSec);
        o.put("position", prepared ? mediaPlayer.getCurrentPosition() / 1000.0 : 0);
        notifyListeners("songChanged", o);
        Log.d(TAG, "songChanged event sent: index=" + currentIndex + " title=" + title + " isPlaying=" + isPlaying);
    }

    /**
     * Snapshot of the native player, used by the web layer to reconcile its
     * persisted state after a WebView reload. When no track is loaded (fresh
     * process) the last state written before shutdown is returned instead.
     */
    @PluginMethod
    public void getState(PluginCall call) {
        JSObject ret = new JSObject();
        if (currentIndex >= 0) {
            ret.put("isPlaying", isPlaying);
            ret.put("currentIndex", currentIndex);
            if (prepared) {
                ret.put("currentPosition", mediaPlayer.getCurrentPosition() / 1000.0);
                ret.put("duration", durationSec);
            } else {
                // Index selected but no track loaded (e.g. after a WebView
                // reload) — use the persisted position only when it belongs to
                // this track.
                android.content.SharedPreferences prefs = playbackPrefs();
                long savedMs = prefs.getInt(KEY_LAST_INDEX, -1) == currentIndex
                        ? prefs.getLong(KEY_LAST_POSITION_MS, 0) : 0;
                ret.put("currentPosition", savedMs / 1000.0);
                ret.put("duration", 0);
            }
        } else {
            android.content.SharedPreferences prefs = playbackPrefs();
            ret.put("isPlaying", false);
            ret.put("currentIndex", prefs.getInt(KEY_LAST_INDEX, -1));
            ret.put("currentPosition", prefs.getLong(KEY_LAST_POSITION_MS, 0) / 1000.0);
            ret.put("duration", 0);
        }
        call.resolve(ret);
    }

    private android.content.SharedPreferences playbackPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /** Best-effort snapshot so playback can be resumed even if JS storage is lost. */
    private void persistPlaybackState() {
        if (currentIndex < 0) return;
        try {
            long positionMs = prepared ? mediaPlayer.getCurrentPosition() : 0;
            playbackPrefs().edit()
                    .putInt(KEY_LAST_INDEX, currentIndex)
                    .putLong(KEY_LAST_POSITION_MS, positionMs)
                    .apply();
        } catch (Exception e) {
            Log.w(TAG, "Failed to persist playback state", e);
        }
    }

    private void notifyError(int w, int e) {
        if (isWebViewDestroyed()) {
            Log.d(TAG, "notifyError: WebView destroyed, suppressing event");
            return;
        }
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
            int ticks = 0;

            @Override
            public void run() {
                if (prepared && isPlaying) {
                    int pos = mediaPlayer.getCurrentPosition();
                    if (!isWebViewDestroyed()) {
                        JSObject o = new JSObject();
                        o.put("position", pos / 1000.0);
                        notifyListeners("timeupdate", o);
                    }
                    // Fallback snapshot roughly every 5s so a process kill
                    // still resumes close to where playback stopped.
                    if (++ticks % 5 == 0) persistPlaybackState();
                    updateState(true);
                    progressHandler.postDelayed(this, 1000);
                }
            }
        };
        progressHandler.post(progressRunnable);
        Log.d(TAG, "Progress updates started");
    }

    private void stopProgress() {
        if (progressHandler != null) {
            progressHandler.removeCallbacksAndMessages(null);
        }
        progressRunnable = null;
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
        persistPlaybackState();
        instance = null;
        webViewDestroyed = false;
        rejectPendingCall("plugin destroyed");
        stopProgress();
        progressHandler = null;
        networkExecutor.shutdownNow();
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (currentAlbumArt != null && !currentAlbumArt.isRecycled()) {
            currentAlbumArt.recycle();
            currentAlbumArt = null;
        }
        abandonAudioFocus();
        audioManager = null;
        focusChangeListener = null;
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
        boolean shouldResume = prepared && mediaPlayer != null && mediaPlayer.isPlaying();
        this.playbackSpeed = rate;
        applyPlaybackRate(shouldResume);
        call.resolve();
    }

    private void applyPlaybackRate(boolean preservePlaybackState) {
        if (mediaPlayer != null && prepared) {
            boolean wasPlaying = mediaPlayer.isPlaying();
            try {
                PlaybackParams params = new PlaybackParams();
                params.setSpeed(playbackSpeed);
                mediaPlayer.setPlaybackParams(params);
                if (preservePlaybackState && wasPlaying && !mediaPlayer.isPlaying()) {
                    mediaPlayer.start();
                }
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