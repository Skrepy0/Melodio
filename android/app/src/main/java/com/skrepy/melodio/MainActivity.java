package com.skrepy.melodio;

import android.content.Context;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.skrepy.melodio.plugins.DownloaderPlugin;
import com.skrepy.melodio.plugins.MusicSignerPlugin;
import com.skrepy.melodio.plugins.NativeAudioPlugin;
import com.skrepy.melodio.plugins.SystemBarPlugin;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static volatile boolean bridgeDestroyed = false;
    private AudioDeviceCallback audioDeviceCallback;
    private boolean webViewMayBeDestroyed = false;
    private boolean rendererCleanupInProgress = false;

    /**
     * Returns true if the bridge has been destroyed (WebView renderer killed).
     * Used by the Capacitor Bridge to prevent JavaScript evaluation on a destroyed WebView.
     */
    public static boolean isBridgeDestroyed() {
        return bridgeDestroyed;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebViewCrashHandler();
        registerAudioDeviceCallback();
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
        // 禁止内容绘制到状态栏/导航栏下方。
        // Android 15 起系统强制 edge-to-edge，此调用不再生效；该版本由 Capacitor
        // 的 SystemBars 插件按系统栏 inset 给 WebView 父容器补 padding 来实现同样的效果。
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // Re-set up crash handler after plugins are loaded (WebView is now ready)
        setupWebViewCrashHandler();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterAudioDeviceCallback();
    }

    private void triggerAudioConnectedEvent() {
        if (getBridge() != null && !isBridgeDestroyed()) {
            getBridge().triggerWindowJSEvent("audioConnected");
            Log.i(TAG, "Triggered audioConnected event");
        }
    }

    private void triggerAudioDisconnectedEvent() {
        if (getBridge() != null && !isBridgeDestroyed()) {
            getBridge().triggerWindowJSEvent("audioBecomingNoisy");
            Log.i(TAG, "Triggered audioBecomingNoisy event");
        }
    }

    private void registerAudioDeviceCallback() {

        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) return;

        if (audioDeviceCallback != null) return;

        audioDeviceCallback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                for (AudioDeviceInfo device : addedDevices) {
                    // 只关心输出设备（播放设备）
                    if (device.isSink()) {
                        Log.i(TAG, "Audio output device added: " + device.getProductName());
                        // 触发前端连接事件
                        triggerAudioConnectedEvent();
                        break; // 只需触发一次
                    }
                }
            }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                for (AudioDeviceInfo device : removedDevices) {
                    if (device.isSink()) {
                        Log.i(TAG, "Audio output device removed: " + device.getProductName());
                        triggerAudioDisconnectedEvent();
                        break;
                    }
                }
            }
        };

        audioManager.registerAudioDeviceCallback(audioDeviceCallback, null);
    }

    private void unregisterAudioDeviceCallback() {
        if (audioDeviceCallback == null) return;

        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
        }
        audioDeviceCallback = null;
    }
}