import { Filesystem } from '@capacitor/filesystem'
import { OnlineSong, Song } from './interface'
import { Capacitor } from '@capacitor/core'
import { USER_AGENT } from '@/config'

export const getAccessibleUrl = (path: string): string => {
  if (!path) return ''

  if (
    path.startsWith('https://localhost/_capacitor_file_/') ||
    path.startsWith('http://localhost/_capacitor_file_/')
  ) {
    return path
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  if (path.startsWith('content://')) {
    return Capacitor.convertFileSrc(path)
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

export const isInList = (id: string, queue: Song[]) => queue.some((song) => song.id === id)
export async function fetchCoverFromWeb(title: string, artist: string): Promise<string | null> {
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${title} ${artist}`
    )}&media=music&limit=1`
    const r = await fetch(itunesUrl)
    const d = await r.json()
    if (d.resultCount > 0) {
      const art = d.results[0].artworkUrl100?.replace('100x100bb', '600x600bb')
      if (art) return art
    }
  } catch {
    /* ignore */
  }

  try {
    const query = encodeURIComponent(`track:"${title}" artist:"${artist}"`)
    const deezerUrl = `https://api.deezer.com/search?q=${query}&limit=1`
    const r = await fetch(deezerUrl)
    const d = await r.json()
    if (d.data?.length > 0) {
      const cover = d.data[0].album?.cover_big || d.data[0].album?.cover_xl
      if (cover) return cover
    }
  } catch {
    /* ignore */
  }

  try {
    const mbQuery = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`)
    const mbUrl = `https://musicbrainz.org/ws/2/recording/?query=${mbQuery}&fmt=json&limit=1`
    const r = await fetch(mbUrl, {
      headers: { 'User-Agent': USER_AGENT },
    })
    const d = await r.json()
    const recordings = d.recordings
    if (recordings?.length > 0) {
      const mbid = recordings[0].releases?.[0]?.['release-group']?.id
      if (mbid) {
        const coverUrl = `https://coverartarchive.org/release-group/${mbid}/front-250`
        const imgCheck = await fetch(coverUrl, { method: 'HEAD' })
        if (imgCheck.ok) return coverUrl
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

export function getSongFromOnlineSong(song: OnlineSong): Song {
  return {
    id: song.identifier.toString(),
    displayName: song.name,
    uri: song.download_url || '',
    size: song.file_size_bytes,
    mimeType: song.ext,
    dateAdded: Date.now(),
    dateModified: Date.now(),
    mediaType: 'audio',
    duration: song.duration * 1000,
    title: song.name,
    artist: song.singers,
    album: song.album,
    track: 0,
    year: 0,
    albumArtUri: song.cover_url || '',
  }
}

export function parseSearchError(e: any): { code: number; body: any } {
  const errorMessage = e?.message || String(e || '')
  const result: { code: number; body: any } = { code: -1, body: errorMessage }

  const codeMatch = errorMessage.match(/Request failed with code: (\d+)/)
  if (codeMatch) {
    result.code = parseInt(codeMatch[1], 10)

    const bodyMatch = errorMessage.match(/Body: (.+)/)
    if (bodyMatch) {
      const rawBody = bodyMatch[1].trim()
      try {
        result.body = JSON.parse(rawBody)
      } catch {
        result.body = rawBody
      }
    }
  }

  return result
}
