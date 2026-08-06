package com.skrepy.melodio.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.util.Log;
import android.view.KeyEvent;

/**
 * Receives hardware media button events (headset, Bluetooth) and dispatches
 * them to the system audio manager, which routes them to the active
 * MediaSession — i.e. NativeAudioPlugin's callbacks (onPlay, onPause, etc.).
 */
public class MediaButtonReceiver extends BroadcastReceiver {

    private static final String TAG = "MediaButtonRcv";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {
            return;
        }

        KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
        if (event == null) return;

        int keyCode = event.getKeyCode();
        boolean isDown = event.getAction() == KeyEvent.ACTION_DOWN;
        Log.d(TAG, "Media button: " + (isDown ? "DOWN" : "UP") + " keyCode=" + keyCode);

        // Only handle key-down events to avoid double-triggering
        if (!isDown) return;

        AudioManager audioManager =
                (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.dispatchMediaKeyEvent(event);
        }
    }
}
