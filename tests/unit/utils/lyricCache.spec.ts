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
    expect(await listLyricCache()).toHaveLength(2)
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
