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

  if (
    url.startsWith('https://localhost/_capacitor_file_/') ||
    url.startsWith('http://localhost/_capacitor_file_/')
  ) {
    const prefix = url.includes('https://')
      ? 'https://localhost/_capacitor_file_'
      : 'http://localhost/_capacitor_file_'
    let filePath = url.slice(prefix.length)
    if (filePath.startsWith('/')) filePath = filePath.slice(1)
    const fileUrl = 'file://' + decodeURIComponent(filePath)
    return checkLocalFile(fileUrl)
  }

  if (url.startsWith('file://')) {
    return checkLocalFile(url)
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return checkRemoteUrl(url)
  }

  console.warn('[checkPlayableUrl] Unknown protocol:', url)
  return false
}

async function checkLocalFile(fileUrl: string): Promise<boolean> {
  try {
    let path = fileUrl.slice(7)
    path = decodeURIComponent(path)
    const stat = await Filesystem.stat({ path })
    return stat.type === 'file'
  } catch (error) {
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
export const DEFAULT_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#888"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'
  )

export function getCoverUrl(albumArtUri?: string | null): string {
  if (!albumArtUri) return DEFAULT_COVER

  if (albumArtUri.startsWith('file://')) return albumArtUri

  if (
    albumArtUri.startsWith('https://localhost/_capacitor_file_/') ||
    albumArtUri.startsWith('http://localhost/_capacitor_file_/')
  ) {
    const prefix = albumArtUri.includes('https://')
      ? 'https://localhost/_capacitor_file_'
      : 'http://localhost/_capacitor_file_'
    let filePath = albumArtUri.slice(prefix.length)
    if (!filePath.startsWith('/')) filePath = '/' + filePath
    return 'file://' + filePath
  }
  if (albumArtUri.startsWith('/')) return 'file://' + albumArtUri
  return albumArtUri
}
export const isInList = (id: string, queue: Song[]) => queue.some((song) => song.id === id)
