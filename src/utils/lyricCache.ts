import { Capacitor, registerPlugin } from '@capacitor/core'
import type { NativeAudioPlugin } from '@/plugins/native-audio/definitions'
import type { Song } from '@/utils/interface'

export interface LyricCacheEntry {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  lineCount: number
}
export const LYRICS_CACHE_KEY = 'syncedLyricsCache:v2:meting-first'
const storageKeys = ['syncedLyricsCache', LYRICS_CACHE_KEY]
const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio')
const native = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
let version = 0
export const getLyricsCacheVersion = () => version
function read(storageKey = LYRICS_CACHE_KEY): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'lyrics' in value && typeof value.lyrics === 'string')
    return value.lyrics
  return ''
}
export function getCachedLyrics(key: string) {
  return text(read()[key])
}
export function cacheLyrics(key: string, song: Song, lyrics: string, expectedVersion: number) {
  if (version !== expectedVersion) return
  const entries = read()
  delete entries[key]
  entries[key] = {
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    lyrics,
  }
  localStorage.setItem(
    LYRICS_CACHE_KEY,
    JSON.stringify(Object.fromEntries(Object.entries(entries).slice(-100)))
  )
}
function webEntries(): LyricCacheEntry[] {
  return storageKeys.flatMap((storageKey) =>
    Object.entries(read(storageKey)).flatMap(([key, value]) => {
      try {
        const identity = JSON.parse(key)
        if (
          !Array.isArray(identity) ||
          typeof identity[0] !== 'string' ||
          typeof identity[1] !== 'string' ||
          !text(value)
        )
          return []
        const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
        return [
          {
            id: JSON.stringify(['web', storageKey, key]),
            title: typeof data.title === 'string' ? data.title : identity[0],
            artist: typeof data.artist === 'string' ? data.artist : identity[1],
            album: typeof data.album === 'string' ? data.album : '',
            duration: Number(identity[2]) || 0,
            lineCount: text(value)
              .split(/\r?\n/)
              .filter((row) => /\[\d+:\d{2}/.test(row)).length,
          },
        ]
      } catch {
        return []
      }
    })
  )
}
export async function listLyricCache(): Promise<LyricCacheEntry[]> {
  const entries = webEntries()
  if (native()) {
    const result = await NativeAudio.listLyricsCache()
    entries.push(
      ...result.entries.map((entry) => ({ ...entry, id: JSON.stringify(['native', entry.id]) }))
    )
  }
  return entries.sort((a, b) => a.title.localeCompare(b.title))
}
export async function readLyricCache(id: string): Promise<string> {
  const [kind, key, entry] = JSON.parse(id)
  if (kind === 'native' && native()) return (await NativeAudio.readLyricsCache({ id: key })).lyrics
  if (kind === 'web' && storageKeys.includes(key)) return text(read(key)[entry])
  throw new Error('Unknown lyrics cache entry')
}
export async function deleteLyricCache(id: string) {
  const [kind, key, entry] = JSON.parse(id)
  if (kind === 'native' && native()) {
    await NativeAudio.deleteLyricsCache({ id: key })
    return
  }
  if (kind !== 'web' || !storageKeys.includes(key)) throw new Error('Unknown lyrics cache entry')
  version++
  const entries = read(key)
  delete entries[entry]
  localStorage.setItem(key, JSON.stringify(entries))
}
export async function clearLyricCache() {
  if (native()) await NativeAudio.clearLyricsCache()
  version++
  storageKeys.forEach((key) => localStorage.removeItem(key))
}
