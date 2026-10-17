# Melodio

Melodio is an offline-first music player for Android: it plays the music already
on the device, and can search and download more from online music clients.

## Users and situation

Someone listening on their phone — on a commute, at a desk, in bed at night.
They open the app to find a song and start it in as few taps as possible, then
leave it playing while they do something else. They are not browsing a catalogue
for pleasure; they are looking for their own music.

## Surfaces

| Surface        | What it is for                                                    |
| -------------- | ----------------------------------------------------------------- |
| Library (home) | Songs and playlists on the device; the entry point                |
| Song list      | One playlist or the liked list, with play-all and per-row actions |
| Player         | Now playing, queue, playback controls                             |
| Online search  | Search across configured music clients, download results          |
| Downloads      | Active download tasks and completed history                       |
| Settings       | Appearance, playback, data, about; sub-pages for each             |
| Sort editor    | Reorder a playlist, by drag or by a sort key                      |
| Blacklist      | Songs hidden from library scans                                   |

## Non-negotiables

- **Long-press multi-select** with a bottom action bar on every song list.
- **Per-row "more" menu** (play, download, add to playlist, like, details,
  delete) reachable without entering select mode.
- **Custom theme colour and dark mode**, applied live across every surface.
- **Queue drag-and-drop reordering** on the player.
- **Offline first**: the library and playback must work with no network. Cover
  lookups and online search degrade quietly when offline.

## Constraints

- Capacitor Android shell (`com.skrepy.melodio`), minSdk 24, targetSdk 36.
- Playback is native (`MediaPlayer` + `MediaSessionCompat`); UI state is mirrored
  through a SharedPreferences fallback.
- Vue 3 + TypeScript + Vite, Ionic Vue 8, Pinia, vue-i18n (zh-CN, en-US).
- Cover images chosen by the user are stored in `localStorage`; anything
  persisted must be an `https:` URL or an `image/` data URI.
