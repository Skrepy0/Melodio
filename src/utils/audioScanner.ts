import { CapacitorMediaStore } from '@odion-cloud/capacitor-mediastore'
import type { OnlineSong, Song } from '@/utils/interface'
import { requestMediaPermissions } from '@/utils/permission'

export interface ScanResult {
  success: boolean
  songs: Song[]
  error?: string
}

interface MediaStorePlugin {
  requestPermissions(options: { types: string[] }): Promise<unknown>
  checkPermissions(): Promise<unknown>
  getMediasByType(options: {
    mediaType: 'audio'
    sortBy?: string
    includeExternal?: boolean
  }): Promise<{ media: Song[] }>
}

export const MediaStoreAPI = CapacitorMediaStore as unknown as MediaStorePlugin

/**
 * MediaStore album-art URIs (`content://media/.../albumart/...`) point at a
 * MediaStore row that frequently disappears while the song itself still carries
 * a picture tag. Storing one leaves a stale reference that renders as a broken
 * image, so they are dropped on scan: `resolveLocalCover` extracts the embedded
 * artwork from the audio file instead, and any online `cover_url` is kept as a
 * fallback hint.
 */
const ALBUM_ART_URI_RE = /^content:\/\/[^?#]*\/albumart\//i

/**
 * Drop a stale MediaStore album-art URI, keep any other reference untouched.
 * Exported so callers that read older persisted rows can sanitize them too.
 */
export const stripStaleAlbumArtUri = (value: string | null | undefined): string => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  return ALBUM_ART_URI_RE.test(trimmed) ? '' : trimmed
}

export const scanAllAudio = async (retryOnPermission = true): Promise<ScanResult> => {
  try {
    const result = await MediaStoreAPI.getMediasByType({
      mediaType: 'audio',
      sortBy: 'TITLE',
      includeExternal: true,
    })

    if (!result?.media?.length) {
      return { success: false, songs: [], error: '未找到任何音频文件' }
    }

    // Strip stale album-art URIs before they reach storage / the UI.
    const songs: Song[] = result.media.map((song) => ({
      ...song,
      albumArtUri: stripStaleAlbumArtUri(song.albumArtUri),
    }))
    return { success: true, songs }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string }
    const isPermissionError =
      err.message?.toLowerCase().includes('permission') || err.code === 'permission_denied'

    if (isPermissionError && retryOnPermission) {
      await requestMediaPermissions()
      return scanAllAudio(false)
    }

    console.error('扫描音频失败:', error)
    return {
      success: false,
      songs: [],
      error: err.message || '扫描过程中发生未知错误',
    }
  }
}

/**
 * 通过已知路径获取歌曲完整信息
 * @param path - 文件路径
 * @param originalSong - 原始歌曲信息
 * @returns Song 对象，失败则返回 null
 */
export async function getSongInfoByPath(
  path: string,
  originalSong: OnlineSong
): Promise<Song | null> {
  if (!path) return null

  const invalidMetadataValues = new Set(['unknown', '<unknown>', '未知', '未知艺术家', '未知专辑'])
  const normalizeText = (...values: Array<string | null | undefined>) => {
    for (const value of values) {
      if (typeof value !== 'string') continue
      const trimmed = value.trim()
      if (!trimmed) continue
      if (invalidMetadataValues.has(trimmed.toLowerCase())) continue
      return trimmed
    }
    return ''
  }

  try {
    const result = await CapacitorMediaStore.getMediaMetadata({ filePath: path })
    const media = (result as any)?.media || {}

    const displayName = normalizeText(media.displayName, originalSong.name)
    const title = normalizeText(media.title, media.displayName, originalSong.name, displayName)
    const artist = normalizeText(media.artist, originalSong.singers)
    const album = normalizeText(media.album, originalSong.album)
    // Do not persist MediaStore's album-art URI (it goes stale). Keep an online
    // cover hint when available; otherwise leave it empty and let
    // `resolveLocalCover` extract the embedded artwork from the file.
    const albumArtUri =
      stripStaleAlbumArtUri(media.albumArtUri) || normalizeText(originalSong.cover_url)

    return {
      id: String(media.id ?? `${originalSong.source}:${originalSong.identifier}`),
      displayName,
      uri: media.uri ?? path,
      size: media.size ?? originalSong.file_size_bytes,
      mimeType: media.mimeType ?? originalSong.ext,
      dateAdded: media.dateAdded ?? Date.now(),
      dateModified: media.dateModified ?? Date.now(),
      mediaType: 'audio',
      duration: media.duration ?? originalSong.duration * 1000,
      title,
      artist,
      album,
      track: media.track ?? 0,
      year: media.year ?? 0,
      albumArtUri,
      ...(originalSong.lyric ? { lyric: originalSong.lyric } : {}),
    }
  } catch (error) {
    console.error('获取歌曲信息失败:', error)
    return null
  }
}
