package com.skrepy.melodio.plugins;

import org.junit.Test;
import static org.junit.Assert.*;

public class DownloadRangeTest {
    @Test public void readsFullLengthFromPartialResponses() {
        assertEquals(1000, DownloadRange.total("bytes 100-199/1000"));
        assertEquals(-1, DownloadRange.total("bytes 0-199/*"));
        assertEquals(-1, DownloadRange.total(null));
        assertEquals(-1, DownloadRange.total("broken"));
    }

    @Test public void acceptsOnlyMatchingOffsets() {
        assertTrue(DownloadRange.matches("bytes 100-199/200", 100));
        assertTrue(DownloadRange.matches("bytes 0-199/*", 0));
        assertFalse(DownloadRange.matches("bytes 0-199/200", 100));
        assertFalse(DownloadRange.matches("bytes 100-99/200", 100));
        assertFalse(DownloadRange.matches("bytes 100-200/200", 100));
        assertFalse(DownloadRange.matches("bytes 9999999999999999999999-200/*", 100));
        assertFalse(DownloadRange.matches(null, 100));
        assertFalse(DownloadRange.matches("invalid", 100));
    }
}
