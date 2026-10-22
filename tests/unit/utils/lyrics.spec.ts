import { Capacitor } from '@capacitor/core'
import { configureNativeLyrics } from '@/utils/lyrics'
import { mockMethod, resetPlugins } from '../helpers/capacitor'
import { makeSong } from '../helpers/factories'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  METING_API_URL,
  loadLyrics,
  parseLyrics,
  searchOnlineLyrics,
  loadTrackLyrics,
} from '@/utils/lyrics'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('lyrics', () => {
  it('parses repeated stamps, fractions, offsets, blank lines and unordered timestamps', () => {
    expect(
      parseLyrics('[ar:Artist]\n[offset:-500]\n[00:02.50][01:03.125]Hello\n[00:01]\n[00:99]Invalid')
    ).toEqual([
      { time: 0.5, text: '' },
      { time: 2, text: 'Hello' },
      { time: 62.625, text: 'Hello' },
    ])
    expect(parseLyrics('unsynchronized lyrics')).toEqual([])
  })

  it('loads inline lyrics without a request and accepts missing data', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await loadLyrics(null, signal)).toEqual([])
    expect(await loadLyrics('[00:01]Hello', signal)).toEqual([{ time: 1, text: 'Hello' }])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches HTTP lyrics with cancellation and rejects request failures', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => '[00:01]Hello' })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await loadLyrics('https://example.com/song.lrc', signal)).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith('https://example.com/song.lrc', { signal })
    await expect(loadLyrics('https://example.com/missing.lrc', signal)).rejects.toThrow('404')
  })
})

const json = (body: unknown) => ({ ok: true, json: async () => body })
const lrc = (text: string) => ({ ok: true, text: async () => text })

describe('online lyrics', () => {
  const song = makeSong({ title: 'Test', artist: 'Artist', duration: 180000 })
  const match = {
    trackName: 'Test',
    artistName: 'Artist',
    duration: 180,
    syncedLyrics: '[00:01]Fallback',
  }
  const metingMatch = {
    name: 'Test',
    artist: 'Artist',
    lrc: `${METING_API_URL}?server=netease&type=lrc&id=123`,
  }
  beforeEach(() => localStorage.clear())

  it('prefers Meting, matches aliases and caches successful LRC', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json([
          { ...metingMatch, name: 'Test (Live)' },
          { ...metingMatch, artist: 'Other' },
          { ...metingMatch, duration: 200 },
          { ...metingMatch, artist: 'Other name(Artist)' },
        ])
      )
      .mockResolvedValueOnce(lrc('[00:01]Meting'))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await searchOnlineLyrics(song, signal)).toEqual([{ time: 1, text: 'Meting' }])
    const request = new URL(fetch.mock.calls[0][0])
    expect(request.origin).toBe(new URL(METING_API_URL).origin)
    expect(request.searchParams.get('type')).toBe('search')
    expect(request.searchParams.get('id')).toBe('Test Artist')
    expect(await searchOnlineLyrics(song, signal)).toEqual([{ time: 1, text: 'Meting' }])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each(['empty', 'http', 'malformed', 'lyrics'])(
    'falls back to LRCLIB after Meting %s responses',
    async (failure) => {
      const first =
        failure === 'empty'
          ? json([])
          : failure === 'http'
            ? { ok: false, status: 503 }
            : failure === 'malformed'
              ? json({ error: 'unavailable' })
              : json([metingMatch])
      const fetch = vi.fn().mockResolvedValueOnce(first)
      if (failure === 'lyrics') fetch.mockResolvedValueOnce(lrc('<html>unavailable</html>'))
      fetch.mockResolvedValueOnce(
        json([
          { ...match, artistName: 'Other' },
          { ...match, duration: 200 },
          { ...match, syncedLyrics: null },
          match,
        ])
      )
      vi.stubGlobal('fetch', fetch)
      expect(await searchOnlineLyrics(song, new AbortController().signal)).toEqual([
        { time: 1, text: 'Fallback' },
      ])
      expect(fetch.mock.calls.at(-1)?.[0]).toContain(
        'https://lrclib.net/api/search?track_name=Test&artist_name=Artist'
      )
    }
  )

  it('times out Meting and still gives LRCLIB a separate request', async () => {
    vi.useFakeTimers()
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new DOMException('Timed out', 'AbortError'))
            )
          })
      )
      .mockResolvedValueOnce(json([match]))
    vi.stubGlobal('fetch', fetch)
    const result = searchOnlineLyrics(song, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(4000)
    expect(await result).toEqual([{ time: 1, text: 'Fallback' }])
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(false)
  })

  it('cancels without starting a fallback or caching an obsolete response', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockImplementationOnce(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          )
        })
    )
    vi.stubGlobal('fetch', fetch)
    const result = searchOnlineLyrics(song, controller.signal)
    controller.abort()
    await expect(result).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
  })

  it('rejects external or insecure lyric URLs before fetching them', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json([
          { ...metingMatch, lrc: 'http://example.com/song.lrc' },
          { ...metingMatch, lrc: 'https://other.example.com/song.lrc' },
        ])
      )
      .mockResolvedValueOnce(json([match]))
    vi.stubGlobal('fetch', fetch)
    expect(await searchOnlineLyrics(song, new AbortController().signal)).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toContain('lrclib.net')
  })

  it('ignores old LRCLIB-only cache entries and prefers supplied lyrics', async () => {
    localStorage.setItem(
      'syncedLyricsCache',
      JSON.stringify({ [JSON.stringify(['test', 'artist', 180000])]: '[00:01]Old' })
    )
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([metingMatch]))
      .mockResolvedValueOnce(lrc('[00:01]New'))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await loadTrackLyrics({ ...song, lyric: '[00:00]Local' }, true, signal)).toEqual([
      { time: 0, text: 'Local' },
    ])
    expect(await loadTrackLyrics({ ...song, lyric: null }, false, signal)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
    expect(await searchOnlineLyrics(song, signal)).toEqual([{ time: 1, text: 'New' }])
  })

  it('does not cache network failures or empty matches', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    await expect(searchOnlineLyrics(song, signal)).rejects.toThrow('offline')
    expect(localStorage.length).toBe(0)
    fetch.mockResolvedValue(json([]))
    expect(await searchOnlineLyrics(song, signal)).toEqual([])
    expect(localStorage.length).toBe(0)
    fetch
      .mockReset()
      .mockResolvedValueOnce(json([metingMatch]))
      .mockResolvedValueOnce(lrc('[00:01]Recovered'))
    expect(await searchOnlineLyrics(song, signal)).toEqual([{ time: 1, text: 'Recovered' }])
  })
})

describe('automatic lyrics retries', () => {
  const song = makeSong({ title: 'Test', artist: 'Artist', duration: 180000 })
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it.each([0, 1, 10])(
    'allows %i retries in addition to the first provider round',
    async (retries) => {
      const fetch = vi.fn().mockResolvedValue(json([]))
      vi.stubGlobal('fetch', fetch)
      const result = searchOnlineLyrics(song, new AbortController().signal, retries)
      await vi.advanceTimersByTimeAsync(60000)
      expect(await result).toEqual([])
      expect(fetch).toHaveBeenCalledTimes(2 * (retries + 1))
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it('waits before retrying network failures and stops as soon as lyrics are found', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        json([{ name: 'Test', artist: 'Artist', lrc: `${METING_API_URL}?type=lrc&id=1` }])
      )
      .mockResolvedValueOnce(lrc('[00:01]Recovered'))
    vi.stubGlobal('fetch', fetch)
    const result = loadTrackLyrics(song, true, new AbortController().signal, 3)
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toEqual([{ time: 1, text: 'Recovered' }])
    expect(fetch).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('cancels during the retry delay without sending more requests', async () => {
    const fetch = vi.fn().mockResolvedValue(json([]))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const result = searchOnlineLyrics(song, controller.signal, 10)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(2)
    controller.abort()
    await expect(result).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops after the configured retries are exhausted', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetch)
    const result = searchOnlineLyrics(song, new AbortController().signal, 2)
    const assertion = expect(result).rejects.toThrow('offline')
    await vi.advanceTimersByTimeAsync(3000)
    await assertion
    expect(fetch).toHaveBeenCalledTimes(6)
  })

  it('returns supplied lyrics immediately with no retries or timers left', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(
      await loadTrackLyrics(
        { ...song, lyric: '[00:01]Local' },
        true,
        new AbortController().signal,
        10
      )
    ).toHaveLength(1)
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('native MediaSession lyrics', () => {
  const song = makeSong({ title: 'Test', artist: 'Artist', duration: 180000 })
  beforeEach(() => {
    resetPlugins()
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
  })
  it('passes settings to the background player', async () => {
    const configure = mockMethod('NativeAudio', 'configureLyrics')
    await configureNativeLyrics({ enabled: true, online: false, retryCount: 4 })
    expect(configure).toHaveBeenCalledWith({
      enabled: true,
      online: false,
      retryCount: 4,
      metingApi: METING_API_URL,
    })
  })
  it('shares the native repository instead of starting duplicate web requests', async () => {
    const lookup = mockMethod('NativeAudio', 'lookupLyrics', async () => ({
      lines: [{ time: 1, text: 'Native' }],
    }))
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await loadTrackLyrics(song, true, new AbortController().signal, 4)).toEqual([
      { time: 1, text: 'Native' },
    ])
    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({
        online: true,
        retryCount: 4,
        song: expect.objectContaining({ title: 'Test', duration: 180000 }),
      })
    )
    expect(fetch).not.toHaveBeenCalled()
  })
  it('detaches the foreground caller when cancelled while native playback can continue', async () => {
    let complete: (value: { lines: Array<{ time: number; text: string }> }) => void = () => {}
    mockMethod(
      'NativeAudio',
      'lookupLyrics',
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const controller = new AbortController()
    const result = loadTrackLyrics(song, true, controller.signal, 2)
    controller.abort()
    await expect(result).rejects.toThrow()
    complete({ lines: [{ time: 1, text: 'Still available to native playback' }] })
    await Promise.resolve()
  })
})
