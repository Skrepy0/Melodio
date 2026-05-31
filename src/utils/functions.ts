import { Filesystem } from '@capacitor/filesystem'
import { Song } from './interface'

export const getAccessibleUrl = (path: string): string => {
  if (!path) return ''

  if (
    path.startsWith('https://localhost/_capacitor_file_/') ||
    path.startsWith('http://localhost/_capacitor_file_/')
  ) {
    return path
  }

  if (path.startsWith('file://')) {
    const rawPath = path.slice(7)
    const encodedPath = encodeURI(rawPath)
    return 'file://' + encodedPath
  }

  if (path.startsWith('/')) {
    return 'file://' + encodeURI(path)
  }

  return encodeURI(path)
}
export async function checkPlayableUrl(url: string): Promise<boolean> {
  if (!url) return false

  // 处理 Capacitor 内部转换的 http://localhost/_capacitor_file_/... 格式
  if (
    url.startsWith('https://localhost/_capacitor_file_/') ||
    url.startsWith('http://localhost/_capacitor_file_/')
  ) {
    // 提取原始文件路径
    const prefix = url.includes('https://')
      ? 'https://localhost/_capacitor_file_'
      : 'http://localhost/_capacitor_file_'
    let filePath = url.slice(prefix.length)
    if (filePath.startsWith('/')) filePath = filePath.slice(1)
    const fileUrl = 'file://' + decodeURIComponent(filePath)
    return checkLocalFile(fileUrl)
  }

  // 处理 file:// 协议
  if (url.startsWith('file://')) {
    return checkLocalFile(url)
  }

  // 其他网络 URL (http://, https://)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return checkRemoteUrl(url)
  }

  // 无法识别的协议，返回 false
  console.warn('[checkPlayableUrl] Unknown protocol:', url)
  return false
}

async function checkLocalFile(fileUrl: string): Promise<boolean> {
  try {
    // 去掉 file:// 前缀
    let path = fileUrl.slice(7)
    // 解码可能被编码的路径（因为 getAccessibleUrl 做了 encodeURI）
    path = decodeURIComponent(path)
    // 使用 Filesystem.stat 检查文件状态
    const stat = await Filesystem.stat({ path })
    return stat.type === 'file'
  } catch (error) {
    // 文件不存在或权限错误
    console.debug(`[checkPlayableUrl] File not found: ${fileUrl}`, error)
    return false
  }
}

async function checkRemoteUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    console.debug(`[checkPlayableUrl] Remote URL not accessible: ${url}`, error)
    return false
  }
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
export const isInList = (id: string, queue: Song[]) => queue.some((song) => song.id === id)
