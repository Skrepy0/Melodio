package com.skrepy.melodio.plugins;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBar")
public class SystemBarPlugin extends Plugin {

    private static final String TAG = "SystemBar";

    @Override
    public void load() {
        Log.d(TAG, "SystemBar plugin loaded");
    }

    /**
     * Make both system bars transparent and lay the WebView out edge-to-edge.
     * <p>
     * The bar backgrounds are now painted by the page itself (the wallpaper
     * composite at --bg-page); this plugin only controls the icon/button
     * polarity so they stay legible against whatever the page shows through.
     *
     * @param call expects { mode: "light" | "dark" }; any other field is ignored.
     */
    @PluginMethod
    public void setTheme(PluginCall call) {
        String mode = call.getString("mode", "light");
        boolean lightBars = "light".equals(mode);

        Log.d(TAG, "setTheme called with mode=" + mode);

        Activity activity = getActivity();
        if (activity == null) {
            Log.w(TAG, "Activity is null, cannot apply theme");
            call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();

            // FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS is required for the bar colour
            // setters to apply on API 21–34; on API 35+ the bars are transparent
            // by default and the setters are no-ops. The transparent flag keeps
            // legacy ROMs from painting a scrim we did not ask for.
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);

            // The decor view sits behind the WebView. Make it transparent so the
            // page background shows through instead of a solid black/white slab.
            window.getDecorView().setBackgroundColor(Color.TRANSPARENT);

            // Edge-to-edge on every API level. Android 15 (API 35) enforces this
            // anyway; doing it ourselves keeps the layout identical below 35 so
            // the same safe-area-inset CSS applies everywhere.
            WindowCompat.setDecorFitsSystemWindows(window, false);

            // API 29+ applies a translucent scrim over a transparent navigation
            // bar unless contrast enforcement is disabled. Without this the bar
            // is not truly transparent on those versions.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setNavigationBarContrastEnforced(false);
                window.setStatusBarContrastEnforced(false);
            }

            WindowInsetsControllerCompat insetsController =
                    WindowCompat.getInsetsController(window, window.getDecorView());

            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(lightBars);
                insetsController.setAppearanceLightNavigationBars(lightBars);
            }

            Log.d(TAG, "Applied transparent bars: lightBars=" + lightBars);
        });

        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
}