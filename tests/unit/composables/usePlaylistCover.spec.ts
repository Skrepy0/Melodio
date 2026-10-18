import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePlaylistCover } from '@/composables/usePlaylistCover'
import { DEFAULT_COVER, fetchCoverFromWeb } from '@/utils/functions'
import { useAppStore } from '@/stores/app'
import { makePlaylist, makeSong } from '../helpers/factories'
import { freshPinia } from '../helpers/store'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, fetchCoverFromWeb: vi.fn() }
})

const mockedFetch = vi.mocked(fetchCoverFromWeb)

function mountCover(playlist: any, enabled = true) {
  let api: ReturnType<typeof usePlaylistCover>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = usePlaylistCover(playlist, enabled)
        return () => h('div')
      },
    })
  )
  return { wrapper, api: api! }
}

beforeEach(() => {
  freshPinia()
  mockedFetch.mockReset()
  mockedFetch.mockResolvedValue('https://cdn.example.com/web.jpg')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePlaylistCover', () => {
  it('returns an empty source for a missing playlist', async () => {
    const { api } = mountCover(ref(null))
    await nextTick()
    expect(api.coverSrc.value).toBe('')
  })

  it('never shows artwork for the liked list', async () => {
    const { api } = mountCover(ref(makePlaylist({ id: 0, coverUrl: 'https://x/cover.jpg' })))
    await nextTick()
    expect(api.coverSrc.value).toBe('')
  })

  it('prefers the user-chosen cover', async () => {
    const { api } = mountCover(
      ref(
        makePlaylist({ id: 1, coverUrl: 'https://cdn.example.com/custom.jpg', data: [makeSong()] })
      )
    )
    await nextTick()
    expect(api.coverSrc.value).toBe('https://cdn.example.com/custom.jpg')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('rejects an unsafe custom cover', async () => {
    const { api } = mountCover(
      ref(makePlaylist({ id: 1, coverUrl: 'javascript:alert(1)', data: [] }))
    )
    await nextTick()
    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
  })

  it('uses the first song with embedded artwork', async () => {
    const songs = [
      makeSong({ id: 'a', albumArtUri: '' }),
      makeSong({ id: 'b', albumArtUri: 'file:///art/b.jpg' }),
    ]
    const { api } = mountCover(ref(makePlaylist({ id: 1, data: songs })))
    await nextTick()
    expect(api.coverSrc.value).toContain('art/b.jpg')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('consults the live library for stale playlist snapshots', async () => {
    const store = useAppStore()
    store.setAllSongs([makeSong({ id: 'a', albumArtUri: 'file:///live/a.jpg' })])
    const { api } = mountCover(
      ref(makePlaylist({ id: 1, data: [makeSong({ id: 'a', albumArtUri: '' })] }))
    )
    await nextTick()
    expect(api.coverSrc.value).toContain('live/a.jpg')
  })

  it('falls back to a web lookup', async () => {
    const { api } = mountCover(
      ref(makePlaylist({ id: 1, data: [makeSong({ title: 'T', artist: 'A', albumArtUri: '' })] }))
    )
    await vi.waitFor(() => expect(api.coverSrc.value).toBe('https://cdn.example.com/web.jpg'))
    expect(mockedFetch).toHaveBeenCalledWith('T', 'A', expect.any(AbortSignal))
  })

  it('uses the default cover when disabled', async () => {
    const { api } = mountCover(
      ref(makePlaylist({ id: 1, data: [makeSong({ albumArtUri: '' })] })),
      false
    )
    await nextTick()
    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('uses the default cover when the web setting is off', async () => {
    useAppStore().setCanFetchCoverFromWeb(false)
    const { api } = mountCover(ref(makePlaylist({ id: 1, data: [makeSong({ albumArtUri: '' })] })))
    await nextTick()
    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
  })

  it('uses the default cover for an empty playlist', async () => {
    const { api } = mountCover(ref(makePlaylist({ id: 1, data: [] })))
    await nextTick()
    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
  })

  it('re-resolves when the playlist contents change', async () => {
    const playlist = ref(makePlaylist({ id: 1, data: [makeSong({ albumArtUri: '' })] }))
    const { api } = mountCover(playlist)
    await vi.waitFor(() => expect(api.coverSrc.value).toBe('https://cdn.example.com/web.jpg'))

    playlist.value.data = [makeSong({ albumArtUri: 'file:///new.jpg' })]
    await vi.waitFor(() => expect(api.coverSrc.value).toContain('new.jpg'))
  })
})
