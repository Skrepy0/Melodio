package com.skrepy.melodio.plugins;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/**
 * Follows an HTTP redirect chain with hard termination guarantees.
 *
 * <p>Deliberately free of Android imports so the termination rules can be
 * unit-tested on the JVM without a device or a server.</p>
 */
final class RedirectResolver {

    /** How many hops a chain may take before the walk gives up. */
    static final int MAX_HOPS = 5;

    private RedirectResolver() {
    }

    /** Supplies the next hop for a URL, or {@code null} when the chain ends. */
    interface Fetcher {
        String next(String url) throws IOException;
    }

    /**
     * Walks the chain from {@code startUrl} and returns the last URL reached.
     *
     * <p>The walk stops when the fetcher reports no next hop, when a URL is
     * reached for the second time (A→B→A), or after {@link #MAX_HOPS} hops. In
     * every case the URL reached so far is returned: the caller wants the best
     * address it can get, not an exception.</p>
     */
    static String follow(String startUrl, Fetcher fetcher) throws IOException {
        Set<String> visited = new HashSet<>();
        String current = startUrl;
        for (int hop = 0; hop < MAX_HOPS; hop++) {
            if (!visited.add(current)) {
                return current;  // loop
            }
            String next = fetcher.next(current);
            if (next == null || next.isEmpty() || next.equals(current)) {
                return current;
            }
            current = next;
        }
        return current;  // depth limit
    }
}
