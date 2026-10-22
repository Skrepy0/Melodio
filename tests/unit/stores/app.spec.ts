import { Capacitor } from '@capacitor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/app'
import type { DownloadTaskSnapshot } from '@/utils/interface'
import { emitNative, mockMethod, resetPlugins } from '../helpers/capacitor'
import { makePlaylist, makeSong, makeSongs } from '../helpers/factories'
import { clearStorage, freshPinia } from '../helpers/store'
import { getDominantColor } from '@/utils/dominantColor'

vi.mock('@/utils/createToast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/utils/dominantColor', () => ({
  getDominantColor: vi.fn(async () => null),
}))

// Queue cover resolution reaches the network; keep the store tests offline.
vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return {
    ...actual,
    fetchCoverFromWeb: vi.fn(async () => null),
    getCachedCover: vi.fn(() => null),
    getEmbeddedCover: vi.fn(async () => ({ path: '' })),
  }
})

const native = (method: string, impl?: any) => mockMethod('NativeAudio', method, impl)

function makeTask(overrides: Partial<DownloadTaskSnapshot> = {}): DownloadTaskSnapshot {
  return {
    taskId: 'Kuwo:1',
    songIdentifier: '1',
    source: 'Kuwo',
    name: 'Song',
    singers: 'Artist',
    album: 'Album',
    ext: 'mp3',
    coverUrl: null,
    fileSizeBytes: 100,
    duration: 60,
    downloadUrl: 'https://example.com/a.mp3',
    downloadUrlStatus: { ok: true, status_code: 200, reason: [] },
    searchKeyword: null,
    progress: 0,
    loaded: 0,
    total: 100,
    status: 'queued',
    errorMessage: null,
    localPath: null,
    size: 0,
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  clearStorage()
  resetPlugins()
  freshPinia()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  mockMethod('Filesystem', 'getUri', async () => ({
    uri: 'file:///data/user/0/pkg/files/wallpaper.jpg',
  }))
  mockMethod('Filesystem', 'readFile', async () => ({ data: 'AAAA' }))
  mockMethod('Filesystem', 'deleteFile', async () => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('init', () => {
  it('restores persisted playback state and settings', async () => {
    const queue = makeSongs(3)
    localStorage.setItem('darkMode', 'true')
    localStorage.setItem('pinyinSearch', 'true')
    localStorage.setItem('playQueueRepeat', 'true')
    localStorage.setItem('playMode', 'repeatOne')
    localStorage.setItem('theme_color', '#ff0000')
    localStorage.setItem('playbackRate', '1.5')
    localStorage.setItem('playQueue', JSON.stringify(queue))
    localStorage.setItem('playData', JSON.stringify({ currentIndex: 1, mockCurrentTime: 42 }))
    localStorage.setItem(
      'likeList',
      JSON.stringify({ coverUrl: 'c', songCount: 1, data: [queue[0]] })
    )
    localStorage.setItem('songLists', JSON.stringify([makePlaylist({ id: 1 })]))
    localStorage.setItem('allSongs', JSON.stringify(queue))
    localStorage.setItem('searchHistory', JSON.stringify(['hello']))

    freshPinia()
    const store = useAppStore()
    await store.init()

    expect(store.darkMode).toBe(true)
    expect(store.getPinyinSearch()).toBe(true)
    expect(store.getPlayMode()).toBe('repeatOne')
    expect(store.getThemeColor()).toBe('#ff0000')
    expect(store.playbackRate).toBe(1.5)
    expect(store.getPlayQueue()).toEqual(queue)
    // Playback never auto-starts after a restore.
    expect(store.getPlayData()).toMatchObject({
      currentIndex: 1,
      isPlaying: false,
      mockCurrentTime: 42,
    })
    expect(store.getLikeList().data).toEqual([queue[0]])
    expect(store.getSongLists()).toHaveLength(1)
    expect(store.getAllSongs()).toEqual(queue)
    expect(store.searchHistory).toEqual(['hello'])
    expect(store.getInitFlag()).toBe(true)
    expect(store.isI18nReady).toBe(true)
  })

  it('is idempotent', async () => {
    const store = useAppStore()
    await store.init()
    const playlists = native('setPlaylist')
    playlists.mockClear()

    await store.init()

    expect(playlists).not.toHaveBeenCalled()
  })

  it('tolerates corrupted persisted JSON', async () => {
    localStorage.setItem('playQueue', '{not json')
    localStorage.setItem('songLists', 'also bad')
    localStorage.setItem('playData', 'nope')
    localStorage.setItem('likeList', 'nope')
    localStorage.setItem('currentPlayListIndex', 'nope')

    freshPinia()
    const store = useAppStore()

    await expect(store.init()).resolves.toBeUndefined()
    expect(store.getPlayQueue()).toEqual([])
    expect(store.getSongLists()).toEqual([])
  })

  it('normalises persisted download tasks', async () => {
    localStorage.setItem(
      'downloadTasks',
      JSON.stringify([
        { taskId: 'a', status: 'downloading', progress: '50', total: 100 },
        { taskId: 'b', status: 'completed', completedAt: 5 },
        { taskId: '', status: 'queued' },
        { taskId: 'c', status: 'weird' },
      ])
    )

    freshPinia()
    const store = useAppStore()
    await store.init()

    const tasks = store.getDownloadTasks()
    expect(tasks.map((t) => t.taskId)).toEqual(['a', 'b', 'c'])
    // An interrupted download comes back as paused, never as active.
    expect(tasks[0].status).toBe('paused')
    expect(tasks[0].progress).toBe(50)
    expect(tasks[0].total).toBe(100)
    expect(tasks[1].status).toBe('completed')
    expect(tasks[1].completedAt).toBe(5)
    expect(tasks[2].status).toBe('paused')
  })

  it('reads download tasks wrapped in a data array', async () => {
    localStorage.setItem('downloadTasks', JSON.stringify({ data: [{ taskId: 'a' }] }))
    freshPinia()
    const store = useAppStore()
    await store.init()
    expect(store.getDownloadTasks()).toHaveLength(1)
  })
})

describe('play queue', () => {
  it('adds songs individually and in bulk', async () => {
    const store = useAppStore()
    const [a, b, c] = makeSongs(3)

    store.setPlayQueue([a])
    store.addToQueue(b)
    store.addListToQueue([c])

    expect(store.getPlayQueue()).toEqual([a, b, c])
    expect(JSON.parse(localStorage.getItem('playQueue')!)).toHaveLength(3)
  })

  it('exposes the current song', () => {
    const store = useAppStore()
    const songs = makeSongs(3)
    store.setPlayQueue(songs)
    store.setMockCurrentTime(0)

    expect(store.currentSong).toEqual(songs[0])
    store.playData.currentIndex = 2
    expect(store.currentSong).toEqual(songs[2])
    store.playData.currentIndex = 9
    expect(store.currentSong).toBeNull()
  })

  it('syncs the native playlist when the queue changes', async () => {
    const setPlaylist = native('setPlaylist')
    const store = useAppStore()

    store.setPlayQueue(makeSongs(2))

    await vi.waitFor(() => {
      expect(setPlaylist).toHaveBeenCalledWith({
        songs: [
          expect.objectContaining({ title: 'song 1', artist: 'Artist One' }),
          expect.objectContaining({ title: 'song 2' }),
        ],
      })
    })
  })

  it('resets the index when the queue shrinks below it', async () => {
    const store = useAppStore()
    store.setPlayQueue(makeSongs(3))
    store.setIsPlaying(false)
    store.setMockCurrentTime(0)
    store.setCurrentIndex(2)
    await Promise.resolve()

    store.setPlayQueue(makeSongs(1))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.getPlayData().currentIndex).toBe(0)
  })

  it('commits the index after the native player confirms', async () => {
    const setIndex = native('setCurrentIndex')
    const store = useAppStore()

    await store.setCurrentIndex(3)

    expect(setIndex).toHaveBeenCalledWith({ index: 3 })
    expect(store.getPlayData().currentIndex).toBe(3)
    expect(JSON.parse(localStorage.getItem('playData')!).currentIndex).toBe(3)
  })

  it('lets the newest index request win', async () => {
    const resolvers: Array<() => void> = []
    native('setCurrentIndex', () => new Promise<void>((resolve) => resolvers.push(resolve)))
    const store = useAppStore()

    const first = store.setCurrentIndex(1)
    const second = store.setCurrentIndex(2)
    resolvers[1]()
    await second
    resolvers[0]()
    await first

    expect(store.getPlayData().currentIndex).toBe(2)
  })

  it('keeps the local index when the native call rejects', async () => {
    native('setCurrentIndex', () => Promise.reject(new Error('busy')))
    const store = useAppStore()

    await store.setCurrentIndex(4)

    expect(store.getPlayData().currentIndex).toBe(4)
  })
})

describe('next/prev', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // 队列循环默认可能是 true；这些用例验证的是 sequential / repeat-one
    // 的边界语义，先显式关掉队列循环，避免被另一个开关绕过守卫。
    useAppStore().setPlayQueueRepeat(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays the next index', async () => {
    const playIndex = native('playIndex')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(3))
    store.setMockCurrentTime(0)

    await store.nextSong()

    expect(playIndex).toHaveBeenCalledWith({
      index: 1,
      playQueueRepeat: store.getPlayQueueRepeat(),
      autoPlay: true,
    })
    expect(store.getPlayData().isPlaying).toBe(true)
  })

  it('stops at the end in sequential mode', async () => {
    const playIndex = native('playIndex')
    const pause = native('pause')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(2))
    store.setIsPlaying(false)
    store.setMockCurrentTime(0)
    store.playData.currentIndex = 1

    await store.nextSong()

    expect(playIndex).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    expect(store.getPlayData().isPlaying).toBe(false)
  })

  it('wraps at the end in repeat-one mode', async () => {
    const playIndex = native('playIndex')
    const store = useAppStore()
    store.setPlayMode('repeatOne')
    store.setPlayQueue(makeSongs(2))
    store.setIsPlaying(false)
    store.setMockCurrentTime(0)
    store.playData.currentIndex = 1

    await store.nextSong()

    expect(playIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 0, autoPlay: true }))
  })

  it('does nothing with an empty queue', async () => {
    const playIndex = native('playIndex')
    const store = useAppStore()
    await store.nextSong()
    await store.prevSong()
    expect(playIndex).not.toHaveBeenCalled()
  })

  it('goes back one track', async () => {
    const playIndex = native('playIndex')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(3))
    store.setMockCurrentTime(0)
    store.playData.currentIndex = 2

    await store.prevSong()

    expect(playIndex).toHaveBeenCalledWith({
      index: 1,
      playQueueRepeat: store.getPlayQueueRepeat(),
      autoPlay: true,
    })
  })

  it('does not wrap backwards in sequential mode', async () => {
    const playIndex = native('playIndex')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(3))
    store.setMockCurrentTime(0)

    await store.prevSong()

    expect(playIndex).not.toHaveBeenCalled()
  })

  it('wraps backwards in repeat-one mode', async () => {
    const playIndex = native('playIndex')
    const store = useAppStore()
    store.setPlayMode('repeatOne')
    store.setPlayQueue(makeSongs(3))
    store.setMockCurrentTime(0)

    await store.prevSong()

    expect(playIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 2, autoPlay: true }))
  })

  it('reports a failed switch without leaving the guard stuck', async () => {
    native('playIndex', () => Promise.reject(new Error('boom')))
    const store = useAppStore()
    store.setPlayQueue(makeSongs(3))
    store.setMockCurrentTime(0)

    await store.nextSong()

    expect(store.getIsSwitchingSong()).toBe(false)
    // A second attempt still works.
    const retry = native('playIndex')
    await store.nextSong()
    expect(retry).toHaveBeenCalled()
  })
})

describe('togglePlay', () => {
  it('does nothing for an empty queue', async () => {
    const play = native('play')
    const store = useAppStore()
    await store.togglePlay()
    expect(play).not.toHaveBeenCalled()
  })

  it('pauses when playing', async () => {
    const pause = native('pause')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(1))
    store.setIsPlaying(true)

    await store.togglePlay()

    expect(pause).toHaveBeenCalled()
    expect(store.getPlayData().isPlaying).toBe(false)
  })

  it('resumes when a track is already prepared', async () => {
    const play = native('play')
    const playIndex = native('playIndex')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(1))
    store.setIsPlaying(false)

    await store.togglePlay()

    expect(play).toHaveBeenCalled()
    expect(playIndex).not.toHaveBeenCalled()
    expect(store.getPlayData().isPlaying).toBe(true)
  })

  it('loads the track when resume fails', async () => {
    const play = vi
      .fn()
      .mockRejectedValueOnce(new Error('not prepared'))
      .mockResolvedValue(undefined)
    const playIndex = native('playIndex')
    const seek = native('seek')
    native('play', play)
    native('getState', () => ({ currentIndex: 0, currentPosition: 12, isPlaying: false }))
    const store = useAppStore()
    store.setPlayQueue(makeSongs(1))
    store.setIsPlaying(false)
    store.setMockCurrentTime(3)

    await store.togglePlay()

    expect(playIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }))
    expect(seek).toHaveBeenCalledWith({ time: 12 })
    expect(store.getPlayData().isPlaying).toBe(true)
  })

  it('reports a playback failure', async () => {
    native('play', () => Promise.reject(new Error('no audio')))
    native('playIndex', () => Promise.reject(new Error('no audio')))
    const toast = (await import('@/utils/createToast')).default
    const store = useAppStore()
    store.setPlayQueue(makeSongs(1))
    store.setIsPlaying(false)

    await store.togglePlay()

    expect(toast.error).toHaveBeenCalledWith('播放失败')
    expect(store.getPlayData().isPlaying).toBe(false)
  })
})

describe('native event handling', () => {
  it('mirrors songChanged, play state and time updates', async () => {
    const store = useAppStore()
    await store.init()

    emitNative('NativeAudio', 'songChanged', { index: 2, isPlaying: true, position: 7 })
    expect(store.getPlayData()).toMatchObject({
      currentIndex: 2,
      isPlaying: true,
      mockCurrentTime: 7,
    })

    emitNative('NativeAudio', 'playStateChange', { isPlaying: false })
    expect(store.getPlayData().isPlaying).toBe(false)

    emitNative('NativeAudio', 'timeupdate', { position: 33 })
    expect(store.getPlayData().mockCurrentTime).toBe(33)
  })

  it('reconciles with the native player after a reload', async () => {
    localStorage.setItem('playQueue', JSON.stringify(makeSongs(3)))
    freshPinia()
    native('getState', () => ({
      isPlaying: true,
      currentIndex: 1,
      currentPosition: 15,
      duration: 100,
    }))
    const store = useAppStore()
    await store.init()

    expect(store.getPlayData()).toMatchObject({
      currentIndex: 1,
      isPlaying: true,
      mockCurrentTime: 15,
    })
  })
})

describe('settings persistence', () => {
  it('toggles dark mode and persists it', () => {
    const store = useAppStore()
    expect(store.darkMode).toBe(false)
    store.toggleDarkMode()
    expect(store.darkMode).toBe(true)
    expect(localStorage.getItem('darkMode')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    store.toggleDarkMode()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists pinyin search and client toggles', () => {
    const store = useAppStore()
    store.setPinyinSearch(true)
    expect(localStorage.getItem('pinyinSearch')).toBe('true')

    store.init()
    store.setMusicClientStatus({ Kugou: true, Netease: false } as any)
    expect(JSON.parse(localStorage.getItem('music_client_status')!)).toEqual({
      Kugou: true,
      Netease: false,
    })
  })

  it('applies a theme colour to CSS variables', () => {
    const store = useAppStore()
    store.setThemeColor('#112233')
    const style = document.documentElement.style
    expect(store.getThemeColor()).toBe('#112233')
    expect(localStorage.getItem('theme_color')).toBe('#112233')
    expect(style.getPropertyValue('--primary-color')).toBe('#112233')
    expect(style.getPropertyValue('--primary-color-rgb')).toBe('17, 34, 51')
    expect(style.getPropertyValue('--on-primary-color')).toBeTruthy()
  })

  it('persists playback rate', async () => {
    const rate = native('setPlaybackRate')
    const store = useAppStore()
    await store.setPlaybackRate(1.25)
    expect(store.playbackRate).toBe(1.25)
    expect(localStorage.getItem('playbackRate')).toBe('1.25')
    expect(rate).toHaveBeenCalledWith({ rate: 1.25 })
  })

  it('persists language only for supported locales', () => {
    const store = useAppStore()
    store.setLanguage('fr-FR')
    expect(store.getLanguage()).toBe('zh-CN')
    store.setLanguage('en-US')
    expect(store.getLanguage()).toBe('en-US')
    expect(localStorage.getItem('appLanguage')).toBe('en-US')
  })

  it('syncs the language from i18n', async () => {
    const { i18n } = await import('@/i18n')
    const store = useAppStore()
    i18n.global.locale.value = 'en-US' as any
    store.syncLanguageFromI18n()
    expect(store.getLanguage()).toBe('en-US')
    expect(localStorage.getItem('appLanguage')).toBe('en-US')
  })

  it('persists queue-related settings', () => {
    const store = useAppStore()
    store.setAutoPauseOnDisconnect(false)
    store.setAutoPlayOnConnect(true)
    store.setAutoDelInvalidSongs(false)
    store.setPlaybackRate(1)
    expect(localStorage.getItem('autoPauseOnDisconnect')).toBe('false')
    expect(localStorage.getItem('autoPlayOnConnect')).toBe('true')
    expect(localStorage.getItem('autoDelInvalidSongs')).toBe('false')
  })

  it('persists fetch timeouts', () => {
    const store = useAppStore()
    store.setFetchTimeOut(45)
    store.setEachSongAveTimeOut(8)
    store.setMusicClientLimitation(3)
    expect(store.getFetchTimeOut()).toBe(45)
    expect(store.getEachSongAveTimeOut()).toBe(8)
    expect(store.getMusicClientLimitation()).toBe(3)
    expect(localStorage.getItem('fetchTimeOut')).toBe('45')
    expect(localStorage.getItem('eachSongAveTimeOut')).toBe('8')
    expect(localStorage.getItem('music_client_limitation')).toBe('3')
  })

  it('toggles audio focus handling', async () => {
    const focus = native('setAudioFocusEnabled')
    const store = useAppStore()
    await store.setAudioFocusPause(false)
    expect(store.getAudioFocusPause()).toBe(false)
    expect(focus).toHaveBeenLastCalledWith({ enabled: false })
    expect(localStorage.getItem('audioFocusPause')).toBe('false')
  })

  it('persists and applies the wallpaper', async () => {
    const store = useAppStore()

    expect(await store.setWallpaper('wallpaper.jpg')).toBe(true)
    expect(store.getWallpaper()).toContain('wallpaper.jpg')
    expect(localStorage.getItem('wallpaper')).toBe('wallpaper.jpg')
    expect(document.documentElement.classList.contains('has-wallpaper')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--wallpaper-image')).toContain(
      'wallpaper.jpg'
    )

    store.removeWallpaper()
    expect(store.getWallpaper()).toBe('')
    expect(localStorage.getItem('wallpaper')).toBeNull()
    expect(document.documentElement.classList.contains('has-wallpaper')).toBe(false)
  })

  it('rejects values that are not the managed wallpaper filename', async () => {
    const store = useAppStore()
    for (const bad of [
      'https://example.com/a.jpg',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:text/html;base64,PGgxPg==',
      'data:image/jpeg;base64,AAAA',
      'javascript:alert(1)',
      '',
    ]) {
      expect(await store.setWallpaper(bad)).toBe(false)
    }
    expect(store.getWallpaper()).toBe('')
  })

  it('keeps the wallpaper in memory when storage is full', async () => {
    const store = useAppStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(await store.setWallpaper('wallpaper.jpg')).toBe(false)
    // The filename is applied in memory even though persistence failed, and the
    // URL is resolved before setWallpaper returns.
    expect(store.getWallpaper()).toContain('wallpaper.jpg')
  })

  it('clamps wallpaper transparency and blur', () => {
    const store = useAppStore()
    store.setWallpaperTransparency(250)
    expect(store.getWallpaperTransparency()).toBe(100)
    store.setWallpaperTransparency(-10)
    expect(store.getWallpaperTransparency()).toBe(0)
    store.setWallpaperTransparency(NaN)
    expect(store.getWallpaperTransparency()).toBe(25)

    store.setWallpaperBlur(100)
    expect(store.getWallpaperBlur()).toBe(40)
    store.setWallpaperBlur(-3)
    expect(store.getWallpaperBlur()).toBe(0)
    expect(localStorage.getItem('wallpaperBlur')).toBe('0')
  })

  it('applies wallpaper fit and ignores unknown values', () => {
    const store = useAppStore()
    store.setWallpaperFit('stretch')
    expect(store.getWallpaperFit()).toBe('stretch')
    expect(document.documentElement.style.getPropertyValue('--wallpaper-fit')).toBe('100% 100%')

    store.setWallpaperFit('contain')
    expect(document.documentElement.style.getPropertyValue('--wallpaper-fit')).toBe('contain')

    store.setWallpaperFit('bogus' as any)
    expect(store.getWallpaperFit()).toBe('contain')
  })

  it('discards an invalid persisted wallpaper', async () => {
    localStorage.setItem('wallpaper', 'https://example.com/a.jpg')
    freshPinia()
    const store = useAppStore()
    await store.init()
    expect(store.getWallpaper()).toBe('')
    expect(localStorage.getItem('wallpaper')).toBeNull()
  })

  it('restores wallpaper settings', async () => {
    localStorage.setItem('wallpaper', 'wallpaper.jpg')
    localStorage.setItem('wallpaperTransparency', '400')
    localStorage.setItem('wallpaperBlur', '12')
    localStorage.setItem('wallpaperFit', 'contain')
    freshPinia()
    const store = useAppStore()
    await store.init()
    await vi.waitFor(() => expect(store.getWallpaper()).toContain('wallpaper.jpg'))
    expect(store.getWallpaperTransparency()).toBe(100)
    expect(store.getWallpaperBlur()).toBe(12)
    expect(store.getWallpaperFit()).toBe('contain')
  })
})

describe('cover fetching toggle', () => {
  it('persists and syncs the queue', async () => {
    const setPlaylist = native('setPlaylist')
    const store = useAppStore()
    store.setPlayQueue(makeSongs(1))
    await Promise.resolve()
    setPlaylist.mockClear()

    store.setCanFetchCoverFromWeb(false)

    await vi.waitFor(() => expect(setPlaylist).toHaveBeenCalled())

    expect(store.getCanFetchCoverFromWeb()).toBe(false)
    expect(localStorage.getItem('canFetchCoverFromWeb')).toBe('false')
  })

  it('restores the persisted value', async () => {
    localStorage.setItem('canFetchCoverFromWeb', 'false')
    freshPinia()
    const store = useAppStore()
    await store.init()
    expect(store.getCanFetchCoverFromWeb()).toBe(false)
  })
})

describe('system bar colour', () => {
  // Assigned in beforeEach: the file-level resetPlugins() wipes any spy
  // registered at module load, so the mock has to be installed afterwards.
  let setTheme: ReturnType<typeof mockMethod>

  // The native plugin only consumes `mode` now — the bar background is
  // transparent and painted by the page, so there is no colour to assert.
  const lastThemeCall = (): { mode: string } => {
    const calls = setTheme.mock.calls as unknown as Array<[{ mode: string }]>
    const call = calls[calls.length - 1]
    if (!call) throw new Error('SystemBar.setTheme was not called')
    return call[0]
  }

  const setVar = (name: string, value: string) =>
    document.documentElement.style.setProperty(name, value)

  // jsdom does not resolve CSS variables through getComputedStyle; route the
  // lookup to the inline style so `--bg-color-rgb` / `--wallpaper-ground-alpha`
  // set by the test can be read back.
  const computedStyleSpy = () =>
    vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => document.documentElement.style as unknown as CSSStyleDeclaration)

  beforeEach(() => {
    computedStyleSpy()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setTheme = mockMethod('SystemBar', 'setTheme', async (_opts: unknown) => undefined)
    vi.mocked(getDominantColor).mockReset()
    vi.mocked(getDominantColor).mockResolvedValue(null)
    setVar('--bg-color-rgb', '243, 243, 245') // light theme ground
    setVar('--wallpaper-ground-alpha', '1')
    document.documentElement.classList.remove('dark', 'has-wallpaper')
  })

  it('uses the theme ground when no wallpaper is set', async () => {
    const store = useAppStore()
    store.setWallpaperTransparency(50)
    await new Promise((r) => setTimeout(r, 0))

    expect(setTheme).toHaveBeenCalled()
    expect(lastThemeCall()).toEqual({ mode: 'light' })
    expect(getDominantColor).not.toHaveBeenCalled()
  })

  it('falls back to the theme ground when the sample fails', async () => {
    vi.mocked(getDominantColor).mockResolvedValue(null)
    const store = useAppStore()
    await store.setWallpaper('wallpaper.jpg')
    await new Promise((r) => setTimeout(r, 0))

    expect(getDominantColor).toHaveBeenCalled()
    expect(lastThemeCall()).toEqual({ mode: 'light' })
  })

  it('resolves light icons when the composite is bright', async () => {
    // Light theme ground (243) blending a light wallpaper dominant at half
    // alpha stays well above the 128 luminance threshold.
    vi.mocked(getDominantColor).mockResolvedValue([20, 20, 20])
    const store = useAppStore()
    store.setWallpaperTransparency(50)
    await store.setWallpaper('wallpaper.jpg')
    await new Promise((r) => setTimeout(r, 0))

    // Composite: (243 * 0.5 + 20 * 0.5) ≈ 132 → luminance 132 > 128 → light.
    expect(lastThemeCall()).toEqual({ mode: 'light' })
  })

  it('resolves dark icons when the composite is dark', async () => {
    vi.mocked(getDominantColor).mockResolvedValue([10, 10, 10])
    const store = useAppStore()
    // 100% transparency → ground alpha hits the 0.08 floor, so the composite
    // is dominated by the dark wallpaper colour.
    store.setWallpaperTransparency(100)
    await store.setWallpaper('wallpaper.jpg')
    await new Promise((r) => setTimeout(r, 0))

    expect(lastThemeCall()).toEqual({ mode: 'dark' })
  })

  it('discards a stale colour when the wallpaper changes mid-sample', async () => {
    let resolveFirst: ((rgb: [number, number, number] | null) => void) | null = null
    vi.mocked(getDominantColor)
      .mockImplementationOnce(
        () =>
          new Promise<[number, number, number] | null>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce([200, 100, 50])

    const store = useAppStore()
    store.setWallpaperTransparency(80) // ground alpha 0.2

    // First setWallpaper parks in getDominantColor.
    await store.setWallpaper('wallpaper.jpg')
    // Second setWallpaper resolves immediately.
    await store.setWallpaper('wallpaper.jpg')
    await new Promise((r) => setTimeout(r, 0))

    const callsAfterSecond = setTheme.mock.calls.length
    const expected = lastThemeCall()

    // Stale sample lands; generation guard must discard it.
    resolveFirst!([0, 0, 0])
    await new Promise((r) => setTimeout(r, 10))

    expect(setTheme.mock.calls.length).toBe(callsAfterSecond)
    expect(lastThemeCall()).toEqual(expected)
  })
})

describe('song lists', () => {
  it('creates, edits and deletes lists using 1-based ids', () => {
    const store = useAppStore()
    store.addSongList(makePlaylist({ id: 1, name: 'A' }))
    store.addSongList(makePlaylist({ id: 2, name: 'B' }))

    store.setSongListById(2, makePlaylist({ id: 2, name: 'B2', data: makeSongs(2) }))
    expect(store.getSongLists()[1]).toMatchObject({ name: 'B2', songCount: 2 })

    store.setSongListDataById(1, makeSongs(3))
    expect(store.getSongLists()[0]).toMatchObject({ songCount: 3 })
    expect(store.getSongLists()[0].data).toHaveLength(3)

    store.delectSongListById(1)
    expect(store.getSongLists()).toHaveLength(1)
    expect(store.getSongLists()[0].name).toBe('B2')
    expect(JSON.parse(localStorage.getItem('songLists')!)).toHaveLength(1)
  })

  it('merges imported lists', () => {
    const store = useAppStore()
    store.setSongLists([makePlaylist({ id: 1 })])
    store.mergeSongLists([makePlaylist({ id: 2 }), makePlaylist({ id: 3 })])
    expect(store.getSongLists()).toHaveLength(3)
  })
})

describe('like list and blacklist', () => {
  it('merges liked songs and keeps the count in sync', () => {
    const store = useAppStore()
    const songs = makeSongs(2)
    store.setLikeListData([songs[0]])
    store.mergeLikeListData([songs[1]])
    expect(store.getLikeList().data).toHaveLength(2)
    expect(store.getLikeList().songCount).toBe(2)
    expect(JSON.parse(localStorage.getItem('likeList')!).songCount).toBe(2)
  })

  it('adds blacklisted songs', () => {
    const store = useAppStore()
    const song = makeSong()
    store.addToBlacklist(song)
    expect(store.getBlacklist()).toEqual([song])
    expect(JSON.parse(localStorage.getItem('blacklist')!)).toHaveLength(1)
  })
})

describe('download task state', () => {
  it('upserts tasks newest first and updates them in place', () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ taskId: 'a' }))
    store.upsertDownloadTask(makeTask({ taskId: 'b' }))
    expect(store.getDownloadTasks().map((t) => t.taskId)).toEqual(['b', 'a'])

    store.upsertDownloadTask(makeTask({ taskId: 'a', name: 'Renamed' }))
    expect(store.getDownloadTasks()).toHaveLength(2)
    expect(store.getDownloadTasks()[1].name).toBe('Renamed')
  })

  it('updates progress only for existing tasks', () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ taskId: 'a' }))
    store.setDownloadTaskProgress({ taskId: 'a', loaded: 50, total: 100, progress: 50 })
    expect(store.getDownloadTasks()[0]).toMatchObject({ loaded: 50, progress: 50 })
    expect(() =>
      store.setDownloadTaskProgress({ taskId: 'missing', loaded: 1, total: 1, progress: 100 })
    ).not.toThrow()
  })

  it('stamps completedAt once', () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ taskId: 'a' }))
    store.setDownloadTaskStatus('a', 'completed', { localPath: '/a.mp3', size: 10 })
    const completedAt = store.getDownloadTasks()[0].completedAt
    expect(completedAt).toBeTruthy()
    expect(store.getDownloadTasks()[0]).toMatchObject({ status: 'completed', localPath: '/a.mp3' })

    store.setDownloadTaskStatus('a', 'completed')
    expect(store.getDownloadTasks()[0].completedAt).toBe(completedAt)
  })

  it('filters active tasks', () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ taskId: 'a', status: 'completed' }))
    store.upsertDownloadTask(makeTask({ taskId: 'b', status: 'downloading' }))
    expect(store.getActiveDownloadTasks().map((t) => t.taskId)).toEqual(['b'])
  })

  it('keeps history unique per task', () => {
    const store = useAppStore()
    const item = {
      taskId: 'a',
      songIdentifier: '1',
      name: 'Song',
      singers: 'Artist',
      album: 'Album',
      ext: 'mp3',
      coverUrl: null,
      localPath: '/a.mp3',
      size: 10,
      completedAt: 1,
    }
    store.appendDownloadHistory(item)
    store.appendDownloadHistory({ ...item, completedAt: 2 })
    expect(store.getDownloadHistory()).toHaveLength(1)
    expect(store.getDownloadHistory()[0].completedAt).toBe(2)

    store.clearDownloadHistory()
    expect(store.getDownloadHistory()).toEqual([])
  })
})

describe('search history', () => {
  it('deduplicates and caps at 20 entries', () => {
    const store = useAppStore()
    store.clearSearchHistory()
    for (let i = 0; i < 25; i++) store.pushSearchHistory(`kw-${i}`)
    expect(store.searchHistory).toHaveLength(20)
    expect(store.searchHistory[0]).toBe('kw-24')

    store.pushSearchHistory('kw-10')
    expect(store.searchHistory[0]).toBe('kw-10')
    expect(store.searchHistory.filter((k) => k === 'kw-10')).toHaveLength(1)
  })

  it('ignores blank keywords', () => {
    const store = useAppStore()
    store.clearSearchHistory()
    store.pushSearchHistory('   ')
    expect(store.searchHistory).toEqual([])
  })

  it('removes and clears entries', () => {
    const store = useAppStore()
    store.clearSearchHistory()
    store.pushSearchHistory('a')
    store.pushSearchHistory('b')
    store.removeSearchHistoryItem('a')
    expect(store.searchHistory).toEqual(['b'])
    expect(JSON.parse(localStorage.getItem('searchHistory')!)).toEqual(['b'])
    store.clearSearchHistory()
    expect(JSON.parse(localStorage.getItem('searchHistory')!)).toEqual([])
  })
})

describe('search', () => {
  const t = (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key)

  it('streams partial results and completes', async () => {
    const search = mockMethod('MusicSigner', 'search', () => Promise.resolve())
    const store = useAppStore()

    const pending = store.search('hello', ['KugouMusicClient'], 10, 5, 30, t)
    await Promise.resolve()
    await Promise.resolve()

    emitNative('MusicSigner', 'searchPartial', {
      items: [{ identifier: '1' }, { identifier: '2' }],
    })
    emitNative('MusicSigner', 'searchPartial', {
      items: [{ identifier: '2' }, { identifier: '3' }],
    })
    await pending

    expect(search).toHaveBeenCalledWith({
      keyword: 'hello',
      clients: ['KugouMusicClient'],
      limit: 10,
      eachSongTimeOut: 5,
      totalTimeOut: 30,
    })
    expect(store.searchResults.map((s: any) => s.identifier)).toEqual(['1', '2', '3'])
    expect(store.isLoading).toBe(false)
    expect(store.hasSearched).toBe(true)
    expect(store.searchHistory[0]).toBe('hello')
  })

  it('reports a missing keyword', async () => {
    mockMethod('MusicSigner', 'search', () => Promise.reject(new Error('Missing keyword')))
    const store = useAppStore()
    await store.search('', [], 10, 5, 30, t)
    expect(store.searchError).toBe('search.error.no_keyword')
    expect(store.isLoading).toBe(false)
  })

  it('ignores a cancelled search', async () => {
    mockMethod('MusicSigner', 'search', () => Promise.reject(new Error('stream was reset: CANCEL')))
    const store = useAppStore()
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toBeNull()
  })

  it('maps a failing music client', async () => {
    mockMethod('MusicSigner', 'search', () =>
      Promise.reject(
        new Error('Request failed with code: 200\nBody: {"code":1001,"msg":"client error: Kugou"}')
      )
    )
    const store = useAppStore()
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toContain('search.error.backend.music_client')
  })

  it('maps an invalid signature', async () => {
    mockMethod('MusicSigner', 'search', () =>
      Promise.reject(new Error('Request failed with code: 400 Invalid signature'))
    )
    const store = useAppStore()
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toContain('search.error.backend.sign')
  })

  it('maps server and client errors', async () => {
    mockMethod('MusicSigner', 'search', () =>
      Promise.reject(new Error('Request failed with code: 500'))
    )
    const store = useAppStore()
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toContain('search.error.backend.server')

    mockMethod('MusicSigner', 'search', () =>
      Promise.reject(new Error('Request failed with code: 404'))
    )
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toContain('search.error.client')

    mockMethod('MusicSigner', 'search', () =>
      Promise.reject(new Error('Request failed with code: 408 timeout of 30000ms exceeded'))
    )
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toBe('search.error.network.timeout')
  })

  it('reports an unknown network failure', async () => {
    mockMethod('MusicSigner', 'search', () => Promise.reject(new Error('boom')))
    const store = useAppStore()
    await store.search('x', [], 10, 5, 30, t)
    expect(store.searchError).toContain('search.error.network.no_network')
  })

  it('resets search state', async () => {
    mockMethod('MusicSigner', 'search', () => Promise.resolve())
    const store = useAppStore()
    await store.search('x', [], 10, 5, 30, t)
    store.resetSearch()
    expect(store.hasSearched).toBe(false)
    expect(store.searchError).toBeNull()
    expect(store.isLoading).toBe(false)
  })
})

describe('showLyrics', () => {
  it('defaults to true and persists both values', () => {
    const store = useAppStore()
    expect(store.getShowLyrics()).toBe(true)
    store.setShowLyrics(true)
    expect(store.getShowLyrics()).toBe(true)
    expect(localStorage.getItem('showLyrics')).toBe('true')
    freshPinia()
    const restored = useAppStore()
    expect(restored.getShowLyrics()).toBe(true)
    restored.setShowLyrics(false)
    expect(localStorage.getItem('showLyrics')).toBe('false')
    localStorage.setItem('showLyrics', 'true')
    restored.initShowLyrics()
    expect(restored.getShowLyrics()).toBe(true)
  })
})

describe('searchLyricsOnline', () => {
  it('defaults on and restores an explicit disabled preference', () => {
    const store = useAppStore()
    expect(store.getSearchLyricsOnline()).toBe(true)
    store.setSearchLyricsOnline(false)
    expect(localStorage.getItem('searchLyricsOnline')).toBe('false')
    freshPinia()
    const restored = useAppStore()
    expect(restored.getSearchLyricsOnline()).toBe(false)
    restored.initSearchLyricsOnline()
    expect(restored.getSearchLyricsOnline()).toBe(false)
    restored.setShowLyrics(false)
    freshPinia()
    expect(useAppStore().getShowLyrics()).toBe(false)
  })
})

describe('lyrics retry count', () => {
  it('defaults to two, persists zero, and restores the configured count', () => {
    const store = useAppStore()
    expect(store.getLyricsRetryCount()).toBe(2)
    store.setLyricsRetryCount(0)
    expect(localStorage.getItem('lyricsRetryCount')).toBe('0')
    freshPinia()
    const restored = useAppStore()
    expect(restored.getLyricsRetryCount()).toBe(0)
    localStorage.setItem('lyricsRetryCount', '10')
    restored.initLyricsRetryCount()
    expect(restored.getLyricsRetryCount()).toBe(10)
  })

  it.each([
    [-1, 0],
    [11, 10],
    [3.9, 3],
    [NaN, 2],
    [Infinity, 2],
  ])('normalizes %s to %i', (input, expected) => {
    const store = useAppStore()
    store.setLyricsRetryCount(input)
    expect(store.getLyricsRetryCount()).toBe(expected)
    expect(localStorage.getItem('lyricsRetryCount')).toBe(String(expected))
    freshPinia()
    expect(useAppStore().getLyricsRetryCount()).toBe(expected)
  })

  it('sanitizes invalid stored values during initialization', () => {
    const store = useAppStore()
    localStorage.setItem('lyricsRetryCount', 'broken')
    store.initLyricsRetryCount()
    expect(store.getLyricsRetryCount()).toBe(2)
    localStorage.setItem('lyricsRetryCount', '200')
    store.initLyricsRetryCount()
    expect(store.getLyricsRetryCount()).toBe(10)
  })
})

describe('native lyric settings synchronization', () => {
  it('sends lyric visibility, online setting and retry count to MediaSession playback', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const configure = native('configureLyrics')
    const store = useAppStore()
    await vi.waitFor(() =>
      expect(configure).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, online: true, retryCount: 2 })
      )
    )
    store.setShowLyrics(false)
    store.setSearchLyricsOnline(false)
    store.setLyricsRetryCount(7)
    await vi.waitFor(() =>
      expect(configure).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false, online: false, retryCount: 7 })
      )
    )
  })
})
