package com.skrepy.melodio.plugins;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;
import android.util.LruCache;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Comparator;

/**
 * Two-level cache for notification artwork.
 *
 * <p>Skipping tracks re-downloads and re-decodes the same cover repeatedly:
 * embedded {@code content://} artwork has to be read out of MediaStore, and a
 * web cover costs a network round trip. A decoded bitmap is already scaled to
 * notification size, so keeping it is cheap.</p>
 *
 * <p>The memory tier is an {@link LruCache} bounded by bytes. The disk tier
 * lives under {@code cacheDir/covers} — a directory the system may clear at
 * will — keyed by the SHA-256 of the source URL, and holds the compressed
 * bytes of the scaled bitmap. Disk reads only happen on a memory miss.</p>
 *
 * <p>Bitmaps returned from this cache are shared: callers must not recycle
 * them. Evicted entries are simply dropped and left to the garbage collector,
 * because a notification may still be holding the pixels.</p>
 */
final class CoverBitmapCache {

    private static final String TAG = "NativeAudio";

    /** Fraction of the heap the memory tier may occupy. */
    private static final int MEMORY_FRACTION = 8;

    /** Upper bound for the disk tier; the system may still evict below it. */
    private static final long MAX_DISK_BYTES = 20L * 1024 * 1024;

    private static final String FILE_SUFFIX = ".cover";

    private final LruCache<String, Bitmap> memory;
    private final File dir;

    CoverBitmapCache(File cacheDir) {
        this.dir = new File(cacheDir, "covers");
        int maxBytes = (int) (Runtime.getRuntime().maxMemory() / MEMORY_FRACTION);
        this.memory = new LruCache<String, Bitmap>(maxBytes) {
            @Override
            protected int sizeOf(String key, Bitmap value) {
                return value.getByteCount();
            }
        };
    }

    /**
     * Returns the cached artwork for {@code key}, or null.
     *
     * <p>A memory hit skips all IO. On a memory miss the disk tier is read and
     * decoded; a file that no longer decodes is deleted so it is not retried on
     * every track change.</p>
     */
    Bitmap get(String key) {
        if (key == null || key.isEmpty()) return null;

        Bitmap cached = memory.get(key);
        if (cached != null && !cached.isRecycled()) return cached;

        File file = fileFor(key);
        if (!file.isFile()) return null;

        Bitmap decoded = decode(file);
        if (decoded == null) {
            // Corrupt or truncated entry: drop it and fall through to the
            // caller's normal load path.
            //noinspection ResultOfMethodCallIgnored
            file.delete();
            return null;
        }
        memory.put(key, decoded);
        // Keep the disk tier's recency ordering meaningful.
        //noinspection ResultOfMethodCallIgnored
        file.setLastModified(System.currentTimeMillis());
        return decoded;
    }

    /**
     * Stores artwork under {@code key}. The bitmap must already be scaled to
     * notification size; it is written to disk synchronously so the next track
     * change does not race the write.
     */
    void put(String key, Bitmap bitmap) {
        if (key == null || key.isEmpty() || bitmap == null || bitmap.isRecycled()) return;

        memory.put(key, bitmap);

        byte[] bytes = compress(bitmap);
        if (bytes == null) return;

        File file = fileFor(key);
        File parent = file.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            Log.w(TAG, "Cover cache directory unavailable");
            return;
        }
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        } catch (IOException e) {
            Log.w(TAG, "Could not write cover cache: " + e.getMessage());
            return;
        }
        trimDiskCache();
    }

    /** Removes every cached bitmap, in memory and on disk. */
    void clear() {
        memory.evictAll();
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File file : files) {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private File fileFor(String key) {
        return new File(dir, sha256(key) + FILE_SUFFIX);
    }

    private static Bitmap decode(File file) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = ArtworkSampler.sampleSizeFor(bounds.outWidth, bounds.outHeight);
            options.inPreferredConfig = Bitmap.Config.ARGB_8888;
            return BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        } catch (Exception e) {
            Log.w(TAG, "Cover cache decode failed: " + e.getMessage());
            return null;
        }
    }

    private static byte[] compress(Bitmap bitmap) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            // PNG keeps transparency; artwork is usually opaque JPEG, but the
            // encoder choice has to work for both.
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            return out.toByteArray();
        } catch (Exception e) {
            Log.w(TAG, "Cover cache encode failed: " + e.getMessage());
            return null;
        }
    }

    /** Deletes the least recently written files once the tier exceeds its cap. */
    private void trimDiskCache() {
        File[] files = dir.listFiles();
        if (files == null) return;

        long total = 0;
        for (File file : files) total += file.length();
        if (total <= MAX_DISK_BYTES) return;

        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) {
            if (total <= MAX_DISK_BYTES) break;
            long length = file.length();
            if (file.delete()) total -= length;
        }
    }

    static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory on every Android release.
            throw new IllegalStateException(e);
        }
    }
}
