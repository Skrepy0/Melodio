package com.skrepy.melodio.plugins;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class DownloadRange {
    private static final Pattern RANGE = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+|\\*)");

    static boolean matches(String header, long offset) {
        if (header == null) return false;
        Matcher match = RANGE.matcher(header);
        if (!match.matches()) return false;
        try {
            long start = Long.parseLong(match.group(1));
            long end = Long.parseLong(match.group(2));
            return start == offset && end >= start &&
                    ("*".equals(match.group(3)) || Long.parseLong(match.group(3)) > end);
        } catch (NumberFormatException error) {
            return false;
        }
    }
    static long total(String header) {
        if (header == null) return -1;
        Matcher match = RANGE.matcher(header);
        if (!match.matches() || "*".equals(match.group(3))) return -1;
        try {
            return Long.parseLong(match.group(3));
        } catch (NumberFormatException error) {
            return -1;
        }
    }

}
