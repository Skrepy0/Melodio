package com.skrepy.melodio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.skrepy.melodio.plugins.DownloaderPlugin;
import com.skrepy.melodio.plugins.MusicSignerPlugin;
import com.skrepy.melodio.plugins.NativeAudioPlugin;
import com.skrepy.melodio.plugins.SystemBarPlugin;

import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private BroadcastReceiver noisyAudioReceiver;
    private boolean webViewMayBeDestroyed = false;
    private boolean rendererCleanupInProgress = false;
    private static volatile boolean bridgeDestroyed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebViewCrashHandler();
        registerNoisyAudioReceiver();
    }

    private void setupWebViewCrashHandler() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            Log.w(TAG, "WebView not available yet, will set up crash handler later");
            return;
        }

        getBridge().setWebViewClient(new com.getcapacitor.BridgeWebViewClient(getBridge()) {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                Log.w(TAG, "WebView renderer process gone");

                // Prevent re-entry if cleanup is already in progress
                if (rendererCleanupInProgress) {
                    Log.w(TAG, "Renderer cleanup already in progress, skipping");
                    return true;
                }
                rendererCleanupInProgress = true;

                // Mark bridge as destroyed FIRST to prevent any further JS evaluation
                bridgeDestroyed = true;
                if (getBridge() != null) {
                    getBridge().isRendererDestroyed = true;
                }

                // Stop all native operations that might touch the WebView
                try {
                    // Stop all native-to-JS events from plugins BEFORE touching the bridge
                    NativeAudioPlugin.onWebViewRendererDestroyed();
                    MusicSignerPlugin.onWebViewRendererDestroyed();
                    DownloaderPlugin.onWebViewRendererDestroyed();
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping plugin events", e);
                }

                // Mark for reload and clean up the WebView
                webViewMayBeDestroyed = true;

                try {
                    if (view.getParent() != null) {
                        ((android.view.ViewGroup) view.getParent()).removeView(view);
                    }
                    view.destroy();
                } catch (Exception e) {
                    Log.e(TAG, "Error destroying WebView", e);
                }

                rendererCleanupInProgress = false;
                return true; // Indicate we've handled it - don't kill the app
            }
        });
    }

    /**
     * Returns true if the bridge has been destroyed (WebView renderer killed).
     * Used by the Capacitor Bridge to prevent JavaScript evaluation on a destroyed WebView.
     */
    public static boolean isBridgeDestroyed() {
        return bridgeDestroyed;
    }

    @Override
    public void onResume() {
        super.onResume();
        // If the WebView renderer was killed (e.g., app was in background),
        // reload the app when the user returns
        if (webViewMayBeDestroyed && getBridge() != null && getBridge().getWebView() != null) {
            Log.i(TAG, "WebView was destroyed while in background, reloading app");
            webViewMayBeDestroyed = false;
            bridgeDestroyed = false;
            if (getBridge() != null) {
                getBridge().isRendererDestroyed = false;
            }
            getBridge().getWebView().reload();
        }
    }

    @Override
    protected void load() {
        this.registerPlugin(NativeAudioPlugin.class);
        this.registerPlugin(SystemBarPlugin.class);
        this.registerPlugin(MusicSignerPlugin.class);
        this.registerPlugin(DownloaderPlugin.class);
        super.load();
        // 禁止内容绘制到状态栏/导航栏下方
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        // Re-set up crash handler after plugins are loaded (WebView is now ready)
        setupWebViewCrashHandler();
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
                    if (getBridge() != null && !isBridgeDestroyed()) {
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