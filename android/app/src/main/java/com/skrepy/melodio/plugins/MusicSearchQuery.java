package com.skrepy.melodio.plugins;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import okhttp3.HttpUrl;

/** Keep decoded signing parameters separate from their URL representation. */
final class MusicSearchQuery {
    private final List<String[]> params = new ArrayList<>();

    MusicSearchQuery(String keyword, int limit, int timeout, List<String> clients) {
        params.add(new String[]{"keyword", keyword});
        params.add(new String[]{"limit", String.valueOf(limit)});
        List<String> sortedClients = new ArrayList<>(clients);
        Collections.sort(sortedClients);
        for (String client : sortedClients) params.add(new String[]{"music_client", client});
        params.add(new String[]{"timeout", String.valueOf(timeout)});
    }

    String canonical() {
        StringBuilder query = new StringBuilder();
        for (String[] param : params) {
            if (query.length() > 0) query.append('&');
            query.append(param[0]).append('=').append(param[1]);
        }
        return query.toString();
    }

    HttpUrl url(String endpoint) {
        HttpUrl.Builder builder = HttpUrl.get(endpoint).newBuilder();
        for (String[] param : params) builder.addQueryParameter(param[0], param[1]);
        return builder.build();
    }
}
