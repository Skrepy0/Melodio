package com.skrepy.melodio.plugins;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.content.ContextCompat;

/** Keeps the existing native player and lyric clock eligible to run with the screen off. */
public final class PlaybackService extends Service {
    private static volatile Notification notification;
    private static volatile boolean started;

    static synchronized void publish(Context context, Notification value) {
        notification = value;
        if (started) return;
        ContextCompat.startForegroundService(context, new Intent(context, PlaybackService.class));
        started = true;
    }
    static void update(Notification value) { notification = value; }
    static synchronized void stop(Context context) {
        notification = null;
        started = false;
        context.stopService(new Intent(context, PlaybackService.class));
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        Notification value = notification;
        if (value == null) { stopSelf(); return START_NOT_STICKY; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, value, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else startForeground(1, value);
        return START_NOT_STICKY;
    }
    @Override public void onDestroy() {
        stopForeground(STOP_FOREGROUND_DETACH);
        started = false;
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
