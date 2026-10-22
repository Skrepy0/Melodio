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
import android.media.MediaMetadataRetriever;
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
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.skrepy.melodio.R;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
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
    /**
     * Hard cap on a downloaded cover so a misbehaving URL cannot exhaust memory.
     */
    private static final int MAX_COVER_BYTES = 10 * 1024 * 1024;
    private static final String PREFS_NAME = "melodio_playback";
    private static final String KEY_LAST_INDEX = "lastIndex";
    private static final String KEY_LAST_POSITION_MS = "lastPositionMs";
    /**
     * Identity of the track the saved position belongs to.
     */
    private static final String KEY_LAST_TRACK = "lastTrackKey";
    /**
     * Custom transport actions the notification buttons send to this plugin.
     */
    static final String ACTION_TOGGLE = "com.skrepy.melodio.action.TOGGLE_PLAYBACK";
    static final String ACTION_NEXT = "com.skrepy.melodio.action.SKIP_NEXT";
    static final String ACTION_PREV = "com.skrepy.melodio.action.SKIP_PREVIOUS";
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
    /**
     * URL resolution for playback. Kept separate from cover downloads so a slow
     * image can never delay a track change.
     */
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    /**
     * Cover downloads, which may take seconds on a slow connection.
     */
    private final ExecutorService coverExecutor = Executors.newFixedThreadPool(2);
    private MediaPlayer mediaPlayer;
    private MediaSessionCompat mediaSession;
    private PlaybackStateCompat.Builder stateBuilder;
    private int currentIndex = -1;
    private boolean prepared = false;
    private boolean isPlaying = false;
    private int loadGeneration = 0;
    /**
     * Bumped on every track change and on every {@code refreshCurrentMetadata}
     * call. A cover download started for an older generation must not overwrite
     * the metadata of the track that is playing now.
     */
    private final GenerationGate metadataGeneration = new GenerationGate();
    private PluginCall pendingPlayCall;
    private volatile boolean loading = false;
    private Handler progressHandler;
    private Runnable progressRunnable;
    private NativeLyricsRepository lyricsRepository;
    private LyricTimeline lyricTimeline = LyricTimeline.EMPTY;
    private int lyricsGeneration;
    private boolean lyricsEnabled = true;
    private boolean lyricsOnline = true;
    private int lyricsRetries = 2;
    private String lyricsEndpoint = "https://api.qijieya.cn/meting/";
    private String currentLyric = "";
    private MediaMetadataCompat baseMetadata;
    private Runnable lyricsRunnable;
    private String title = "";
    private String artist = "";
    private String album = "";
    private int durationSec = 0;
    private boolean repeatOne = false;
    private float playbackSpeed = 1.0f;
    private final CoverResolver coverResolver = new CoverResolver();
    /**
     * Memory + disk cache for decoded artwork, so a track change skips IO.
     */
    private CoverBitmapCache coverCache;
    private Bitmap currentAlbumArt;
    private boolean playQueueRepeat = true;
    //焦点管理
    private boolean audioFocusEnabled = true;
    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;
    private boolean audioFocusGranted = false;
    /**
     * True while playback is paused only because another app took audio focus.
     */
    private boolean pausedForFocusLoss = false;
    /**
     * True while the volume is lowered for a transient duck request.
     */
    private boolean ducked = false;
    /**
     * True when play was requested but the focus request was refused.
     */
    private boolean pendingFocusPlayback = false;

    @PluginMethod
    public void getEmbeddedCover(PluginCall call) {
        String uri = call.getString("uri");
        String key = call.getString("key");
        if (uri == null || key == null) {
            call.reject("missing uri/key");
            return;
        }

        File cacheFile = new File(getContext().getCacheDir(), "covers/" + key + ".jpg");
        if (cacheFile.isFile()) {
            call.resolve(new JSObject().put("path", "file://" + cacheFile.getAbsolutePath()));
            return;
        }

        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            mmr.setDataSource(getContext(), Uri.parse(uri));
            byte[] art = mmr.getEmbeddedPicture();
            if (art == null) {
                call.resolve(new JSObject());
                return;
            }
            File parent = cacheFile.getParentFile();
            if (parent != null) parent.mkdirs();

            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(art);
            }
            call.resolve(new JSObject().put("path", "file://" + cacheFile.getAbsolutePath()));
        } catch (Exception e) {
            Log.w(TAG, "getEmbeddedCover failed for " + uri, e);
            cacheFile.delete();
            call.resolve(new JSObject());
        } finally {
            try {
                mmr.release();
            } catch (IOException ignored) {
            }
        }
    }

    /**
     * Called from MainActivity.onRenderProcessGone to stop all native-to-JS
     * communication before the WebView is destroyed. Audio continues playing.
     */
    public static void onWebViewRendererDestroyed() {
        webViewDestroyed = true;
        if (instance != null) {
            // Keep the native playback/lyrics clocks alive; only JS events are suppressed.
            instance.persistPlaybackState();
        }
        Log.w(TAG, "WebView renderer destroyed - suppressing all native-to-JS events");
    }

    @Override
    public void load() {
        Log.d(TAG, "Plugin loaded, initializing...");
        instance = this;
        webViewDestroyed = false;
        coverCache = new CoverBitmapCache(getContext().getCacheDir());
        lyricsRepository = new NativeLyricsRepository(getContext().getSharedPreferences("melodio_lyrics_cache", Context.MODE_PRIVATE));
        android.content.SharedPreferences lyricSettings = getContext().getSharedPreferences("melodio_lyrics_settings", Context.MODE_PRIVATE);
        lyricsEnabled = lyricSettings.getBoolean("enabled", true);
        lyricsOnline = lyricSettings.getBoolean("online", true);
        lyricsRetries = lyricSettings.getInt("retries", 2);
        lyricsEndpoint = lyricSettings.getString("endpoint", lyricsEndpoint);
        initPlayer();
        initSession();
        createChannel();
    }

    private String resolveFinalUrl(String urlString) throws IOException {
        return RedirectResolver.follow(urlString, this::redirectTarget);
    }

    /**
     * Looks up the next hop for a URL, or null when it is already final.
     */
    private String redirectTarget(String urlString) throws IOException {
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
                    // Servers may send a relative Location; resolve it against
                    // the URL we just queried.
                    return new URL(url, newUrl).toString();
                }
            }
            // Any other status: the URL is final as far as we can tell.
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void initPlayer() {
        mediaPlayer = new MediaPlayer();
        mediaPlayer.setWakeMode(getContext(), android.os.PowerManager.PARTIAL_WAKE_LOCK);
        mediaPlayer.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());

        mediaPlayer.setOnSeekCompleteListener(mp -> updateCurrentLyric(currentPositionMs()));
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
                if (!playQueueRepeat) {
                    // End of the queue in sequential mode: stop instead of wrapping.
                    Log.d(TAG, "Playlist finished (sequential mode)");
                    isPlaying = false;
                    updateState(false);
                    stopProgress();
                    notifyPlayState(false);
                    persistPlaybackState();
                    // Nothing is playing any more, so the notification becomes a
                    // plain paused card rather than an ongoing playback control.
                    showNotification(false);
                } else {
                    nextInternal();
                }
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
                    pausedForFocusLoss = false;
                    unduck();
                    pauseInternal();
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    // Another app took focus briefly (a call, a video). Pause and
                    // remember that the pause was not the user's choice, so
                    // AUDIOFOCUS_GAIN can resume it.
                    unduck();
                    if (isPlaying) {
                        pausedForFocusLoss = true;
                        pauseInternal();
                    }
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    // Stay playing, just quieter, while the other source talks.
                    duck();
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    // Focus is ours again (this callback is the grant itself).
                    audioFocusGranted = true;
                    unduck();
                    if (pausedForFocusLoss) {
                        pausedForFocusLoss = false;
                        playInternal();
                    } else if (pendingFocusPlayback) {
                        // The earlier play request was refused; the system has
                        // now granted focus, so honour it.
                        pendingFocusPlayback = false;
                        playInternal();
                    }
                    break;
            }
        };
    }

    private void duck() {
        if (!prepared || !isPlaying || ducked) return;
        try {
            mediaPlayer.setVolume(0.2f, 0.2f);
            ducked = true;
        } catch (IllegalStateException e) {
            Log.w(TAG, "duck failed", e);
        }
    }

    private void unduck() {
        if (!ducked) return;
        try {
            if (prepared) mediaPlayer.setVolume(1.0f, 1.0f);
        } catch (IllegalStateException e) {
            Log.w(TAG, "unduck failed", e);
        }
        ducked = false;
    }

    private void requestAudioFocus() {
        if (!audioFocusEnabled) {
            audioFocusGranted = true;
            return;
        }
        if (audioManager == null) return;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes audioAttributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
            AudioFocusRequest focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setOnAudioFocusChangeListener(focusChangeListener)
                    // A call in progress may delay the grant instead of
                    // refusing it. Accepting the delay means the system sends
                    // AUDIOFOCUS_GAIN when the call ends, which is exactly the
                    // callback playInternal's retry waits for.
                    .setAcceptsDelayedFocusGain(true)
                    .build();
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(focusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
        // GRANTED only. DELAYED is not permission to start: the grant arrives
        // later through focusChangeListener.
        audioFocusGranted = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        Log.d(TAG, "AudioFocus requested: granted=" + audioFocusGranted + " result=" + result);
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

    @PluginMethod
    public void setPlayQueueRepeat(PluginCall call) {
        this.playQueueRepeat = Boolean.TRUE.equals(call.getBoolean("enabled", true));
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
                if (prepared) {
                    mediaPlayer.seekTo((int) pos);
                    updateCurrentLyric(pos);
                }
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
                        .putString(KEY_LAST_TRACK, trackKey(index))
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
                s.lyric = o.isNull("lyric") ? "" : o.optString("lyric", "");
                s.duration = o.optLong("duration", 0);
                Log.d(TAG, "s.cover:" + s.cover);
                playlist.add(s);
            } catch (Exception e) {
                Log.w(TAG, "Failed to parse song at index " + i, e);
            }
        }

        if (currentIndex < 0 || currentIndex >= playlist.size()) {
            currentIndex = -1;
        }

        if (playlist.isEmpty()) {
            // The queue was cleared (e.g. the web layer emptied it). Leaving a
            // notification pointing at a track that no longer exists is worse
            // than removing it, and audio must not outlive its queue.
            // Supersede any load still in flight so its onPrepared callback
            // cannot start a track that is no longer in the queue.
            loadGeneration++;
            resetLyrics(null);
            baseMetadata = null;
            metadataGeneration.next();
            rejectPendingCall("playlist cleared");
            if (prepared && mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) mediaPlayer.pause();
                    mediaPlayer.reset();
                } catch (IllegalStateException e) {
                    Log.w(TAG, "Failed to reset player for empty playlist", e);
                }
                prepared = false;
            }
            isPlaying = false;
            pausedForFocusLoss = false;
            pendingFocusPlayback = false;
            updateState(false);
            stopProgress();
            cancelNotification();
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
        coverExecutor.submit(() -> {
            // A decoded, notification-sized bitmap is the whole product of the
            // work below; serve it from memory (or disk) when a previous track
            // change already paid for it.
            Bitmap cached = coverCache != null ? coverCache.get(urlString) : null;
            if (cached != null) {
                Log.d(TAG, "loadBitmap: cache hit");
                new Handler(Looper.getMainLooper()).post(() -> callback.onResult(cached));
                return;
            }

            Bitmap bitmap = null;
            try {
                if (urlString.startsWith("data:")) {
                    String base64Str = urlString.substring(urlString.indexOf(",") + 1);
                    byte[] decodedBytes = android.util.Base64.decode(base64Str, android.util.Base64.DEFAULT);
                    bitmap = decodeSampled(decodedBytes);
                } else if (urlString.startsWith("file://")) {
                    bitmap = decodeFileUri(urlString);
                } else if (urlString.startsWith("content://")) {
                    try (InputStream input = getContext().getContentResolver()
                            .openInputStream(Uri.parse(urlString))) {
                        if (input != null) {
                            byte[] bytes = readCapped(input, MAX_COVER_BYTES);
                            if (bytes != null) {
                                bitmap = decodeSampled(bytes);
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
                                bitmap = decodeSampled(bytes);
                            }
                        }
                    } finally {
                        if (connection != null) connection.disconnect();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "loadBitmap failed: " + e.getMessage());
            }
            // Even a sampled decode can be larger than the notification needs.
            if (bitmap != null) {
                bitmap = scaleDownArtwork(bitmap);
                if (coverCache != null) coverCache.put(urlString, bitmap);
            }
            Bitmap finalBitmap = bitmap;
            new Handler(Looper.getMainLooper()).post(() -> callback.onResult(finalBitmap));
        });
    }

    /**
     * Decodes an image at a reduced sample size.
     *
     * <p>Embedded artwork in a music file is frequently 2000–4000 px on a side.
     * Decoding that at full resolution costs tens of megabytes for a bitmap
     * that is shown at ~300 px — and when the allocation fails, the artwork
     * silently disappears from the notification. Reading the bounds first and
     * downsampling avoids both the memory spike and the failure.</p>
     */
    private static Bitmap decodeSampled(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = ArtworkSampler.sampleSizeFor(bounds.outWidth, bounds.outHeight);
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    }

    /**
     * Downscales artwork to a size the notification can carry comfortably.
     */
    private static Bitmap scaleDownArtwork(Bitmap source) {
        int max = ArtworkSampler.TARGET_PX;
        int width = source.getWidth();
        int height = source.getHeight();
        if (width <= max && height <= max) return source;

        float ratio = Math.min((float) max / width, (float) max / height);
        int targetW = Math.max(1, Math.round(width * ratio));
        int targetH = Math.max(1, Math.round(height * ratio));
        Bitmap scaled = Bitmap.createScaledBitmap(source, targetW, targetH, true);
        if (scaled != source && !source.isRecycled()) source.recycle();
        return scaled;
    }

    /**
     * Decodes a {@code file://} URI into a bitmap.
     *
     * <p>The web layer percent-encodes paths before handing them over (spaces,
     * CJK, brackets are common in music folders). Decoding is required, or the
     * lookup silently misses and the notification shows no artwork. The
     * {@code Uri} path is used rather than naive substring handling so Windows
     * style {@code file:///} and authority-less forms both work.</p>
     */
    private static Bitmap decodeFileUri(String fileUri) {
        String path = fileUri.substring("file://".length());
        if (path.startsWith("/")) path = path.substring(1);
        try {
            path = Uri.decode(path);
        } catch (Exception e) {
            Log.w(TAG, "Malformed file URI: " + fileUri);
            return null;
        }
        if (!path.startsWith("/")) path = "/" + path;
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = ArtworkSampler.sampleSizeFor(bounds.outWidth, bounds.outHeight);
        return BitmapFactory.decodeFile(path, options);
    }

    /**
     * Reads at most {@code maxBytes}; returns null when the limit is exceeded.
     */
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
        playQueueRepeat = Boolean.TRUE.equals(call.getBoolean("playQueueRepeat", true));
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
        resetLyrics(song);
        Log.d(TAG, "loadAndPlay: loading index=" + index + " url=" + song.url + " autoPlay=" + autoPlay);

        loadGeneration++;
        final int gen = loadGeneration;
        // Invalidate any cover still downloading for the previous track: it
        // must not publish its metadata once this track takes over.
        metadataGeneration.next();

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
                        requestCurrentLyrics(song);

                        if (autoPlay) {
                            mp.start();
                            applyPlaybackRate(true);
                            unduck();
                            isPlaying = true;
                            pausedForFocusLoss = false;
                            updateState(true);
                            startProgress();
                        } else {
                            isPlaying = false;
                            updateState(false);
                        }

                        // `updateMetadata` above may already have posted the
                        // notification (when the cover is a local file it
                        // resolves synchronously). Post it again once the play
                        // state is final so the transport button and the
                        // ongoing flag match reality.
                        showNotification(isPlaying);

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
                // The system refused or delayed focus. Tell the web layer rather
                // than silently dropping the request, and retry once the
                // AUDIOFOCUS_GAIN callback arrives.
                Log.w(TAG, "playInternal: audio focus not granted, deferring playback");
                pendingFocusPlayback = true;
                notifyFocusDenied();
                return;
            }
        }
        if (!mediaPlayer.isPlaying()) {
            mediaPlayer.start();
            applyPlaybackRate(true);
            unduck();
            isPlaying = true;
            pausedForFocusLoss = false;
            pendingFocusPlayback = false;
            updateState(true);
            startProgress();
            if (lyricsEnabled && lyricTimeline.lines.isEmpty() && currentIndex >= 0 && currentIndex < playlist.size()) requestCurrentLyrics(playlist.get(currentIndex));
            notifyPlayState(true);
            showNotification(true);
            Log.d(TAG, "playInternal: started playback");
        } else {
            Log.d(TAG, "playInternal: already playing");
        }
    }

    private void notifyFocusDenied() {
        if (isWebViewDestroyed()) return;
        JSObject o = new JSObject();
        o.put("reason", "audioFocusDenied");
        notifyListeners("audioFocusDenied", o);
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
            // A pause caused by transient focus loss must keep the focus
            // request alive: abandoning it would also cancel the
            // AUDIOFOCUS_GAIN callback that is supposed to resume playback.
            if (!pausedForFocusLoss) abandonAudioFocus();
            persistPlaybackState();
            // Re-post the notification as a paused card: it stays visible so
            // the user can resume from it, but it is no longer ongoing.
            showNotification(false);
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
            updateCurrentLyric(msec);
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
        pausedForFocusLoss = false;
        unduck();
        updateState(false);
        stopProgress();
        abandonAudioFocus();
        resetLyrics(null);
        cancelNotification();
        call.resolve();
    }

    private void nextInternal() {
        if (playlist.isEmpty()) return;
        if (!repeatOne && currentIndex + 1 >= playlist.size() && !playQueueRepeat) {
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
        if (!repeatOne && currentIndex <= 0 && !playQueueRepeat) {
            Log.d(TAG, "prevInternal: start of playlist (sequential mode)");
            return;
        }
        int p = (currentIndex - 1 + playlist.size()) % playlist.size();
        Log.d(TAG, "prevInternal: switching to index=" + p);
        loadAndPlay(p, isPlaying);
    }

    private void updateState(boolean playing) {
        if (stateBuilder == null) stateBuilder = new PlaybackStateCompat.Builder();
        // Read the position defensively: MediaPlayer throws when queried after
        // an error or reset, and a lock screen must never crash the app.
        long pos = currentPositionMs();
        // The speed matters: lock screens and car head units extrapolate the
        // progress bar from position + speed, so a hardcoded 1.0 drifts.
        stateBuilder.setState(
                playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                pos,
                playbackSpeed);
        stateBuilder.setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO);
        mediaSession.setPlaybackState(stateBuilder.build());
    }

    @PluginMethod
    public void importLyricsCache(PluginCall call) {
        try {
            JSArray entries = call.getArray("entries");
            if (entries == null) { call.reject("entries required"); return; }
            lyricsRepository.importCache(entries);
            call.resolve();
        } catch (Exception error) { call.reject("Cache migration failed", error); }
    }
    @PluginMethod
    public void listLyricsCache(PluginCall call) {
        JSObject result = new JSObject();
        result.put("entries", lyricsRepository.listCache());
        call.resolve(result);
    }
    @PluginMethod
    public void readLyricsCache(PluginCall call) {
        JSObject result = new JSObject();
        result.put("lyrics", lyricsRepository.readCache(call.getString("id")));
        call.resolve(result);
    }
    @PluginMethod
    public void deleteLyricsCache(PluginCall call) {
        lyricsRepository.deleteCache(call.getString("id"));
        call.resolve();
    }
    @PluginMethod
    public void clearLyricsCache(PluginCall call) {
        lyricsRepository.clearCache();
        call.resolve();
    }

    @PluginMethod
    public void configureLyrics(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        boolean online = Boolean.TRUE.equals(call.getBoolean("online", true));
        int retries = Math.max(0, Math.min(10, call.getInt("retryCount", 2)));
        String endpoint = call.getString("metingApi", lyricsEndpoint);
        new Handler(Looper.getMainLooper()).post(() -> {
            boolean changed = enabled != lyricsEnabled || online != lyricsOnline || retries != lyricsRetries || !Objects.equals(endpoint, lyricsEndpoint);
            lyricsEnabled = enabled;
            lyricsOnline = online;
            lyricsRetries = retries;
            lyricsEndpoint = endpoint;
            getContext().getSharedPreferences("melodio_lyrics_settings", Context.MODE_PRIVATE).edit()
                    .putBoolean("enabled", enabled).putBoolean("online", online)
                    .putInt("retries", retries).putString("endpoint", endpoint).apply();
            if (changed) {
                lyricsRepository.cancelAll();
                SongItem song = prepared && currentIndex >= 0 && currentIndex < playlist.size() ? playlist.get(currentIndex) : null;
                resetLyrics(song);
                if (song != null && enabled) requestCurrentLyrics(song);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void lookupLyrics(PluginCall call) {
        JSObject song = call.getObject("song");
        if (song == null) { call.reject("song required"); return; }
        NativeLyricsRepository.Query query = new NativeLyricsRepository.Query(
                song.optString("url", ""), song.optString("title", ""), song.optString("artist", ""),
                song.optString("album", ""), song.isNull("lyric") ? "" : song.optString("lyric", ""), song.optLong("duration", 0));
        lyricsRepository.load(query, Boolean.TRUE.equals(call.getBoolean("online", true)),
                call.getInt("retryCount", 2), call.getString("metingApi", lyricsEndpoint)).whenComplete((timeline, error) -> {
            if (isWebViewDestroyed()) return;
            if (error != null) { call.reject("Lyrics lookup failed", new Exception(error)); return; }
            JSArray lines = new JSArray();
            for (LyricTimeline.Line line : timeline.lines) {
                JSObject row = new JSObject();
                row.put("time", line.timeMs / 1000.0);
                row.put("text", line.text);
                lines.put(row);
            }
            JSObject result = new JSObject();
            result.put("lines", lines);
            call.resolve(result);
        });
    }

    private void resetLyrics(SongItem song) {
        lyricsGeneration++;
        if (song == null) lyricsRepository.cancelAll();
        else lyricsRepository.cancelExcept(song.lyricQuery());
        lyricTimeline = LyricTimeline.EMPTY;
        currentLyric = "";
        if (baseMetadata != null) publishLyricsMetadata();
    }

    private void requestCurrentLyrics(SongItem song) {
        if (!lyricsEnabled) return;
        final int generation = lyricsGeneration;
        lyricsRepository.load(song.lyricQuery(), lyricsOnline, lyricsRetries, lyricsEndpoint).whenComplete((timeline, error) ->
                new Handler(Looper.getMainLooper()).post(() -> {
                    if (generation != lyricsGeneration || !lyricsEnabled || !prepared || error != null) return;
                    lyricTimeline = timeline;
                    updateCurrentLyric(currentPositionMs());
                }));
    }

    private void updateCurrentLyric(long positionMs) {
        String next = lyricsEnabled ? lyricTimeline.textAt(positionMs) : "";
        if (Objects.equals(next, currentLyric)) return;
        currentLyric = next;
        publishLyricsMetadata();
    }

    private void publishLyricsMetadata() {
        if (mediaSession == null || baseMetadata == null) return;
        String subtitle = currentLyric.isEmpty() ? artist : currentLyric;
        mediaSession.setMetadata(new MediaMetadataCompat.Builder(baseMetadata)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, subtitle)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, subtitle)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, album)
                .putString("com.skrepy.melodio.ORIGINAL_ARTIST", artist)
                .build());
        showNotification(isPlaying);
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

    /**
     * Drops the decoded-artwork cache (memory and disk) when the web layer
     * clears its cover cache, so the two tiers cannot disagree about which
     * covers are still known.
     */
    @PluginMethod
    public void clearCoverCache(PluginCall call) {
        if (coverCache != null) coverCache.clear();
        currentAlbumArt = null;
        call.resolve();
    }

    /**
     * Publishes the track's metadata to the MediaSession and the notification.
     *
     * <p>Artwork is downloaded asynchronously. The generation captured here is
     * checked again when the bitmap arrives: a cover that finishes after the
     * user has skipped to another track is dropped instead of overwriting the
     * new track's metadata.</p>
     */
    private void updateMetadata(SongItem song) {
        updateMetadata(song, metadataGeneration.next());
    }

    private void updateMetadata(SongItem song, int generation) {
        MediaMetadataCompat.Builder b = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, song.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, song.artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, song.album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationSec * 1000L);
        // Publish text immediately; slow artwork must not delay a lyric/track change.
        currentAlbumArt = null;
        baseMetadata = b.build();
        publishLyricsMetadata();


        // The JS layer already resolved the cover (local artwork or a web
        // result); anything unusable falls back to the default icon.
        String coverUrl = coverResolver.resolveCoverUrlSync(
                new Song(song.cover, song.title, song.artist));
        loadCover(coverUrl, song.url, b, generation);
    }

    private void loadCover(String coverUrl, String trackUrl, MediaMetadataCompat.Builder builder,
                           int generation) {
        if (coverUrl == null || coverUrl.isEmpty() || CoverResolver.DEFAULT_COVER.equals(coverUrl)) {
            // No usable artwork reference: the track file may still carry an
            // embedded picture. Fall back to the default icon when it does not.
            loadEmbeddedArtwork(trackUrl, builder, generation);
            return;
        }

        loadBitmap(coverUrl, bitmap -> {
            if (metadataGeneration.isStale(generation)) {
                Log.d(TAG, "Dropping stale cover (gen=" + generation + " current=" + metadataGeneration.current() + ")");
                return;
            }
            if (bitmap == null) {
                // A MediaStore album-art URI can point at an entry that no
                // longer exists ("No album art found"). The picture embedded in
                // the audio file is still valid, so try that before giving up.
                loadEmbeddedArtwork(trackUrl, builder, generation);
                return;
            }
            applyMetadata(builder, generation, bitmap);
        });
    }

    /**
     * Reads the artwork embedded in the track itself.
     *
     * <p>MediaStore's album-art table is frequently empty even for files that
     * carry a picture tag, so the {@code content://…/albumart} URI fails with
     * "No album art found" and the notification shows no cover. Reading the tag
     * from the file avoids depending on that index entirely.</p>
     */
    private void loadEmbeddedArtwork(String trackUrl, MediaMetadataCompat.Builder builder,
                                     int generation) {
        if (trackUrl == null || trackUrl.isEmpty()) {
            applyMetadata(builder, generation, null);
            return;
        }
        coverExecutor.submit(() -> {
            Bitmap cached = coverCache != null ? coverCache.get(trackUrl) : null;
            if (cached != null) {
                new Handler(Looper.getMainLooper()).post(() -> applyMetadata(builder, generation, cached));
                return;
            }

            Bitmap bitmap = null;
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                if (trackUrl.startsWith("file://")) {
                    retriever.setDataSource(Uri.decode(trackUrl.substring("file://".length())));
                } else if (trackUrl.startsWith("content://")) {
                    retriever.setDataSource(getContext(), Uri.parse(trackUrl));
                } else {
                    retriever.setDataSource(trackUrl);
                }
                byte[] picture = retriever.getEmbeddedPicture();
                if (picture != null) {
                    bitmap = decodeSampled(picture);
                }
            } catch (Exception e) {
                Log.w(TAG, "No embedded artwork: " + e.getMessage());
            } finally {
                try {
                    retriever.release();
                } catch (Exception ignored) {
                    // Nothing useful to do if the retriever is already closed.
                }
            }
            if (bitmap != null) {
                bitmap = scaleDownArtwork(bitmap);
                // Keyed by the track URL: an embedded picture belongs to the
                // file, so the same key can never mean different artwork.
                if (coverCache != null) coverCache.put(trackUrl, bitmap);
            }
            Bitmap finalBitmap = bitmap;
            new Handler(Looper.getMainLooper()).post(
                    () -> applyMetadata(builder, generation, finalBitmap));
        });
    }

    /**
     * Publishes metadata and refreshes the notification.
     *
     * <p>Artwork is never recycled here: a bitmap may be shared with
     * {@link CoverBitmapCache} or still be held by the notification, and
     * freeing it early shows up as a blank cover or a crash. Dropping the
     * reference is enough — the cache bounds memory and the GC reclaims the
     * rest.</p>
     */
    private void applyMetadata(MediaMetadataCompat.Builder builder, int generation, Bitmap bitmap) {
        if (metadataGeneration.isStale(generation)) return;
        if (bitmap != null) {
            // Android 13+ reads artwork from the session metadata; older
            // versions read the notification's large icon (set in
            // showNotification). Publish under both keys so every API level
            // and every surface (lock screen, car, notification) finds it.
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap);
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap);
        }
        currentAlbumArt = bitmap;
        baseMetadata = builder.build();
        publishLyricsMetadata();
    }

    /**
     * Builds the media notification with transport actions.
     *
     * <p>Android 13+ draws the media controls from the MediaSession itself, but
     * Android 8–12 render only the actions attached to the notification — hence
     * the explicit play/pause, previous and next entries.</p>
     *
     * @param ongoing true while playing: the notification is ongoing so it
     *                cannot be swiped away mid-playback.
     */
    private void showNotification(boolean ongoing) {
        if (!canPostNotification()) {
            // Media-session notifications are exempt from POST_NOTIFICATIONS on
            // Android 13+, so this is not fatal: attempt the post anyway and
            // let the SecurityException path below report a real refusal.
            Log.w(TAG, "POST_NOTIFICATIONS not granted; attempting media notification anyway");
        }
        // The activity may be gone (backgrounded, or a WebView reload while
        // audio kept playing). A launch intent still opens the app, so the
        // notification is useful either way.
        Activity activity = getActivity();
        Intent intent = activity != null
                ? new Intent(getContext(), activity.getClass())
                : getContext().getPackageManager()
                .getLaunchIntentForPackage(getContext().getPackageName());
        if (intent == null) {
            Log.w(TAG, "No activity to open from the notification");
            return;
        }
        PendingIntent pi = PendingIntent.getActivity(getContext(), 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Android 8–12 draw the artwork as the notification's large icon; the
        // MediaStyle/MediaSession path alone leaves them blank.
        Bitmap art = (currentAlbumArt != null && !currentAlbumArt.isRecycled())
                ? currentAlbumArt : null;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_music)
                .setLargeIcon(art)
                .setContentTitle(title)
                .setContentText(currentLyric.isEmpty() ? artist : currentLyric)
                .setContentIntent(pi)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOnlyAlertOnce(true)
                .setOngoing(ongoing)
                .setShowWhen(false)
                .addAction(transportAction(R.drawable.ic_skip_previous,
                        getContext().getString(R.string.media_action_previous), ACTION_PREV))
                .addAction(isPlaying
                        ? transportAction(R.drawable.ic_pause,
                        getContext().getString(R.string.media_action_pause), ACTION_TOGGLE)
                        : transportAction(R.drawable.ic_play,
                        getContext().getString(R.string.media_action_play), ACTION_TOGGLE))
                .addAction(transportAction(R.drawable.ic_skip_next,
                        getContext().getString(R.string.media_action_next), ACTION_NEXT))
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        // Compact view: previous, play/pause, next — in the
                        // order they were added above.
                        .setShowActionsInCompactView(0, 1, 2));

        android.app.Notification n = builder.build();
        try {
            NotificationManagerCompat.from(getContext()).notify(NOTIF_ID, n);
            if (isPlaying) PlaybackService.publish(getContext(), n);
            else PlaybackService.update(n);
        } catch (SecurityException | IllegalStateException e) {
            Log.e(TAG, "Notification/foreground service failed", e);
        }
    }

    private NotificationCompat.Action transportAction(int icon, String label, String action) {
        Intent intent = new Intent(getContext(), TransportReceiver.class).setAction(action);
        PendingIntent pi = PendingIntent.getBroadcast(
                getContext(),
                action.hashCode(),
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Action(icon, label, pi);
    }

    private void cancelNotification() {
        PlaybackService.stop(getContext());
        try {
            NotificationManagerCompat.from(getContext()).cancel(NOTIF_ID);
        } catch (Exception e) {
            Log.w(TAG, "Failed to cancel notification", e);
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
        if (!enabled) {
            // Focus management is off: treat playback as always authorised.
            audioFocusGranted = true;
        }
        Log.d(TAG, "Audio focus enabled: " + enabled);
        call.resolve();
    }

    /**
     * Applies a transport command sent from the notification buttons or the
     * headset. Called on the main thread by {@link TransportReceiver}.
     */
    static void handleTransportAction(String action) {
        NativeAudioPlugin plugin = instance;
        if (plugin == null || action == null) {
            Log.w(TAG, "Transport action with no live plugin: " + action);
            return;
        }
        switch (action) {
            case ACTION_TOGGLE:
                if (plugin.isPlaying) plugin.pauseInternal();
                else plugin.playInternal();
                break;
            case ACTION_NEXT:
                plugin.nextInternal();
                break;
            case ACTION_PREV:
                plugin.prevInternal();
                break;
            default:
                Log.w(TAG, "Unknown transport action: " + action);
        }
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
        o.put("position", currentPositionMs() / 1000.0);
        notifyListeners("songChanged", o);
        Log.d(TAG, "songChanged event sent: index=" + currentIndex + " title=" + title + " isPlaying=" + isPlaying);
    }

    /**
     * Current position in milliseconds, or 0 when the player is not in a state
     * that can report one (reset, errored). MediaPlayer throws
     * {@link IllegalStateException} rather than returning a sentinel.
     */
    private long currentPositionMs() {
        if (!prepared || mediaPlayer == null) return 0;
        try {
            return mediaPlayer.getCurrentPosition();
        } catch (IllegalStateException e) {
            Log.w(TAG, "getCurrentPosition failed", e);
            return 0;
        }
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
                ret.put("currentPosition", currentPositionMs() / 1000.0);
                ret.put("duration", durationSec);
            } else {
                // Index selected but no track loaded (e.g. after a WebView
                // reload) — use the persisted position only when it belongs to
                // this track.
                long savedMs = savedPositionFor(currentIndex);
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

    /**
     * Best-effort snapshot so playback can be resumed even if JS storage is lost.
     */
    private void persistPlaybackState() {
        if (currentIndex < 0) return;
        try {
            long positionMs = currentPositionMs();
            playbackPrefs().edit()
                    .putInt(KEY_LAST_INDEX, currentIndex)
                    .putLong(KEY_LAST_POSITION_MS, positionMs)
                    // The index alone is not an identity: the queue can be
                    // reordered or replaced between sessions, and restoring the
                    // old position onto a different song is worse than
                    // restarting from zero.
                    .putString(KEY_LAST_TRACK, trackKey(currentIndex))
                    .apply();
        } catch (Exception e) {
            Log.w(TAG, "Failed to persist playback state", e);
        }
    }

    /**
     * Stable identity for the track at {@code index}; empty when unknown.
     */
    private String trackKey(int index) {
        if (index < 0 || index >= playlist.size()) return "";
        String url = playlist.get(index).url;
        return url == null ? "" : url;
    }

    /**
     * The saved position, but only when it was written for the same track the
     * queue now holds at {@code index}.
     */
    private long savedPositionFor(int index) {
        android.content.SharedPreferences prefs = playbackPrefs();
        if (prefs.getInt(KEY_LAST_INDEX, -1) != index) return 0;
        String savedKey = prefs.getString(KEY_LAST_TRACK, "");
        String currentKey = trackKey(index);
        if (savedKey != null && !savedKey.isEmpty() && !currentKey.isEmpty()
                && !savedKey.equals(currentKey)) {
            Log.d(TAG, "Saved position belongs to a different track, discarding");
            return 0;
        }
        return prefs.getLong(KEY_LAST_POSITION_MS, 0);
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
                    long pos = currentPositionMs();
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
        lyricsRunnable = new Runnable() {
            @Override public void run() {
                if (!prepared || !isPlaying) return;
                if (lyricsEnabled) updateCurrentLyric(currentPositionMs());
                progressHandler.postDelayed(this, 200);
            }
        };
        progressHandler.post(lyricsRunnable);
        Log.d(TAG, "Progress updates started");
    }

    private void stopProgress() {
        if (progressHandler != null) {
            progressHandler.removeCallbacksAndMessages(null);
        }
        progressRunnable = null;
        lyricsRunnable = null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(CHANNEL_ID, getContext().getString(R.string.media_channel_name), NotificationManager.IMPORTANCE_LOW);
            // A playback notification should be silent and un-intrusive, and it
            // must not be blocked by the user's "silent" mode.
            c.setShowBadge(false);
            c.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(c);
            Log.d(TAG, "Notification channel created");
        }
    }

    @Override
    protected void handleOnDestroy() {
        Log.d(TAG, "Plugin destroyed");
        persistPlaybackState();
        cancelNotification();
        instance = null;
        webViewDestroyed = false;
        rejectPendingCall("plugin destroyed");
        stopProgress();
        progressHandler = null;
        if (lyricsRepository != null) lyricsRepository.close();
        lyricsGeneration++;
        networkExecutor.shutdownNow();
        coverExecutor.shutdownNow();
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        // The artwork may be owned by CoverBitmapCache; dropping the reference
        // is the only safe action here.
        currentAlbumArt = null;
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
        // Publish the new speed so lock screens extrapolate progress correctly.
        if (prepared) updateState(isPlaying);
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
        String url, title, artist, album, cover, lyric;
        long duration;
        NativeLyricsRepository.Query lyricQuery() {
            return new NativeLyricsRepository.Query(url, title, artist, album, lyric == null ? "" : lyric, duration);
        }
    }
}