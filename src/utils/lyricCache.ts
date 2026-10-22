import { Capacitor, registerPlugin } from '@capacitor/core'
import type { NativeAudioPlugin } from '@/plugins/native-audio/definitions'
import type { Song } from '@/utils/interface'
import { normalizeLyricIdentity as normalize, findLyricDuration } from '@/utils/lyricCacheIdentity'

export interface LyricCacheEntry {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  lineCount: number
  cachedAt?: number
  source?: string
}
export interface LyricCacheRecord {
  version: 3
  title: string
  artist: string
  album: string
  duration: number
  lyrics: string
  cachedAt: number
  source: string
}
export const LYRICS_CACHE_KEY = 'syncedLyricsCache:v3'
const legacyKeys = ['syncedLyricsCache', 'syncedLyricsCache:v2:meting-first']
const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio')
const native = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
let version = 0
export const getLyricsCacheVersion = () => version
function read(key: string): Record<string, unknown> {
  const value: unknown = JSON.parse(localStorage.getItem(key) || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid lyrics cache')
  return value as Record<string, unknown>
}
function decode(key: string, value: unknown): LyricCacheRecord | null {
  try {
    const identity = JSON.parse(key)
    if (
      !Array.isArray(identity) ||
      typeof identity[0] !== 'string' ||
      typeof identity[1] !== 'string'
    )
      return null
    const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
    const lyrics = typeof value === 'string' ? value : row.lyrics
    if (typeof lyrics !== 'string' || !lyrics) return null
    return {
      version: 3,
      title: typeof row.title === 'string' ? row.title : identity[0],
      artist: typeof row.artist === 'string' ? row.artist : identity[1],
      album: typeof row.album === 'string' ? row.album : '',
      duration: Number.isFinite(Number(identity[2])) ? Math.max(0, Number(identity[2])) : 0,
      lyrics,
      cachedAt:
        typeof row.cachedAt === 'number' && Number.isFinite(row.cachedAt) ? row.cachedAt : 0,
      source: typeof row.source === 'string' ? row.source : 'unknown',
    }
  } catch {
    return null
  }
}
function identity(record: Pick<LyricCacheRecord, 'title' | 'artist' | 'duration'>) {
  return JSON.stringify([normalize(record.title), normalize(record.artist), record.duration])
}
function match(records: LyricCacheRecord[], song: Pick<Song, 'title' | 'artist' | 'duration'>) {
  const peers = records.filter(
    (row) =>
      normalize(row.title) === normalize(song.title) &&
      normalize(row.artist) === normalize(song.artist)
  )
  return peers[
    findLyricDuration(
      song.duration,
      peers.map((row) => row.duration)
    )
  ]
}
function merge(records: LyricCacheRecord[], incoming: LyricCacheRecord, preferIncoming = true) {
  const existing = match(records, incoming)
  if (!existing) records.push(incoming)
  else if (
    incoming.cachedAt > existing.cachedAt ||
    (preferIncoming && incoming.cachedAt === existing.cachedAt)
  )
    Object.assign(existing, incoming, { duration: existing.duration })
}
function persist(records: LyricCacheRecord[]) {
  localStorage.setItem(
    LYRICS_CACHE_KEY,
    JSON.stringify(Object.fromEntries(records.slice(-100).map((row) => [identity(row), row])))
  )
}
function webRecords(): LyricCacheRecord[] {
  const records: LyricCacheRecord[] = []
  try {
    records.push(
      ...Object.entries(read(LYRICS_CACHE_KEY)).flatMap(([id, value]) => {
        const row = decode(id, value)
        return row ? [row] : []
      })
    )
  } catch {
    /* Ignore malformed cache data. */
  }
  const migrated: string[] = []
  for (const key of legacyKeys) {
    try {
      const rows = Object.entries(read(key)).flatMap(([id, value]) => {
        const row = decode(id, value)
        return row ? [row] : []
      })
      rows
        .sort((a, b) => a.duration - b.duration || a.cachedAt - b.cachedAt)
        .forEach((row) => merge(records, row, false))
      if (
        legacyKeys.includes(key) &&
        localStorage.getItem(key) !== null &&
        rows.length === Object.keys(read(key)).length
      )
        migrated.push(key)
    } catch {
      /* Preserve unreadable source data for recovery. */
    }
  }
  if (migrated.length) {
    persist(records) // Never remove legacy data before the replacement is durable.
    migrated.forEach((key) => localStorage.removeItem(key))
  }
  return records
}
export function getCachedLyrics(key: string) {
  try {
    const [title, artist, duration] = JSON.parse(key)
    return match(webRecords(), { title, artist, duration })?.lyrics || ''
  } catch {
    return ''
  }
}
export function cacheLyrics(
  _key: string,
  song: Song,
  lyrics: string,
  expectedVersion: number,
  source = 'unknown'
) {
  if (version !== expectedVersion) return
  const records = webRecords()
  merge(records, {
    version: 3,
    title: song.title,
    artist: song.artist,
    album: song.album || '',
    duration: Math.max(0, song.duration || 0),
    lyrics,
    cachedAt: Date.now(),
    source,
  })
  persist(records)
}
export async function listLyricCache(): Promise<LyricCacheEntry[]> {
  const records = webRecords()
  if (native()) {
    if (records.length) {
      await NativeAudio.importLyricsCache({ entries: records })
      localStorage.removeItem(LYRICS_CACHE_KEY)
      version++
    }
    return (await NativeAudio.listLyricsCache()).entries
      .map((entry) => ({ ...entry, id: JSON.stringify(['native', entry.id]) }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }
  return records
    .map((row) => ({
      id: JSON.stringify(['web', LYRICS_CACHE_KEY, identity(row)]),
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      cachedAt: row.cachedAt,
      source: row.source,
      lineCount: row.lyrics.split(/\r?\n/).filter((line) => /\[\d+:\d{2}/.test(line)).length,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
}
export async function readLyricCache(id: string): Promise<string> {
  const [kind, key, entry] = JSON.parse(id)
  if (kind === 'native' && native()) return (await NativeAudio.readLyricsCache({ id: key })).lyrics
  if (kind === 'web' && key === LYRICS_CACHE_KEY)
    return webRecords().find((row) => identity(row) === entry)?.lyrics || ''
  throw new Error('Unknown lyrics cache entry')
}
export async function deleteLyricCache(id: string) {
  const [kind, key, entry] = JSON.parse(id)
  if (kind === 'native' && native()) {
    await NativeAudio.deleteLyricsCache({ id: key })
    return
  }
  if (kind !== 'web' || key !== LYRICS_CACHE_KEY) throw new Error('Unknown lyrics cache entry')
  version++
  persist(webRecords().filter((row) => identity(row) !== entry))
}
export async function clearLyricCache() {
  if (native()) await NativeAudio.clearLyricsCache()
  version++
  ;[...legacyKeys, LYRICS_CACHE_KEY].forEach((key) => localStorage.removeItem(key))
}
