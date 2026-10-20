// src/utils/coverMigration.ts
import type { Song } from '@/utils/interface'
import { clearCoverCache } from '@/utils/coverCache'

const MIGRATION_KEY = 'coverBase64MigrationV1'

/** localStorage 里存放 Song/SongList 数组的键 */
const SONG_KEYS = ['allSongs', 'likeList', 'playQueue']
const SONG_LISTS_KEY = 'songLists'

const isInline = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:')

const stripSong = (song: Song): boolean => {
  if (isInline(song.albumArtUri)) {
    song.albumArtUri = ''
    return true
  }
  return false
}

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * Wipes all `data:` base64 covers from persisted data. Runs once; subsequent
 * launches are no-ops guarded by MIGRATION_KEY.
 */
export function runCoverMigration(): void {
  if (localStorage.getItem(MIGRATION_KEY)) return
  let dirty = false

  // 1. Song 数组键: allSongs / likeList / playQueue
  for (const key of SONG_KEYS) {
    const data = readJson<{ data?: Song[] } | Song[]>(key)
    if (!data) continue
    const songs = Array.isArray(data) ? data : (data.data ?? [])
    const hit = songs.some(stripSong)
    if (hit) {
      localStorage.setItem(key, JSON.stringify(data))
      dirty = true
    }
  }

  // 2. songLists: 每个歌单的 data[] 和 coverUrl
  const lists = readJson<Array<{ data?: Song[]; coverUrl?: string }>>(SONG_LISTS_KEY)
  if (lists) {
    let hit = false
    for (const list of lists) {
      list.data?.forEach((s) => {
        hit = stripSong(s) || hit
      })
      if (isInline(list.coverUrl)) {
        list.coverUrl = ''
        hit = true
      }
    }
    if (hit) {
      localStorage.setItem(SONG_LISTS_KEY, JSON.stringify(lists))
      dirty = true
    }
  }

  // 3. coverUrlCache: 整张表可能混有 data: 条目，直接清空重建
  clearCoverCache()

  localStorage.setItem(MIGRATION_KEY, '1')
  if (dirty) console.info('[coverMigration] stripped inline base64 covers')
}
