import { CapacitorMediaStore } from '@odion-cloud/capacitor-mediastore'
import type { OnlineSong, Song } from '@/utils/interface'
import { getCoverBase64 } from './functions'
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

    for (const item of result.media) {
      item.albumArtUri = await getCoverBase64(item.albumArtUri)
    }

    const songs: Song[] = result.media
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

  try {
    const result = await CapacitorMediaStore.getMediaMetadata({ filePath: path })

    const media = (result as any)?.media
    if (!media) return null

    return {
      id: media.id,
      displayName: media.displayName ?? originalSong.name,
      uri: media.uri ?? path,
      size: media.size ?? originalSong.file_size_bytes,
      mimeType: media.mimeType ?? originalSong.ext,
      dateAdded: media.dateAdded ?? Date.now(),
      dateModified: media.dateModified ?? Date.now(),
      mediaType: 'audio',
      duration: media.duration ?? originalSong.duration * 1000,
      title: media.title || media.displayName || originalSong.name || '未知歌曲',
      artist: media.artist || originalSong.singers || '未知艺术家',
      album: media.album || originalSong.album || '',
      track: media.track ?? 0,
      year: media.year ?? 0,
      albumArtUri: media.albumArtUri || originalSong.cover_url,
    }
  } catch (error) {
    console.error('获取歌曲信息失败:', error)
    return null
  }
}
