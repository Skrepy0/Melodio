import { loadTrackLyrics } from '@/utils/lyrics'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  LYRICS_CACHE_KEY,
  cacheLyrics,
  getCachedLyrics,
  getLyricsCacheVersion,
  listLyricCache,
  readLyricCache,
  deleteLyricCache,
  clearLyricCache,
} from '@/utils/lyricCache'
import { mockMethod, resetPlugins } from '../helpers/capacitor'
import { makeSong } from '../helpers/factories'
const song = makeSong({ title: 'My Song', artist: 'Singer', duration: 10000 })
const key = JSON.stringify(['my song', 'singer', 10000])
beforeEach(() => {
  localStorage.clear()
  resetPlugins()
})
afterEach(() => {
  vi.restoreAllMocks()
})
describe('lyrics cache management', () => {
  it('keeps cached lyrics available when online search is disabled', async () => {
    cacheLyrics(key, song, '[00:01]Offline lyrics', getLyricsCacheVersion())
    const fetch = vi.spyOn(globalThis, 'fetch')
    expect(await loadTrackLyrics(song, false, new AbortController().signal)).toEqual([
      { time: 1, text: 'Offline lyrics' },
    ])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stores metadata and lists, reads and removes a single entry', async () => {
    cacheLyrics(key, song, '[00:01]Hello', getLyricsCacheVersion())
    cacheLyrics(
      '[' + '"Other","Artist",0]',
      makeSong({ title: 'Other' }),
      '[00:00]Other',
      getLyricsCacheVersion()
    )
    const entry = (await listLyricCache()).find((item) => item.title === 'My Song')!
    expect(entry.artist).toBe('Singer')
    expect(entry.lineCount).toBe(1)
    expect(await readLyricCache(entry.id)).toBe('[00:01]Hello')
    await deleteLyricCache(entry.id)
    expect(getCachedLyrics(key)).toBe('')
    expect(await listLyricCache()).toHaveLength(1)
  })
  it('manages old string caches and clears both web namespaces', async () => {
    localStorage.setItem('syncedLyricsCache', JSON.stringify({ [key]: '[00:01]Legacy' }))
    localStorage.setItem(LYRICS_CACHE_KEY, JSON.stringify({ [key]: '[00:02]Current' }))
    expect(await listLyricCache()).toHaveLength(1)
    await clearLyricCache()
    expect(await listLyricCache()).toEqual([])
  })
  it('does not let an in-flight search recreate deleted or cleared entries', async () => {
    const version = getLyricsCacheVersion()
    cacheLyrics(key, song, '[00:01]Hello', version)
    await deleteLyricCache((await listLyricCache())[0].id)
    cacheLyrics(key, song, '[00:01]Late', version)
    expect(getCachedLyrics(key)).toBe('')
    const nextVersion = getLyricsCacheVersion()
    await clearLyricCache()
    cacheLyrics(key, song, '[00:01]Late', nextVersion)
    expect(await listLyricCache()).toEqual([])
  })
  it('ignores invalid entries and bounds the cache to 100', async () => {
    localStorage.setItem(LYRICS_CACHE_KEY, '{broken')
    expect(await listLyricCache()).toEqual([])
    for (let i = 0; i < 101; i++)
      cacheLyrics(
        JSON.stringify([`Song ${i}`, 'Singer', 0]),
        makeSong({ title: `Song ${i}` }),
        '[00:00]Line',
        getLyricsCacheVersion()
      )
    expect(await listLyricCache()).toHaveLength(100)
  })
  it('manages the Android repository through the native bridge', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    mockMethod('NativeAudio', 'listLyricsCache', async () => ({
      entries: [
        {
          id: 'v2:key',
          title: 'Native Song',
          artist: 'Singer',
          album: '',
          duration: 0,
          lineCount: 1,
        },
      ],
    }))
    const read = mockMethod('NativeAudio', 'readLyricsCache', async () => ({
      lyrics: '[00:01]Native',
    }))
    const remove = mockMethod('NativeAudio', 'deleteLyricsCache')
    const clear = mockMethod('NativeAudio', 'clearLyricsCache')
    const [entry] = await listLyricCache()
    expect(await readLyricCache(entry.id)).toBe('[00:01]Native')
    expect(read).toHaveBeenCalledWith({ id: 'v2:key' })
    await deleteLyricCache(entry.id)
    expect(remove).toHaveBeenCalledWith({ id: 'v2:key' })
    await clearLyricCache()
    expect(clear).toHaveBeenCalled()
  })
})

describe('cache identity and migration', () => {
  it('reuses one record for normalization, album, source and small duration changes', async () => {
    const version = getLyricsCacheVersion()
    cacheLyrics(
      '',
      makeSong({ title: ' Ｍｙ   Song ', artist: ' SINGER ', album: 'Old', duration: 180000 }),
      '[00:01]First',
      version,
      'meting'
    )
    cacheLyrics(
      '',
      makeSong({ title: 'My Song', artist: 'Singer', album: 'New', duration: 183000 }),
      '[00:01]Updated',
      version,
      'lrclib'
    )
    const entries = await listLyricCache()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: 'My Song',
      album: 'New',
      duration: 180000,
      source: 'lrclib',
    })
    expect(getCachedLyrics(JSON.stringify(['my song', 'singer', 182000]))).toBe('[00:01]Updated')
  })
  it('keeps different versions and unknown durations separate without transitive merges', async () => {
    for (const [title, duration] of [
      ['Song', 180000],
      ['Song', 188000],
      ['Song', 184000],
      ['Song', 0],
      ['Song (Live)', 180000],
    ] as const) {
      cacheLyrics(
        '',
        makeSong({ title, artist: 'Singer', duration }),
        '[00:01]Line',
        getLyricsCacheVersion()
      )
    }
    expect(await listLyricCache()).toHaveLength(5)
  })
  it('migrates old formats once and preserves the latest timestamp', async () => {
    const oldKey = JSON.stringify(['my song', 'singer', 10000])
    localStorage.setItem('syncedLyricsCache', JSON.stringify({ [oldKey]: '[00:01]Old' }))
    localStorage.setItem(
      'syncedLyricsCache:v2:meting-first',
      JSON.stringify({
        [oldKey]: { title: 'My Song', artist: 'Singer', cachedAt: 200, lyrics: '[00:01]New' },
      })
    )
    const [entry] = await listLyricCache()
    expect(await readLyricCache(entry.id)).toBe('[00:01]New')
    expect(localStorage.getItem('syncedLyricsCache')).toBeNull()
    expect(await listLyricCache()).toHaveLength(1)
    await deleteLyricCache(entry.id)
    expect(await listLyricCache()).toEqual([])
  })
  it('preserves legacy data if persistence fails', async () => {
    localStorage.setItem('syncedLyricsCache', JSON.stringify({ [key]: '[00:01]Legacy' }))
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full')
    })
    await expect(listLyricCache()).rejects.toThrow('Storage full')
    expect(localStorage.getItem('syncedLyricsCache')).not.toBeNull()
    set.mockRestore()
  })
  it('removes web duplicates only after native import succeeds', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    cacheLyrics(key, song, '[00:01]Web', getLyricsCacheVersion())
    const importCache = mockMethod('NativeAudio', 'importLyricsCache', async (): Promise<void> => {
      throw new Error('Write failed')
    })
    await expect(listLyricCache()).rejects.toThrow('Write failed')
    expect(getCachedLyrics(key)).toBe('[00:01]Web')
    importCache.mockResolvedValue(undefined)
    mockMethod('NativeAudio', 'listLyricsCache', async () => ({
      entries: [
        {
          id: 'v3:record',
          title: 'My Song',
          artist: 'Singer',
          duration: 10000,
          album: '',
          lineCount: 1,
        },
      ],
    }))
    expect(await listLyricCache()).toHaveLength(1)
    expect(localStorage.getItem(LYRICS_CACHE_KEY)).toBeNull()
  })
})
