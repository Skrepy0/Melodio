package com.skrepy.melodio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private BroadcastReceiver noisyAudioReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerNoisyAudioReceiver();
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