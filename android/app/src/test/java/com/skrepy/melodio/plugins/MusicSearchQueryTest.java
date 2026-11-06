package com.skrepy.melodio.plugins;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;
import okhttp3.HttpUrl;

public class MusicSearchQueryTest {
    @Test public void specialKeywordsRoundTripWithoutExtraParameters() {
        for (String keyword : Arrays.asList("A&B", "A+B", "A#B", "100%", "周杰伦 晴天", "a=b?c")) {
            MusicSearchQuery query = new MusicSearchQuery(keyword, 5, 30, Arrays.asList("z", "a"));
            HttpUrl url = query.url("https://example.com/search");
            assertEquals(keyword, url.queryParameter("keyword"));
            assertEquals(5, url.querySize());
            assertNull(url.fragment());
            assertEquals(Arrays.asList("a", "z"), url.queryParameterValues("music_client"));
            assertEquals("keyword=" + keyword + "&limit=5&music_client=a&music_client=z&timeout=30", query.canonical());
        }
    }
}
