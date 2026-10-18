package com.skrepy.melodio.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** File naming for the disk tier of the cover cache. */
public class CoverBitmapCacheTest {

    @Test
    public void hashesAreStableAndHexEncoded() {
        String hash = CoverBitmapCache.sha256("https://example.com/cover.jpg");

        assertEquals(64, hash.length());
        assertEquals(hash, CoverBitmapCache.sha256("https://example.com/cover.jpg"));
        assertTrue(hash.matches("[0-9a-f]{64}"));
    }

    @Test
    public void differentUrlsHashDifferently() {
        assertNotEquals(
                CoverBitmapCache.sha256("https://example.com/a.jpg"),
                CoverBitmapCache.sha256("https://example.com/b.jpg"));
    }

    @Test
    public void handlesNonAsciiAndVeryLongKeys() {
        String longUrl = "https://example.com/" + "封面".repeat(200) + ".jpg";
        assertEquals(64, CoverBitmapCache.sha256(longUrl).length());
    }
}
