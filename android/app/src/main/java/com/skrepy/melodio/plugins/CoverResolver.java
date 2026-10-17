package com.skrepy.melodio.plugins;

import android.util.Base64;

import java.io.File;

/**
 * Resolves the cover that should be shown for a track.
 *
 * <p>Only local artwork is handled here. Online lookups live exclusively in the
 * web layer ({@code fetchCoverFromWeb} in {@code src/utils/functions.ts}); the
 * JS side passes the already-resolved URL down with the song data, so the
 * native player never performs its own metadata search.</p>
 */
public class CoverResolver {

    static final String DEFAULT_COVER;

    private static final String CAPACITOR_FILE_HTTPS = "https://localhost/_capacitor_file_";
    private static final String CAPACITOR_FILE_HTTP = "http://localhost/_capacitor_file_";

    static {
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"#888\"><path d=\"M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\"/></svg>";
        byte[] bytes = svg.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        DEFAULT_COVER = "data:image/svg+xml;base64," + base64;
    }

    /**
     * Converts a Capacitor local-server URL into a standard {@code file://} URI.
     * Other schemes are returned unchanged.
     */
    static String normalizeUri(String uri) {
        if (uri == null || uri.isEmpty()) return "";

        String filePath = null;
        // NOTE: the prefix used for the substring must include the trailing
        // slash, otherwise the resulting path loses its leading separator.
        if (uri.startsWith(CAPACITOR_FILE_HTTPS)) {
            filePath = uri.substring(CAPACITOR_FILE_HTTPS.length());
        } else if (uri.startsWith(CAPACITOR_FILE_HTTP)) {
            filePath = uri.substring(CAPACITOR_FILE_HTTP.length());
        }

        if (filePath != null) {
            // Strip query/fragment that the local server may append.
            int cut = filePath.indexOf('?');
            if (cut < 0) cut = filePath.indexOf('#');
            if (cut >= 0) filePath = filePath.substring(0, cut);
            if (filePath.isEmpty() || filePath.indexOf('\0') >= 0) return "";
            if (!filePath.startsWith("/")) filePath = "/" + filePath;
            return "file://" + filePath;
        }

        if (uri.startsWith("file://")) {
            String path = uri.substring("file://".length());
            if (path.isEmpty() || path.indexOf('\0') >= 0) return "";
            if (!path.startsWith("/")) path = "/" + path;
            return "file://" + path;
        }

        if (uri.startsWith("/")) {
            return "file://" + uri;
        }

        // http(s), content:// and data: URIs are already usable as-is.
        return uri;
    }

    /**
     * Whether the resolved URI can be handed to {@code BitmapFactory}. Remote
     * URLs are trusted here: the JS layer already validated them, and the
     * download itself reports failures through {@code loadBitmap}.
     */
    private static boolean isAccessible(String uri) {
        if (uri.startsWith("http://") || uri.startsWith("https://")) {
            return true;
        }
        if (uri.startsWith("data:")) {
            return true;
        }
        if (uri.startsWith("content://")) {
            // Verification would require a Context; decoding reports failure.
            return true;
        }
        if (uri.startsWith("file://")) {
            return isLocalFileReadable(uri);
        }
        return false;
    }

    private static boolean isLocalFileReadable(String fileUri) {
        try {
            File file = new File(fileUri.substring("file://".length()));
            return file.isFile() && file.canRead();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Resolves the cover synchronously from local artwork only. Returns
     * {@link #DEFAULT_COVER} when no usable artwork is available.
     */
    public String resolveCoverUrlSync(Song song) {
        if (song == null) return DEFAULT_COVER;

        String uri = song.albumArtUri();
        if (uri == null || uri.isEmpty()) return DEFAULT_COVER;

        String normalized = normalizeUri(uri);
        if (normalized.isEmpty() || !isAccessible(normalized)) {
            return DEFAULT_COVER;
        }
        return normalized;
    }
}
