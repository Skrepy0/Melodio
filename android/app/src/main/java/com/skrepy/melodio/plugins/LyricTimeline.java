package com.skrepy.melodio.plugins;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Immutable LRC timeline; independent of Android and WebView lifecycle. */
final class LyricTimeline {
    static final class Line {
        final long timeMs;
        final String text;
        Line(long timeMs, String text) { this.timeMs = timeMs; this.text = text; }
    }
    static final LyricTimeline EMPTY = new LyricTimeline(Collections.emptyList());
    final List<Line> lines;
    private static final Pattern STAMP = Pattern.compile("\\[(\\d+):(\\d{2})(?:[.:](\\d{1,3}))?\\]");
    private static final Pattern OFFSET = Pattern.compile("\\[offset:([+-]?\\d+)\\]", Pattern.CASE_INSENSITIVE);

    LyricTimeline(List<Line> lines) { this.lines = Collections.unmodifiableList(new ArrayList<>(lines)); }

    static LyricTimeline parse(String lrc) {
        if (lrc == null || lrc.isEmpty()) return EMPTY;
        double offset = 0;
        Matcher adjustment = OFFSET.matcher(lrc);
        if (adjustment.find()) offset = Double.parseDouble(adjustment.group(1));
        List<Line> lines = new ArrayList<>();
        for (String row : lrc.split("\\r?\\n")) {
            Matcher stamps = STAMP.matcher(row);
            String text = row.replaceAll("\\[[^\\]]*\\]", "").trim();
            while (stamps.find()) {
                int seconds = Integer.parseInt(stamps.group(2));
                if (seconds >= 60) continue;
                String fraction = stamps.group(3);
                double time = Double.parseDouble(stamps.group(1)) * 60000 + seconds * 1000
                        + (fraction == null ? 0 : Double.parseDouble("0." + fraction) * 1000) + offset;
                if (Double.isFinite(time)) lines.add(new Line(Math.max(0, Math.round(time)), text));
            }
        }
        lines.sort(Comparator.comparingLong(line -> line.timeMs));
        return new LyricTimeline(lines);
    }

    String textAt(long positionMs) {
        int left = 0, right = lines.size();
        while (left < right) {
            int middle = (left + right) >>> 1;
            if (lines.get(middle).timeMs <= positionMs) left = middle + 1;
            else right = middle;
        }
        if (left == 0) return "";
        int index = left - 1;
        long time = lines.get(index).timeMs;
        while (index > 0 && lines.get(index - 1).timeMs == time) index--;
        StringBuilder text = new StringBuilder();
        while (index < lines.size() && lines.get(index).timeMs == time) {
            String part = lines.get(index++).text;
            if (part.isEmpty()) continue;
            if (text.length() > 0) text.append(" · ");
            text.append(part);
        }
        return text.toString();
    }
}
