import { CapacitorMediaStore } from '@odion-cloud/capacitor-mediastore'
import type { Song } from '@/utils/interface'
import { getAccessibleUrl, getCoverBase64 } from './functions'

export interface ScanResult {
  success: boolean
  songs: Song[]
  error?: string
}

// 定义插件API的预期返回类型（根据实际文档调整）
interface MediaStorePlugin {
  requestPermissions(options: { types: string[] }): Promise<unknown>
  checkPermissions(): Promise<unknown>
  getMediasByType(options: {
    mediaType: 'audio'
    sortBy?: string
    includeExternal?: boolean
  }): Promise<{ media: Song[] }>
}

// 安全地断言插件类型（避免any）
const MediaStoreAPI = CapacitorMediaStore as unknown as MediaStorePlugin

/**
 * 标准化权限状态，兼容不同返回格式
 */
const normalizePermissionStatus = (status: unknown): 'granted' | 'denied' | 'unknown' => {
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'

  // 处理对象格式：{ audio: 'granted', ... }
  if (status && typeof status === 'object') {
    const obj = status as Record<string, unknown>
    const audioPerm = obj.audio ?? obj.mediaAudio ?? obj.read ?? obj.status
    if (audioPerm === 'granted') return 'granted'
    if (audioPerm === 'denied') return 'denied'
  }

  return 'unknown'
}

/**
 * 请求音频读取权限
 */
export const requestAudioPermission = async (): Promise<boolean> => {
  try {
    const result = await MediaStoreAPI.requestPermissions({ types: ['audio'] })
    const granted = normalizePermissionStatus(result) === 'granted'
    if (!granted) console.warn('权限未被授予，原始返回:', result)
    return granted
  } catch (error) {
    console.error('权限请求失败:', error)
    return false
  }
}

/**
 * 检查音频读取权限状态
 */
export const checkAudioPermission = async (): Promise<boolean> => {
  try {
    const status = await MediaStoreAPI.checkPermissions()
    return normalizePermissionStatus(status) === 'granted'
  } catch (error) {
    console.error('权限检查失败:', error)
    return false
  }
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
    for (const item of result.media) {
      item.albumArtUri = await getCoverBase64(item.albumArtUri)
      item.uri = await getAccessibleUrl(item.uri)
    }
    const songs: Song[] = result.media
    return { success: true, songs }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string }
    const isPermissionError =
      err.message?.toLowerCase().includes('permission') || err.code === 'permission_denied'

    // 仅当权限错误且允许重试时，尝试请求权限并直接重试扫描（不依赖权限API的返回值）
    if (isPermissionError && retryOnPermission) {
      // 请求权限（无论返回什么，都再试一次扫描）
      await requestAudioPermission()

      // 直接重试扫描，但禁止再次进入重试分支（避免无限循环）
      // 注意：这次重试如果依然权限错误，会返回失败信息，不会再请求权限
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
