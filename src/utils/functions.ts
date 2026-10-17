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
  if (!uri) return ''
  try {
    const result = await Filesystem.readFile({ path: uri })
    const base64 = typeof result.data === 'string' ? result.data : ''
    if (!base64) return ''
    // Embedded artwork is not always JPEG; pick the type from the header so the
    // browser does not reject the data URL.
    let mime = 'image/jpeg'
    if (base64.startsWith('iVBOR')) mime = 'image/png'
    else if (base64.startsWith('R0lGOD')) mime = 'image/gif'
    else if (base64.startsWith('UklGR')) mime = 'image/webp'
    else if (base64.startsWith('Qk0')) mime = 'image/bmp'
    return `data:${mime};base64,${base64}`
  } catch (error) {
    console.error('读取封面失败:', error)
    return ''
  }
}
/**
 * Turn a stored cover reference into something an <img> can load.
 * Data URLs and remote URLs pass through; local paths and content:// URIs go
 * through Capacitor's local server, which the WebView cannot load on its own.
 */
export const getCoverSrc = (path: string): string => {
  const trimmed = path?.trim() ?? ''
  if (!trimmed) return ''
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }
  return Capacitor.convertFileSrc(trimmed)
}

export const DEFAULT_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#888"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'
  )

export const isInList = (id: string, queue: Song[]) => queue.some((song) => song.id === id)

/**
 * Covers resolved from the web during this session. Any component that calls
 * {@link fetchCoverFromWeb} populates it, so the native player can reuse a URL
 * that has already been looked up instead of searching again.
 */
const coverCache = new Map<string, string>()
const coverCacheKey = (title: string, artist: string) =>
  `${(title || '').trim().toLowerCase()}\u0000${(artist || '').trim().toLowerCase()}`

export const getCachedCover = (title: string, artist: string): string =>
  coverCache.get(coverCacheKey(title, artist)) ?? ''

/**
 * Cover reference handed to the native player. Local artwork is passed through
 * untouched (the native side handles content://, file:// and data: URIs);
 * otherwise a previously fetched web cover is used. When nothing is known yet,
 * returns '' and the notification falls back to the default icon.
 */
export const getNativeCoverUrl = (
  song: Pick<Song, 'title' | 'artist' | 'albumArtUri'>,
  allowWeb = true
): string => {
  const local = (song.albumArtUri || '').trim()
  if (local) return local
  return allowWeb ? getCachedCover(song.title, song.artist || '') : ''
}

export async function fetchCoverFromWeb(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<string | null> {
  const cacheKey = coverCacheKey(title, artist)
  const cached = coverCache.get(cacheKey)
  if (cached) return cached

  const store = (url: string | null): string | null => {
    if (url) coverCache.set(cacheKey, url)
    return url
  }

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${title} ${artist}`
    )}&media=music&limit=1`
    const r = await fetch(itunesUrl, { signal })
    const d = await r.json()
    if (d.resultCount > 0) {
      const art = d.results[0].artworkUrl100?.replace('100x100bb', '600x600bb')
      if (art) return store(art)
    }
  } catch {
    /* ignore */
  }

  try {
    const query = encodeURIComponent(`track:"${title}" artist:"${artist}"`)
    const deezerUrl = `https://api.deezer.com/search?q=${query}&limit=1`
    const r = await fetch(deezerUrl, { signal })
    const d = await r.json()
    if (d.data?.length > 0) {
      const cover = d.data[0].album?.cover_big || d.data[0].album?.cover_xl
      if (cover) return store(cover)
    }
  } catch {
    /* ignore */
  }

  try {
    const mbQuery = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`)
    const mbUrl = `https://musicbrainz.org/ws/2/recording/?query=${mbQuery}&fmt=json&limit=1`
    const r = await fetch(mbUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal,
    })
    const d = await r.json()
    const recordings = d.recordings
    if (recordings?.length > 0) {
      const mbid = recordings[0].releases?.[0]?.['release-group']?.id
      if (mbid) {
        const coverUrl = `https://coverartarchive.org/release-group/${mbid}/front-250`
        const imgCheck = await fetch(coverUrl, { method: 'HEAD', signal })
        if (imgCheck.ok) return store(coverUrl)
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
