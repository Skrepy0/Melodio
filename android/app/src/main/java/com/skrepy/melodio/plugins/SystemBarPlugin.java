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

    // Theme colors matching the web layer's theme.scss
    private static final int LIGHT_BG_COLOR = Color.parseColor("#FFF8F9FC");
    private static final int DARK_BG_COLOR = Color.parseColor("#FF0A0A0C");

    @Override
    public void load() {
        Log.d(TAG, "SystemBar plugin loaded");
    }

    /**
     * Apply a theme to both the status bar and navigation bar.
     * Called from the web layer whenever the user toggles light/dark mode.
     *
     * @param call expects { mode: "light" | "dark" }
     */
    @PluginMethod
    public void setTheme(PluginCall call) {
        String mode = call.getString("mode", "light");
        boolean isDark = "dark".equals(mode);

        Log.d(TAG, "setTheme called with mode=" + mode);

        Activity activity = getActivity();
        if (activity == null) {
            Log.w(TAG, "Activity is null, cannot apply theme");
            call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            int bgColor = isDark ? DARK_BG_COLOR : LIGHT_BG_COLOR;

            // Ensure the system knows we are handling bar backgrounds ourselves.
            // Some OEM ROMs (ColorOS, MIUI) require this flag + an explicit color
            // set on the decor view's root for the status bar area to pick up the
            // change; they ignore setStatusBarColor() alone.
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(bgColor);
            window.setNavigationBarColor(bgColor);

            // On Android 15+ edge-to-edge, ColourOS and similar OEM skins do not
            // allow WebView content to draw behind the status bar. The area above
            // the content uses the decor view's background, so we tint that as well.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.getDecorView().setBackgroundColor(bgColor);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            }

            // Configure icon/button appearance for legibility against the background
            // Light bar backgrounds → dark icons; dark bar backgrounds → light icons
            boolean lightBars = !isDark;

            WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(window, window.getDecorView());

            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(lightBars);
                insetsController.setAppearanceLightNavigationBars(lightBars);
            }

            Log.d(TAG, "Applied " + mode + " theme: barColor=" +
                  String.format("#%08X", bgColor) + ", lightBars=" + lightBars);
        });

        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
}
