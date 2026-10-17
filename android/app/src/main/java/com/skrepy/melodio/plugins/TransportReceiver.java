package com.skrepy.melodio.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives the notification's transport buttons.
 *
 * <p>The buttons cannot use {@code MediaButtonReceiver} directly: those
 * intents are only routed to a MediaSession while the app holds the session
 * token, which is exactly the path that was unreliable on Android 8–12. An
 * explicit broadcast to this receiver works regardless of how the notification
 * is rendered, and forwards to the live plugin instance.</p>
 */
public class TransportReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        NativeAudioPlugin.handleTransportAction(intent.getAction());
    }
}
