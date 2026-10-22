package com.skrepy.melodio.plugins;

import org.junit.Test;
import static org.junit.Assert.*;

public class LyricTimelineTest {
    @Test public void followsNativePositionIncludingBackwardSeeks() {
        LyricTimeline timeline = LyricTimeline.parse("[00:01.250]First\n[00:05]Second\n[00:08]");
        assertEquals("", timeline.textAt(1249));
        assertEquals("First", timeline.textAt(1250));
        assertEquals("Second", timeline.textAt(7000));
        assertEquals("First", timeline.textAt(2000));
        assertEquals("", timeline.textAt(8000));
    }
    @Test public void handlesOffsetsRepeatedAndUnorderedTimestamps() {
        LyricTimeline timeline = LyricTimeline.parse("[offset:-500]\n[01:03.125][00:02.50]Hello\n[00:01]Start\n[00:99]Invalid");
        assertEquals(3, timeline.lines.size());
        assertEquals(500, timeline.lines.get(0).timeMs);
        assertEquals(2000, timeline.lines.get(1).timeMs);
        assertEquals(62625, timeline.lines.get(2).timeMs);
        assertEquals("Hello", timeline.textAt(63000));
    }
    @Test public void combinesTranslationAtTheSameTimestamp() {
        LyricTimeline timeline = LyricTimeline.parse("[00:01]Original\n[00:01]翻译\n[00:01]\n[00:05]Next");
        assertEquals("Original · 翻译", timeline.textAt(2000));
    }
    @Test public void emptyOrUnsynchronizedLyricsRestoreTheArtistFallback() {
        assertEquals("", LyricTimeline.parse(null).textAt(50000));
        assertEquals("", LyricTimeline.parse("plain text").textAt(50000));
        assertEquals("", LyricTimeline.EMPTY.textAt(0));
    }
    @Test public void negativeOffsetsClampAtZeroAndTimelinesAreImmutable() {
        LyricTimeline timeline = LyricTimeline.parse("[offset:-2000]\n[00:01]Start");
        assertEquals(0, timeline.lines.get(0).timeMs);
        assertEquals("Start", timeline.textAt(0));
        try {
            timeline.lines.clear();
            fail("timeline must be immutable");
        } catch (UnsupportedOperationException expected) { }
    }
}
