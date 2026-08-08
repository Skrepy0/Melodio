import { MediaStoreAPI } from '@/utils/audioScanner'

const normalizePermissionStatus = (
  status: unknown,
  type?: string
): 'granted' | 'denied' | 'unknown' => {
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'

  if (status && typeof status === 'object') {
    const obj = status as Record<string, unknown>
    if (type) {
      const perm = obj[type] ?? obj['read'] ?? obj['status']
      if (perm === 'granted') return 'granted'
      if (perm === 'denied') return 'denied'
    }
    for (const key of ['audio', 'photo', 'video', 'read', 'status']) {
      const val = obj[key]
      if (val === 'granted') return 'granted'
      if (val === 'denied') return 'denied'
    }
  }
  return 'unknown'
}

export const requestMediaPermissions = async (): Promise<{
  audio: boolean
  photo: boolean
  video: boolean
}> => {
  try {
    const result = await MediaStoreAPI.requestPermissions({
      types: ['audio', 'photo', 'video'],
    })
    const audioGranted = normalizePermissionStatus(result, 'audio') === 'granted'
    const photoGranted = normalizePermissionStatus(result, 'photo') === 'granted'
    const videoGranted = normalizePermissionStatus(result, 'video') === 'granted'

    if (!audioGranted) console.warn('音频权限未被授予')
    if (!photoGranted) console.warn('照片权限未被授予')
    if (!videoGranted) console.warn('视频权限未被授予')

    return { audio: audioGranted, photo: photoGranted, video: videoGranted }
  } catch (error) {
    console.error('媒体权限请求失败:', error)
    return { audio: false, photo: false, video: false }
  }
}

export const checkMediaPermissions = async (): Promise<{
  audio: boolean
  photo: boolean
  video: boolean
}> => {
  try {
    const status = await MediaStoreAPI.checkPermissions()
    return {
      audio: normalizePermissionStatus(status, 'audio') === 'granted',
      photo: normalizePermissionStatus(status, 'photo') === 'granted',
      video: normalizePermissionStatus(status, 'video') === 'granted',
    }
  } catch (error) {
    console.error('权限检查失败:', error)
    return { audio: false, photo: false, video: false }
  }
}

export const requestAudioPermission = async (): Promise<boolean> => {
  const perms = await requestMediaPermissions()
  return perms.audio
}

export const checkAudioPermission = async (): Promise<boolean> => {
  const perms = await checkMediaPermissions()
  return perms.audio
}
