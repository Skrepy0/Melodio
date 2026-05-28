import { CapacitorMediaStore } from '@odion-cloud/capacitor-mediastore'
import type { Song } from '@/utils/interface'

export interface ScanResult {
  success: boolean
  songs: Song[]
  error?: string
}

// 使用 type assertions 来规避 TypeScript 类型检查
const MediaStoreAPI = CapacitorMediaStore as any

export const requestAudioPermission = async (): Promise<boolean> => {
  try {
    const permission = await MediaStoreAPI.requestPermissions({ types: ['audio'] })
    console.log('权限请求结果 (完整):', permission)

    // 尝试多种常见的权限字段名
    const isGranted =
      permission === 'granted' ||
      permission?.audio === 'granted' ||
      permission?.mediaAudio === 'granted' ||
      permission?.read === 'granted' ||
      permission?.status === 'granted'

    if (!isGranted) {
      console.warn('权限未被授予，实际返回:', permission)
    }
    return isGranted
  } catch (error) {
    console.error('权限请求失败:', error)
    return false
  }
}

export const checkAudioPermission = async (): Promise<boolean> => {
  try {
    const status = await MediaStoreAPI.checkPermissions()
    console.log('权限检查结果 (完整):', status)

    const isGranted =
      status === 'granted' ||
      status?.audio === 'granted' ||
      status?.mediaAudio === 'granted' ||
      status?.read === 'granted' ||
      status?.status === 'granted'

    return isGranted
  } catch (error) {
    console.error('权限检查失败:', error)
    return false
  }
}

export const scanAllAudio = async (): Promise<ScanResult> => {
  try {
    // 直接尝试扫描
    const result = await MediaStoreAPI.getMediasByType({
      mediaType: 'audio' as any,
      sortBy: 'TITLE',
      includeExternal: true,
    })

    if (!result || !result.media) {
      return { success: false, songs: [], error: '未找到任何音频文件' }
    }

    console.log('media数组第一项:', JSON.stringify(result.media[0]))
    const songs: Song[] = result.media
    return { success: true, songs }
  } catch (error: any) {
    // 如果错误与权限相关，则请求权限并重试一次
    if (error.message?.includes('permission') || error.code === 'permission_denied') {
      const granted = await requestAudioPermission()
      if (granted) {
        // 递归调用自身（注意避免死循环，最多重试一次）
        return scanAllAudio()
      } else {
        return { success: false, songs: [], error: '未获得音频读取权限，请在设置中手动授予' }
      }
    }
    console.error('扫描音频失败:', error)
    return { success: false, songs: [], error: error.message || '扫描过程中发生未知错误' }
  }
}
