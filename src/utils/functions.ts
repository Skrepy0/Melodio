import { Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
export const getAccessibleUrl = (path: string) => {
  if (Capacitor.isNativePlatform() && path.startsWith('file://')) {
    return (window as any)?.Ionic?.WebView?.convertFileSrc?.(path) || path
  }
  return path
}
export async function getCoverBase64(uri: string): Promise<string> {
  try {
    const result = await Filesystem.readFile({ path: uri })
    return `data:image/jpeg;base64,${result.data}`
  } catch (error) {
    console.error('读取封面失败:', error)
    return ''
  }
}
