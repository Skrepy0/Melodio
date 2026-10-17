package com.skrepy.melodio.plugins;

/**
 * Chooses how aggressively to downsample cover art before it is published.
 *
 * <p>Artwork crosses a Binder transaction to the system UI and is rendered at
 * roughly 300 px in a media notification. Decoding a 3000 px embedded JPEG at
 * full resolution costs tens of megabytes for pixels nobody sees, and when the
 * allocation or the transaction fails the artwork silently disappears. Free of
 * Android imports so the rule is unit-testable.</p>
 */
final class ArtworkSampler {

    /** Longest edge of the bitmap handed to the MediaSession. */
    static final int TARGET_PX = 320;

    private ArtworkSampler() {
    }

    /**
     * Power-of-two {@code inSampleSize} that brings the longest edge down to
     * at least {@link #TARGET_PX}. BitmapFactory only honours powers of two.
     */
    static int sampleSizeFor(int width, int height) {
        int longest = Math.max(width, height);
        int sample = 1;
        while (longest / (sample * 2) >= TARGET_PX) {
            sample *= 2;
        }
        return sample;
    }
}
