package com.skrepy.melodio.plugins;

/**
 * A monotonically increasing generation counter for asynchronous work.
 *
 * <p>A result computed for generation {@code n} is only valid while the
 * counter still reads {@code n}. Any newer request bumps the counter, which
 * makes every in-flight result stale. Used to stop a slow cover download from
 * publishing artwork over the track that replaced it.</p>
 *
 * <p>Kept free of Android imports so it can be unit-tested on the JVM.</p>
 */
final class GenerationGate {

    private int current = 0;

    /** Starts a new generation and returns it. */
    int next() {
        return ++current;
    }

    /** Whether a result produced for {@code generation} has been superseded. */
    boolean isStale(int generation) {
        return generation != current;
    }

    int current() {
        return current;
    }
}
