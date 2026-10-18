import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanAllAudio, getSongInfoByPath } from '@/utils/audioScanner'
import { requestMediaPermissions } from '@/utils/permission'
import { getCoverBase64 } from '@/utils/functions'
import { mockMethod, resetPlugins } from '../helpers/capacitor'
import { makeOnlineSong, makeSong } from '../helpers/factories'

vi.mock('@/utils/permission', () => ({
  requestMediaPermissions: vi.fn(),
}))

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, getCoverBase64: vi.fn() }
})

const mockedPermissions = vi.mocked(requestMediaPermissions)
const mockedCover = vi.mocked(getCoverBase64)

const mediaStore = (method: string, impl?: any) => mockMethod('CapacitorMediaStore', method, impl)

beforeEach(() => {
  resetPlugins()
  mockedPermissions.mockReset()
  mockedPermissions.mockResolvedValue({ audio: true, photo: true, video: true })
  mockedCover.mockReset()
  mockedCover.mockResolvedValue('')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scanAllAudio', () => {
  it('returns the scanned songs', async () => {
    const songs = [makeSong({ id: '1' }), makeSong({ id: '2' })]
    const getMedias = mediaStore('getMediasByType', () => ({ media: songs }))

    const result = await scanAllAudio()

    expect(getMedias).toHaveBeenCalledWith({
      mediaType: 'audio',
      sortBy: 'TITLE',
      includeExternal: true,
    })
    expect(result).toEqual({ success: true, songs })
  })

  it('inlines artwork when it can be read', async () => {
    const songs = [
      makeSong({ id: '1', albumArtUri: 'content://art/1' }),
      makeSong({ id: '2', albumArtUri: 'content://art/2' }),
    ]
    mediaStore('getMediasByType', () => ({ media: songs }))
    mockedCover.mockImplementation(async (uri?: string) =>
      uri === 'content://art/1' ? 'data:image/jpeg;base64,AAA' : ''
    )

    const result = await scanAllAudio()

    expect(result.songs[0].albumArtUri).toBe('data:image/jpeg;base64,AAA')
    // Unreadable artwork keeps its content:// URI for the local file server.
    expect(result.songs[1].albumArtUri).toBe('content://art/2')
  })

  it('reports an empty library', async () => {
    mediaStore('getMediasByType', () => ({ media: [] }))
    await expect(scanAllAudio()).resolves.toEqual({
      success: false,
      songs: [],
      error: '未找到任何音频文件',
    })

    mediaStore('getMediasByType', () => undefined)
    await expect(scanAllAudio()).resolves.toMatchObject({ success: false })
  })

  it('retries once after requesting permission', async () => {
    const getMedias = mediaStore('getMediasByType', () => {
      throw new Error('Permission denied')
    })

    const result = await scanAllAudio()

    expect(mockedPermissions).toHaveBeenCalledTimes(1)
    expect(getMedias).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Permission denied')
  })

  it('recognises a permission_denied error code', async () => {
    mediaStore('getMediasByType', () => Promise.reject({ code: 'permission_denied' }))
    await scanAllAudio()
    expect(mockedPermissions).toHaveBeenCalledTimes(1)
  })

  it('does not retry non-permission errors', async () => {
    mediaStore('getMediasByType', () => Promise.reject(new Error('数据库损坏')))
    const result = await scanAllAudio()
    expect(mockedPermissions).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, songs: [], error: '数据库损坏' })
  })

  it('does not retry when retryOnPermission is false', async () => {
    mediaStore('getMediasByType', () => Promise.reject(new Error('permission denied')))
    await scanAllAudio(false)
    expect(mockedPermissions).not.toHaveBeenCalled()
  })

  it('falls back to a generic error message', async () => {
    mediaStore('getMediasByType', () => Promise.reject({}))
    const result = await scanAllAudio()
    expect(result.error).toBe('扫描过程中发生未知错误')
  })
})

describe('getSongInfoByPath', () => {
  it('returns null for an empty path', async () => {
    await expect(getSongInfoByPath('', makeOnlineSong())).resolves.toBeNull()
  })

  it('merges native metadata with the original song', async () => {
    mediaStore('getMediaMetadata', () => ({
      media: {
        id: 42,
        displayName: 'Native Name',
        title: 'Native Title',
        artist: 'Native Artist',
        album: 'Native Album',
        uri: 'file:///music/a.mp3',
        size: 999,
        mimeType: 'audio/mpeg',
        dateAdded: 10,
        dateModified: 20,
        duration: 123000,
        track: 3,
        year: 2020,
        albumArtUri: 'content://art/42',
      },
    }))

    const song = await getSongInfoByPath('/music/a.mp3', makeOnlineSong())

    expect(song).toEqual({
      id: '42',
      displayName: 'Native Name',
      uri: 'file:///music/a.mp3',
      size: 999,
      mimeType: 'audio/mpeg',
      dateAdded: 10,
      dateModified: 20,
      mediaType: 'audio',
      duration: 123000,
      title: 'Native Title',
      artist: 'Native Artist',
      album: 'Native Album',
      track: 3,
      year: 2020,
      albumArtUri: 'content://art/42',
    })
  })

  it('falls back to the original song when metadata is missing', async () => {
    mediaStore('getMediaMetadata', () => ({}))

    const original = makeOnlineSong({
      name: 'Online Song',
      singers: 'Online Artist',
      album: 'Online Album',
      cover_url: 'https://example.com/cover.jpg',
      file_size_bytes: 2048,
      duration: 200,
      ext: 'mp3',
    })
    const song = await getSongInfoByPath('/music/a.mp3', original)

    expect(song).toMatchObject({
      id: 'Kuwo:online-1',
      displayName: 'Online Song',
      uri: '/music/a.mp3',
      size: 2048,
      title: 'Online Song',
      artist: 'Online Artist',
      album: 'Online Album',
      duration: 200000,
      albumArtUri: 'https://example.com/cover.jpg',
    })
    expect(song?.dateAdded).toBeTypeOf('number')
  })

  it('ignores invalid metadata placeholders', async () => {
    mediaStore('getMediaMetadata', () => ({
      media: {
        title: '<unknown>',
        artist: '未知艺术家',
        album: '未知专辑',
        displayName: '   ',
      },
    }))

    const song = await getSongInfoByPath('/music/a.mp3', makeOnlineSong())

    expect(song).toMatchObject({
      title: 'Online Song',
      artist: 'Online Artist',
      album: 'Online Album',
      displayName: 'Online Song',
    })
  })

  it('returns null when the native lookup throws', async () => {
    mediaStore('getMediaMetadata', () => Promise.reject(new Error('not found')))
    await expect(getSongInfoByPath('/missing.mp3', makeOnlineSong())).resolves.toBeNull()
  })
})
