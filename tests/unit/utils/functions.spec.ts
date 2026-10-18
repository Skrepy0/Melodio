import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  DEFAULT_COVER,
  checkPlayableUrl,
  fetchCoverFromWeb,
  getAccessibleUrl,
  getCachedCover,
  getCoverBase64,
  getCoverSrc,
  getNativeCoverUrl,
  getSongFromOnlineSong,
  hasUsableLocalCover,
  isInList,
  isPersistableCoverSource,
  isSafeCoverSource,
  parseSearchError,
} from '@/utils/functions'
import { makeOnlineSong, makeSong, makeSongs } from '../helpers/factories'
import { mockMethod, resetPlugins } from '../helpers/capacitor'

beforeEach(() => {
  resetPlugins()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getAccessibleUrl', () => {
  it('returns an empty string for empty input', () => {
    expect(getAccessibleUrl('')).toBe('')
  })

  it('passes through Capacitor local-server URLs and remote URLs', () => {
    expect(getAccessibleUrl('https://localhost/_capacitor_file_/a.mp3')).toBe(
      'https://localhost/_capacitor_file_/a.mp3'
    )
    expect(getAccessibleUrl('http://localhost/_capacitor_file_/a.mp3')).toBe(
      'http://localhost/_capacitor_file_/a.mp3'
    )
    expect(getAccessibleUrl('https://cdn.example.com/a.mp3')).toBe('https://cdn.example.com/a.mp3')
  })

  it('routes content:// URIs through Capacitor.convertFileSrc', () => {
    const spy = vi.spyOn(Capacitor, 'convertFileSrc').mockReturnValue('converted://x')
    expect(getAccessibleUrl('content://media/1')).toBe('converted://x')
    expect(spy).toHaveBeenCalledWith('content://media/1')
  })

  it('encodes file:// paths while keeping the scheme', () => {
    expect(getAccessibleUrl('file:///music/My Song.mp3')).toBe('file:///music/My%20Song.mp3')
  })

  it('turns absolute paths into file URLs', () => {
    expect(getAccessibleUrl('/music/My Song.mp3')).toBe('file:///music/My%20Song.mp3')
  })

  it('URI-encodes anything else', () => {
    expect(getAccessibleUrl('music/My Song.mp3')).toBe('music/My%20Song.mp3')
  })
})

describe('checkPlayableUrl', () => {
  it('returns false for empty input', async () => {
    expect(await checkPlayableUrl('')).toBe(false)
  })

  it('checks local files through Filesystem.stat', async () => {
    mockMethod('Filesystem', 'stat', () => ({ type: 'file' }))
    await expect(checkPlayableUrl('file:///music/a.mp3')).resolves.toBe(true)
  })

  it('returns false when the local file is a directory or missing', async () => {
    mockMethod('Filesystem', 'stat', () => ({ type: 'directory' }))
    await expect(checkPlayableUrl('file:///music')).resolves.toBe(false)

    mockMethod('Filesystem', 'stat', () => {
      throw new Error('not found')
    })
    await expect(checkPlayableUrl('file:///music/missing.mp3')).resolves.toBe(false)
  })

  it('resolves Capacitor local-server URLs back to file paths', async () => {
    const stat = mockMethod('Filesystem', 'stat', () => ({ type: 'file' }))
    await expect(
      checkPlayableUrl('https://localhost/_capacitor_file_/music/My%20Song.mp3')
    ).resolves.toBe(true)
    expect(stat).toHaveBeenCalledWith({ path: 'music/My Song.mp3' })
  })

  it('probes remote URLs with a HEAD request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await expect(checkPlayableUrl('https://example.com/a.mp3')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/a.mp3',
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('returns false when the remote request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(checkPlayableUrl('https://example.com/a.mp3')).resolves.toBe(false)
  })

  it('returns false for unknown protocols', async () => {
    expect(await checkPlayableUrl('ftp://example.com/a.mp3')).toBe(false)
  })
})

describe('getCoverBase64', () => {
  it('returns empty for empty input', async () => {
    expect(await getCoverBase64('')).toBe('')
  })

  it('wraps JPEG data with a JPEG mime type', async () => {
    mockMethod('Filesystem', 'readFile', () => ({ data: '/9j/4AAQSkZJRg' }))
    expect(await getCoverBase64('content://art/1')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg')
  })

  it.each([
    ['iVBORw0KGgo', 'image/png'],
    ['R0lGODlh', 'image/gif'],
    ['UklGRhIAAAB', 'image/webp'],
    ['Qk0AAAAA', 'image/bmp'],
  ])('sniffs the mime type for %s', async (data, mime) => {
    mockMethod('Filesystem', 'readFile', () => ({ data }))
    expect(await getCoverBase64('content://art/1')).toBe(`data:${mime};base64,${data}`)
  })

  it('returns empty when the read yields no string', async () => {
    mockMethod('Filesystem', 'readFile', () => ({ data: new Uint8Array() }))
    expect(await getCoverBase64('content://art/1')).toBe('')
  })

  it('swallows read errors', async () => {
    mockMethod('Filesystem', 'readFile', () => {
      throw new Error('denied')
    })
    expect(await getCoverBase64('content://art/1')).toBe('')
  })
})

describe('getCoverSrc', () => {
  it('returns empty for blank input', () => {
    expect(getCoverSrc('')).toBe('')
    expect(getCoverSrc('   ')).toBe('')
    expect(getCoverSrc(undefined as any)).toBe('')
  })

  it('passes through renderable schemes', () => {
    for (const src of [
      'data:image/png;base64,abc',
      'http://example.com/a.jpg',
      'https://example.com/a.jpg',
      'blob:https://example.com/x',
    ]) {
      expect(getCoverSrc(src)).toBe(src)
    }
  })

  it('converts local paths through Capacitor', () => {
    vi.spyOn(Capacitor, 'convertFileSrc').mockReturnValue('converted')
    expect(getCoverSrc('/data/cover.jpg')).toBe('converted')
    expect(getCoverSrc('content://media/1')).toBe('converted')
  })

  it('trims whitespace before deciding', () => {
    expect(getCoverSrc('  https://example.com/a.jpg  ')).toBe('https://example.com/a.jpg')
  })
})

describe('cover source validation', () => {
  it('accepts safe render schemes and rejects the rest', () => {
    expect(isSafeCoverSource('https://example.com/a.jpg')).toBe(true)
    expect(isSafeCoverSource('file:///a.jpg')).toBe(true)
    expect(isSafeCoverSource('content://media/1')).toBe(true)
    expect(isSafeCoverSource('data:image/png;base64,abc')).toBe(true)

    expect(isSafeCoverSource('http://example.com/a.jpg')).toBe(false)
    expect(isSafeCoverSource('javascript:alert(1)')).toBe(false)
    expect(isSafeCoverSource('data:text/html;base64,abc')).toBe(false)
    expect(isSafeCoverSource('')).toBe(false)
    expect(isSafeCoverSource(null)).toBe(false)
    expect(isSafeCoverSource(undefined)).toBe(false)
  })

  it('only persists https and image data URLs', () => {
    expect(isPersistableCoverSource('https://example.com/a.jpg')).toBe(true)
    expect(isPersistableCoverSource('data:image/jpeg;base64,abc')).toBe(true)
    expect(isPersistableCoverSource('content://media/1')).toBe(false)
    expect(isPersistableCoverSource('file:///a.jpg')).toBe(false)
    expect(isPersistableCoverSource(null)).toBe(false)
  })

  it('treats content:// artwork as unusable locally', () => {
    expect(hasUsableLocalCover('/data/a.jpg')).toBe(true)
    expect(hasUsableLocalCover('data:image/png;base64,abc')).toBe(true)
    expect(hasUsableLocalCover('content://media/albumart/1')).toBe(false)
    expect(hasUsableLocalCover('   ')).toBe(false)
    expect(hasUsableLocalCover(null)).toBe(false)
  })
})

describe('isInList', () => {
  it('matches by song id', () => {
    const songs = makeSongs(3)
    expect(isInList('song-2', songs)).toBe(true)
    expect(isInList('nope', songs)).toBe(false)
    expect(isInList('song-1', [])).toBe(false)
  })
})

describe('cover cache and native cover URL', () => {
  it('falls back to local artwork when no web cover is cached', () => {
    const song = makeSong({ title: 'Cache Miss', artist: 'Nobody', albumArtUri: '/data/a.jpg' })
    expect(getCachedCover('Cache Miss', 'Nobody')).toBe('')
    expect(getNativeCoverUrl(song)).toBe('/data/a.jpg')
  })

  it('prefers a cached web cover when web lookup is allowed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          resultCount: 1,
          results: [{ artworkUrl100: 'https://art/100x100bb.jpg' }],
        }),
      })
    )
    const url = await fetchCoverFromWeb('Cached Title', 'Cached Artist')
    expect(url).toBe('https://art/600x600bb.jpg')
    expect(getCachedCover('  cached title ', 'CACHED ARTIST')).toBe('https://art/600x600bb.jpg')

    const song = makeSong({
      title: 'Cached Title',
      artist: 'Cached Artist',
      albumArtUri: 'content://stale/1',
    })
    expect(getNativeCoverUrl(song)).toBe('https://art/600x600bb.jpg')
    expect(getNativeCoverUrl(song, false)).toBe('content://stale/1')
  })

  it('ignores a cache entry when web lookup is disabled', () => {
    const song = makeSong({ title: 'Cached Title', artist: 'Cached Artist', albumArtUri: '' })
    expect(getNativeCoverUrl(song, false)).toBe('')
  })
})

describe('fetchCoverFromWeb', () => {
  const jsonResponse = (body: any) => ({ json: async () => body })

  it('uses the iTunes result and upgrades the artwork size', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ resultCount: 1, results: [{ artworkUrl100: 'https://a/100x100bb.jpg' }] })
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchCoverFromWeb('Itunes Song', 'Itunes Artist')).resolves.toBe(
      'https://a/600x600bb.jpg'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('itunes.apple.com')
  })

  it('falls back to Deezer when iTunes has no result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resultCount: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ album: { cover_big: 'https://d/big.jpg' } }] })
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchCoverFromWeb('Deezer Song', 'Deezer Artist')).resolves.toBe(
      'https://d/big.jpg'
    )
  })

  it('falls back to MusicBrainz + Cover Art Archive and verifies the image', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resultCount: 0 }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ recordings: [{ releases: [{ 'release-group': { id: 'mbid-1' } }] }] })
      )
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchCoverFromWeb('MB Song', 'MB Artist')).resolves.toBe(
      'https://coverartarchive.org/release-group/mbid-1/front-250'
    )
  })

  it('does not cache a MusicBrainz cover when the image check fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resultCount: 0 }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ recordings: [{ releases: [{ 'release-group': { id: 'mbid-2' } }] }] })
      )
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchCoverFromWeb('MB Miss', 'MB Artist')).resolves.toBeNull()
    expect(getCachedCover('MB Miss', 'MB Artist')).toBe('')
  })

  it('returns null when every provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(fetchCoverFromWeb('Offline Song', 'Offline Artist')).resolves.toBeNull()
  })

  it('rejects provider results that are not safe to render', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ resultCount: 1, results: [{ artworkUrl100: 'javascript:alert(1)' }] })
        )
    )
    await expect(fetchCoverFromWeb('Unsafe Song', 'Unsafe Artist')).resolves.toBeNull()
    expect(getCachedCover('Unsafe Song', 'Unsafe Artist')).toBe('')
  })

  it('serves repeated lookups from the cache without fetching again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ resultCount: 1, results: [{ artworkUrl100: 'https://a/100x100bb.jpg' }] })
      )
    vi.stubGlobal('fetch', fetchMock)
    await fetchCoverFromWeb('Repeat Song', 'Repeat Artist')
    await fetchCoverFromWeb('Repeat Song', 'Repeat Artist')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('passes an abort signal to provider requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultCount: 0 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await fetchCoverFromWeb('Signal Song', 'Signal Artist', controller.signal)
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})

describe('getSongFromOnlineSong', () => {
  it('maps the online payload to the local song shape', () => {
    const online = makeOnlineSong()
    const song = getSongFromOnlineSong(online)
    expect(song).toMatchObject({
      id: 'online-1',
      displayName: 'Online Song',
      uri: 'https://example.com/song.mp3',
      size: 2048,
      mimeType: 'mp3',
      mediaType: 'audio',
      duration: 200000,
      title: 'Online Song',
      artist: 'Online Artist',
      album: 'Online Album',
      albumArtUri: 'https://example.com/cover.jpg',
    })
    expect(song.dateAdded).toBeGreaterThan(0)
  })

  it('tolerates missing download and cover URLs', () => {
    const song = getSongFromOnlineSong(
      makeOnlineSong({ download_url: null, cover_url: null, identifier: '7' })
    )
    expect(song.uri).toBe('')
    expect(song.albumArtUri).toBe('')
    expect(song.id).toBe('7')
  })
})

describe('parseSearchError', () => {
  it('extracts the status code and JSON body', () => {
    const error = new Error('Request failed with code: 500\nBody: {"detail":"boom"}')
    expect(parseSearchError(error)).toEqual({ code: 500, body: { detail: 'boom' } })
  })

  it('keeps a non-JSON body as text', () => {
    const error = new Error('Request failed with code: 404\nBody: not json')
    expect(parseSearchError(error)).toEqual({ code: 404, body: 'not json' })
  })

  it('defaults to code -1 with the message as body', () => {
    expect(parseSearchError(new Error('Missing keyword'))).toEqual({
      code: -1,
      body: 'Missing keyword',
    })
  })

  it('handles non-Error values', () => {
    expect(parseSearchError('plain failure')).toEqual({ code: -1, body: 'plain failure' })
    expect(parseSearchError(null)).toEqual({ code: -1, body: '' })
  })
})

describe('DEFAULT_COVER', () => {
  it('is an inline SVG data URL', () => {
    expect(DEFAULT_COVER.startsWith('data:image/svg+xml,')).toBe(true)
  })
})
