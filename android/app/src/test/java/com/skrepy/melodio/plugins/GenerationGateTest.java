package com.skrepy.melodio.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Staleness rules that keep an old cover from overwriting a new track. */
public class GenerationGateTest {

    @Test
    public void aResultIsFreshUntilANewerGenerationStarts() {
        GenerationGate gate = new GenerationGate();
        int first = gate.next();

        assertFalse(gate.isStale(first));

        int second = gate.next();
        assertTrue(gate.isStale(first));
        assertFalse(gate.isStale(second));
    }

    @Test
    public void currentTracksTheLatestGeneration() {
        GenerationGate gate = new GenerationGate();
        assertEquals(0, gate.current());
        assertEquals(1, gate.next());
        assertEquals(2, gate.next());
        assertEquals(2, gate.current());
    }
}
