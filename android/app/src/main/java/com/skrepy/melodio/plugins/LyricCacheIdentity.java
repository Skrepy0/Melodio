package com.skrepy.melodio.plugins;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/** Must match src/utils/lyricCacheIdentity.ts. Album and provider are not identity fields. */
final class LyricCacheIdentity {
    static String normalize(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFKC).trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
    static int findDuration(long duration, List<Long> candidates) {
        int exact = candidates.indexOf(duration);
        if (exact >= 0) return exact;
        if (duration <= 0) return -1;
        int match = -1;
        for (int i = 0; i < candidates.size(); i++) {
            long value = candidates.get(i);
            if (value > 0 && Math.abs(value - duration) <= 5000) {
                if (match >= 0) return -1;
                match = i;
            }
        }
        return match;
    }
}
