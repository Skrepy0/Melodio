import { getCachedLyrics, cacheLyrics, getLyricsCacheVersion } from '@/utils/lyricCache'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { NativeAudioPlugin, NativeLyricsOptions } from '@/plugins/native-audio/definitions'
import type { Song } from '@/utils/interface'

const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio')
const usesNativeLyrics = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
let nativeLyricsConfiguration: Promise<void> = Promise.resolve()

export async function configureNativeLyrics(options: Omit<NativeLyricsOptions, 'metingApi'>) {
  if (usesNativeLyrics()) {
    nativeLyricsConfiguration = NativeAudio.configureLyrics({
      ...options,
      metingApi: METING_API_URL,
    })
    await nativeLyricsConfiguration
  }
}

export interface LyricLine {
  time: number
  text: string
}

/** Parse standard LRC, including repeated timestamps and the millisecond offset. */
export function parseLyrics(lrc: string): LyricLine[] {
  const offset = Number(lrc.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000
  const lines: LyricLine[] = []
  for (const line of lrc.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    for (const stamp of stamps) {
      if (Number(stamp[2]) >= 60) continue
      lines.push({
        time: Math.max(
          0,
          Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] || 0}`) + offset
        ),
        text,
      })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

export async function loadLyrics(source: string | null | undefined, signal: AbortSignal) {
  if (!source?.trim()) return []
  const value = source.trim()
  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value, { signal })
    if (!response.ok) throw new Error(`Lyrics request failed: ${response.status}`)
    return parseLyrics(await response.text())
  }
  return parseLyrics(value)
}

// A new namespace makes the first lookup try Meting instead of reusing older LRCLIB results.
export const METING_API_URL =
  import.meta.env.VITE_METING_API_URL || 'https://api.qijieya.cn/meting/'
const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase()

export const DEFAULT_LYRICS_RETRY_COUNT = 2
export function normalizeLyricsRetryCount(value: number) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(10, Math.trunc(value)))
    : DEFAULT_LYRICS_RETRY_COUNT
}

function waitForLyricsRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(signal.reason || new DOMException('Cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}

function matchesArtist(actual: string, expected: string) {
  const parts = (value: string) =>
    normalize(value)
      .split(/[、,;/&()（）]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  const candidates = parts(actual)
  return parts(expected).every((artist) => candidates.includes(artist))
}

async function withLyricsTimeout<T>(
  parent: AbortSignal,
  milliseconds: number,
  load: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  parent.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort()
  parent.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(), milliseconds)
  try {
    const result = await load(controller.signal)
    controller.signal.throwIfAborted()
    return result
  } finally {
    clearTimeout(timer)
    parent.removeEventListener('abort', abort)
  }
}

/** Standard Meting search rows contain name, artist and an LRC URL, often without duration. */
async function searchMetingLyrics(song: Song, signal: AbortSignal): Promise<string | null> {
  const endpoint = new URL(METING_API_URL)
  if (endpoint.protocol !== 'https:') throw new Error('Meting requires HTTPS')
  endpoint.search = new URLSearchParams({
    server: 'netease',
    type: 'search',
    id: `${song.title.trim()} ${song.artist.trim()}`,
    limit: '10',
    page: '1',
  }).toString()
  const response = await fetch(endpoint.href, { signal })
  if (!response.ok) throw new Error(`Meting search failed: ${response.status}`)
  const records: unknown = await response.json()
  if (!Array.isArray(records)) throw new Error('Invalid Meting search response')
  const matches = records
    .filter(
      (record) =>
        record &&
        typeof record.name === 'string' &&
        typeof record.artist === 'string' &&
        normalize(record.name) === normalize(song.title) &&
        matchesArtist(record.artist, song.artist) &&
        (typeof record.duration !== 'number' ||
          song.duration <= 0 ||
          Math.abs(record.duration - song.duration / 1000) <= 5)
    )
    .slice(0, 2)
  for (const record of matches) {
    if (typeof record.lrc !== 'string') continue
    const url = new URL(record.lrc, endpoint)
    // Follow only LRC references on the configured provider, never arbitrary returned URLs.
    if (url.protocol !== 'https:' || url.origin !== endpoint.origin || url.username || url.password)
      continue
    const lyrics = await fetch(url.href, { signal })
    if (!lyrics.ok) throw new Error(`Meting lyrics failed: ${lyrics.status}`)
    const text = await lyrics.text()
    if (parseLyrics(text).length) return text
  }
  return null
}

async function searchLrclibLyrics(song: Song, signal: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    track_name: song.title.trim(),
    artist_name: song.artist.trim(),
  })
  const response = await fetch(`https://lrclib.net/api/search?${params}`, { signal })
  if (!response.ok) throw new Error(`Lyrics search failed: ${response.status}`)
  const records: unknown = await response.json()
  if (!Array.isArray(records)) throw new Error('Invalid lyrics search response')
  const matches = records
    .filter(
      (record) =>
        record &&
        typeof record.trackName === 'string' &&
        typeof record.artistName === 'string' &&
        normalize(record.trackName) === normalize(song.title) &&
        matchesArtist(record.artistName, song.artist) &&
        typeof record.syncedLyrics === 'string' &&
        (song.duration <= 0 ||
          (typeof record.duration === 'number' &&
            Math.abs(record.duration - song.duration / 1000) <= 5))
    )
    .sort((a, b) => {
      const album = normalize(song.album || '')
      return (
        Number(typeof b.albumName === 'string' && normalize(b.albumName) === album) -
          Number(typeof a.albumName === 'string' && normalize(a.albumName) === album) ||
        Math.abs(a.duration - song.duration / 1000) - Math.abs(b.duration - song.duration / 1000)
      )
    })
  return matches.find((record) => parseLyrics(record.syncedLyrics).length)?.syncedLyrics ?? null
}

export async function searchOnlineLyrics(
  song: Song,
  signal: AbortSignal,
  retryCount = 0
): Promise<LyricLine[]> {
  signal.throwIfAborted()
  const title = song.title?.trim()
  const artist = song.artist?.trim()
  if (
    !title ||
    !artist ||
    ['未知艺术家', 'unknown artist', '<unknown>'].includes(normalize(artist))
  )
    return []
  const key = JSON.stringify([normalize(title), normalize(artist), song.duration])
  const cacheVersion = getLyricsCacheVersion()
  const cached = parseLyrics(getCachedLyrics(key))
  if (cached.length) return cached
  let lastError: unknown
  const retries = normalizeLyricsRetryCount(retryCount)
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastError = undefined
    for (const provider of [searchMetingLyrics, searchLrclibLyrics]) {
      try {
        const text = await withLyricsTimeout(signal, 4000, (requestSignal) =>
          provider(song, requestSignal)
        )
        signal.throwIfAborted()
        if (!text) continue
        const lines = parseLyrics(text)
        try {
          cacheLyrics(key, song, text, cacheVersion)
        } catch {
          // Storage may be full or disabled; the current result is still usable.
        }
        return lines
      } catch (error) {
        signal.throwIfAborted()
        lastError = error
      }
    }
    if (attempt < retries) await waitForLyricsRetry(Math.min(1000 * 2 ** attempt, 5000), signal)
  }
  if (lastError) throw lastError
  return []
}

export async function loadTrackLyrics(
  song: Song,
  online: boolean,
  signal: AbortSignal,
  retryCount = 0
) {
  signal.throwIfAborted()
  if (usesNativeLyrics()) {
    await nativeLyricsConfiguration
    signal.throwIfAborted()
    return new Promise<LyricLine[]>((resolve, reject) => {
      const abort = () => reject(signal.reason || new DOMException('Cancelled', 'AbortError'))
      signal.addEventListener('abort', abort, { once: true })
      // The native repository shares in-flight requests with background playback.
      // Leaving the page detaches this caller without cancelling native playback's lookup.
      NativeAudio.lookupLyrics({
        song: {
          url: song.uri,
          title: song.title,
          artist: song.artist || 'Unknown',
          album: song.album || '',
          lyric: song.lyric,
          duration: song.duration,
        },
        online,
        retryCount: normalizeLyricsRetryCount(retryCount),
        metingApi: METING_API_URL,
      })
        .then((result) => {
          if (!result || !Array.isArray(result.lines)) {
            reject(new Error('Invalid native lyrics response'))
            return
          }
          if (!signal.aborted) resolve(result.lines)
        }, reject)
        .finally(() => signal.removeEventListener('abort', abort))
    })
  }
  try {
    const lines = await withLyricsTimeout(signal, 3000, (requestSignal) =>
      loadLyrics(song.lyric, requestSignal)
    )
    if (lines.length) return lines
  } catch (error) {
    if (signal.aborted || !online) throw error
  }
  if (signal.aborted) return []
  if (!online)
    return parseLyrics(
      getCachedLyrics(
        JSON.stringify([normalize(song.title || ''), normalize(song.artist || ''), song.duration])
      )
    )
  return searchOnlineLyrics(song, signal, retryCount)
}
