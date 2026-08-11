package com.skrepy.melodio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.skrepy.melodio.plugins.DownloaderPlugin;
import com.skrepy.melodio.plugins.MusicSignerPlugin;
import com.skrepy.melodio.plugins.NativeAudioPlugin;
import com.skrepy.melodio.plugins.SystemBarPlugin;

public class MainActivity extends BridgeActivity {

    private BroadcastReceiver noisyAudioReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerNoisyAudioReceiver();
    }

    /**
     * Register app-local plugins that are not npm packages and therefore
     * not auto-discovered by capacitor.plugins.json during cap sync.
     */
    @Override
    protected void load() {
        this.registerPlugin(NativeAudioPlugin.class);
        this.registerPlugin(SystemBarPlugin.class);
        this.registerPlugin(MusicSignerPlugin.class);
        this.registerPlugin(DownloaderPlugin.class);
        super.load();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterNoisyAudioReceiver();
    }

    private void registerNoisyAudioReceiver() {
        if (noisyAudioReceiver != null) return;

        noisyAudioReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                    if (getBridge() != null) {
                        getBridge().triggerWindowJSEvent("audioBecomingNoisy");
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        registerReceiver(noisyAudioReceiver, filter);
    }

    private void unregisterNoisyAudioReceiver() {
        if (noisyAudioReceiver != null) {
            unregisterReceiver(noisyAudioReceiver);
            noisyAudioReceiver = null;
        }
    }
}