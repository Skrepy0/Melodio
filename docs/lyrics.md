# Lyrics

[中文](chinese/lyrics.md) · [Documentation](README.md)

## Settings and playback

Settings → Accessibility contains:

| Setting                         | Default | Behavior                                                                         |
| ------------------------------- | ------- | -------------------------------------------------------------------------------- |
| Show lyrics                     | On      | Displays synchronized lyrics and enables Android MediaSession lyric subtitles    |
| Search lyrics online            | On      | Searches for missing lyrics; successful cached lyrics remain available offline   |
| Automatic lyrics search retries | 2       | Integer from 0 to 10; excludes the initial search; 0 disables automatic retries  |
| Lyrics cache                    | —       | Lists cached songs, previews their LRC, deletes individual entries or clears all |

The highlighted line follows playback position and seeks. The view scrolls it into the center; manual scrolling suspends following until 3 seconds after interaction ends. Reduced-motion preferences disable smooth scrolling.

Each unsuccessful search round tries public Meting (NetEase), then LRCLIB. Retries wait 1, 2, 4, then at most 5 seconds between rounds. Switching tracks or disabling lyrics cancels obsolete work. On Android, leaving the player detaches its UI caller while native playback can continue loading lyrics.

## Sources and configuration

Supplied LRC is preferred, followed by a successful local cache and online providers. The configured public Meting endpoint is in [.env.example](../.env.example). Copy it to `.env.local` and set `VITE_METING_API_URL` to a compatible HTTPS service; restart Vite or rebuild Android to apply changes. This value is public build configuration, not a place for secrets.

The endpoint must support `server=netease&type=search&id=<title artist>&limit=10&page=1`, returning rows with `name`, `artist` and a same-origin HTTPS `lrc` URL. Browser use requires CORS. Public availability can change; no service uptime is guaranteed. Search sends the title and artist to providers.

Matching checks exact normalized titles and artist aliases. Duration is checked within 5 seconds when available; standard Meting rows often omit it. The LRC parser supports fractional seconds, repeated timestamps and offsets. It does not convert traditional Chinese to simplified Chinese or add word-level highlighting.

## Cache management

Open Settings → Accessibility → Lyrics cache. View/Hide expands the cached LRC. Delete and Clear all require confirmation. These actions remove cache records, not audio files or the lyrics already loaded for playback. A subsequent lookup can retrieve lyrics again. In-flight obsolete requests cannot restore records deleted during their lookup.

Web cache records live in localStorage; Android uses a separate native SharedPreferences cache so background playback is independent of WebView. The manager includes older web records. Each active cache keeps at most 100 successful results; failures are not cached. Native cache data is separate from localStorage backup/export.

## Android background synchronization

The native player owns lookup, retries, cache and timing. The UI shares its repository to avoid duplicate requests. The native playback position selects the lyric; only changed lines refresh metadata. Song title remains visible and the lyric replaces the artist subtitle. Missing/blank lyrics restore the artist. Original song metadata in the library is unchanged.

A media playback foreground service and playback wake lock support screen-off operation. System skins determine how metadata appears; compilation and unit tests do not replace real-device lock-screen validation. Rebuild and reinstall after native changes with `npm run android:build` and Android Studio.

## Implementation and checks

- `src/utils/lyrics.ts`: web providers, retries and native delegation.
- `src/utils/lyricCache.ts`: web persistence and platform-aware cache management.
- `src/views/settings/LyricsCachePage.vue`: management UI.
- Native `NativeLyricsRepository`, `LyricTimeline`, `NativeAudioPlugin` and `PlaybackService`: background loading, selection, publishing and service lifetime.

Run `npm run test:unit -- --run`, `npx vue-tsc --noEmit` and `npm run lint`. Browser regression specs are `lyrics.cy.ts` and `lyrics-cache.cy.ts`; run them with Cypress while Vite is serving. Native checks: from `android/`, run `./gradlew :app:testDebugUnitTest :app:lintDebug` (PowerShell: `.\gradlew.bat`).

If lyrics are missing, check title/artist tags, online search and connectivity. If the wrong lyrics are cached, delete that entry and retry; strict matching may still require corrected tags. If the lock screen shows only the artist, ensure lyrics are enabled and a synchronized result exists, then check the installed Android build and system behavior. Cache operation errors can be retried using Refresh.
