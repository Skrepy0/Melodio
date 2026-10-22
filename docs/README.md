# Melodio documentation

| Document                          | Purpose                                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| [Project README](../README.md)    | Features, requirements, build and validation                         |
| [中文 README](chinese/README.md)  | 中文项目介绍与构建说明                                               |
| [Lyrics guide](lyrics.md)         | Lyrics settings, providers, caching, MediaSession and implementation |
| [中文歌词指南](chinese/lyrics.md) | 歌词使用、缓存管理、后台同步与排查                                   |

Repository layout:

- `src/views/`: playback and settings screens.
- `src/utils/`: lyrics loading, cache management and native audio bridge.
- `src/stores/`: persisted settings and playback state.
- `android/app/src/main/java/com/skrepy/melodio/plugins/`: native playback, lyric repository and MediaSession integration.
- `tests/unit/` and `tests/e2e/`: frontend unit and browser regression tests.
- `android/app/src/test/`: native JVM tests.
- `docs/agents/`: engineering skill configuration, separate from user documentation.

Local configuration belongs in `.env.local`; copy the tracked `.env.example` as a starting point. Build output, dependency directories, test screenshots, coverage and logs are generated artifacts.
