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
     * Content is intentionally laid out below the system bars; this method only
     * tints the bar areas so they follow the current theme background.
     *
     * @param call expects { mode: "light" | "dark", color?: "#rrggbb" }
     */
    @PluginMethod
    public void setTheme(PluginCall call) {
        String mode = call.getString("mode", "light");
        boolean isDark = "dark".equals(mode);
        String colorHex = call.getString("color", null);

        int bgColor = isDark ? DARK_BG_COLOR : LIGHT_BG_COLOR;
        if (colorHex != null) {
            try {
                bgColor = Color.parseColor(colorHex);
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "Invalid color from web layer: " + colorHex + ", using theme default");
            }
        }

        Log.d(TAG, "setTheme called with mode=" + mode + ", color=" + colorHex);

        Activity activity = getActivity();
        if (activity == null) {
            Log.w(TAG, "Activity is null, cannot apply theme");
            call.reject("Activity not available");
            return;
        }

        final int barColor = bgColor;
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();

            // Ensure the system knows we are handling bar backgrounds ourselves.
            // Some OEM ROMs (ColorOS, MIUI) require this flag + an explicit color
            // set on the decor view's root for the status bar area to pick up the
            // change; they ignore setStatusBarColor() alone.
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(barColor);
            window.setNavigationBarColor(barColor);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

            // The decor view is what shows through the bar areas (and is the only
            // lever left on Android 15+, where edge-to-edge is enforced and
            // setStatusBarColor() is ignored). Keep it in sync with the theme.
            window.getDecorView().setBackgroundColor(barColor);

            // Below Android 15 this is what keeps WebView content out of the bars.
            // On 15+ it is a no-op; Capacitor's SystemBars plugin pads the WebView
            // parent by the system bar insets instead.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                WindowCompat.setDecorFitsSystemWindows(window, true);
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
                    String.format("#%08X", barColor) + ", lightBars=" + lightBars);
        });

        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
}
