package com.skrepy.melodio.plugins;
import org.junit.Test;
import java.util.Arrays;
import static org.junit.Assert.*;
public class LyricCacheIdentityTest {
    @Test public void normalizesWidthCaseAndWhitespace() {
        assertEquals("my song", LyricCacheIdentity.normalize(" Ｍｙ   Song "));
    }
    @Test public void matchesUniqueDurationWithinFiveSeconds() {
        assertEquals(0, LyricCacheIdentity.findDuration(183000, Arrays.asList(180000L)));
        assertEquals(-1, LyricCacheIdentity.findDuration(186000, Arrays.asList(180000L)));
    }
    @Test public void preservesUnknownAndAmbiguousVersions() {
        assertEquals(-1, LyricCacheIdentity.findDuration(0, Arrays.asList(180000L, 188000L)));
        assertEquals(-1, LyricCacheIdentity.findDuration(184000, Arrays.asList(180000L, 188000L)));
        assertEquals(1, LyricCacheIdentity.findDuration(188000, Arrays.asList(180000L, 188000L)));
    }
}
