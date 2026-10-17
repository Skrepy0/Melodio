package com.skrepy.melodio.plugins;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/** Artwork downsampling used before publishing cover art to the notification. */
public class ArtworkSamplerTest {

    @Test
    public void keepsSmallArtworkAtFullResolution() {
        assertEquals(1, ArtworkSampler.sampleSizeFor(300, 300));
        assertEquals(1, ArtworkSampler.sampleSizeFor(320, 240));
    }

    @Test
    public void halvesArtworkJustOverTheTarget() {
        assertEquals(2, ArtworkSampler.sampleSizeFor(640, 640));
    }

    @Test
    public void downsamplesHighResolutionEmbeddedArtwork() {
        // A 3000px cover decodes to ~36 MB at full size; 8x brings it to 375px.
        assertEquals(8, ArtworkSampler.sampleSizeFor(3000, 3000));
    }

    @Test
    public void usesTheLongestEdgeForNonSquareArtwork() {
        assertEquals(4, ArtworkSampler.sampleSizeFor(400, 1600));
    }
}
