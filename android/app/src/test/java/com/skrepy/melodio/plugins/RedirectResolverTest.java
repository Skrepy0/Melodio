package com.skrepy.melodio.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** Termination rules for the playback URL redirect walker. */
public class RedirectResolverTest {

    private static RedirectResolver.Fetcher table(Map<String, String> hops) {
        return hops::get;
    }

    @Test
    public void returnsFinalUrlForShortChain() throws IOException {
        Map<String, String> hops = new HashMap<>();
        hops.put("http://a/1", "http://a/2");
        hops.put("http://a/2", "http://a/3");

        assertEquals("http://a/3", RedirectResolver.follow("http://a/1", table(hops)));
    }

    @Test
    public void returnsStartWhenThereIsNoRedirect() throws IOException {
        assertEquals("http://a/1", RedirectResolver.follow("http://a/1", table(new HashMap<>())));
    }

    @Test
    public void stopsOnLoopInsteadOfRecursingForever() throws IOException {
        Map<String, String> hops = new HashMap<>();
        hops.put("http://a/1", "http://a/2");
        hops.put("http://a/2", "http://a/1");

        // A→B→A must terminate; the URL reached at the loop is returned.
        String result = RedirectResolver.follow("http://a/1", table(hops));
        assertTrue(result.equals("http://a/1") || result.equals("http://a/2"));
    }

    @Test
    public void stopsAtDepthLimitForAnEndlessChain() throws IOException {
        AtomicInteger calls = new AtomicInteger();
        RedirectResolver.Fetcher endless = url -> {
            calls.incrementAndGet();
            return url + "+";
        };

        String result = RedirectResolver.follow("http://a/0", endless);

        assertEquals("http://a/0+++++", result);
        assertEquals(RedirectResolver.MAX_HOPS, calls.get());
    }

    @Test
    public void treatsEmptyNextHopAsEndOfChain() throws IOException {
        assertEquals("http://a/1", RedirectResolver.follow("http://a/1", url -> ""));
    }
}
