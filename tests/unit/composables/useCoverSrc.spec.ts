import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useCoverSrc } from '@/composables/useCoverSrc'
import { DEFAULT_COVER, fetchCoverFromWeb } from '@/utils/functions'
import { useAppStore } from '@/stores/app'
import { freshPinia } from '../helpers/store'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return {
    ...actual,
    fetchCoverFromWeb: vi.fn(),
  }
})

const mockedFetch = vi.mocked(fetchCoverFromWeb)

function mountCover(song: any) {
  let api: ReturnType<typeof useCoverSrc>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCoverSrc(song)
        return () => h('div')
      },
    })
  )
  return { wrapper, api: api! }
}

beforeEach(() => {
  freshPinia()
  mockedFetch.mockReset()
  mockedFetch.mockResolvedValue('https://cdn.example.com/cover.jpg')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCoverSrc', () => {
  it('uses the embedded artwork', async () => {
    const song = ref<any>({ title: 'A', artist: 'B', albumArtUri: 'file:///art/1.jpg' })
    const { api } = mountCover(song)
    await nextTick()

    expect(api.coverSrc.value).toContain('art/1.jpg')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('falls back to the default cover for a null song', async () => {
    const { api } = mountCover(ref(null))
    await nextTick()
    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
  })

  it('fetches from the web when there is no local artwork', async () => {
    const song = ref<any>({ title: 'A', artist: 'B', albumArtUri: '' })
    const { api } = mountCover(song)
    await nextTick()
    await vi.waitFor(() => expect(api.coverSrc.value).toBe('https://cdn.example.com/cover.jpg'))

    expect(mockedFetch).toHaveBeenCalledWith('A', 'B', expect.any(AbortSignal))
  })

  it('does not look up the web when the setting is off', async () => {
    const store = useAppStore()
    store.setCanFetchCoverFromWeb(false)
    const { api } = mountCover(ref<any>({ title: 'A', artist: 'B', albumArtUri: '' }))
    await nextTick()

    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('uses the default cover when the lookup fails', async () => {
    mockedFetch.mockResolvedValue(null as any)
    const { api } = mountCover(ref<any>({ title: 'A', artist: 'B', albumArtUri: '' }))
    await nextTick()
    await vi.waitFor(() => expect(api.coverSrc.value).toBe(DEFAULT_COVER))
  })

  it('retries the web lookup once when the local image errors', async () => {
    const song = ref<any>({ title: 'A', artist: 'B', albumArtUri: 'file:///broken.jpg' })
    const { api } = mountCover(song)
    await nextTick()
    expect(api.coverSrc.value).toContain('broken.jpg')

    api.onCoverError()
    await vi.waitFor(() => expect(api.coverSrc.value).toBe('https://cdn.example.com/cover.jpg'))
    expect(mockedFetch).toHaveBeenCalledTimes(1)

    // A second error does not trigger another request.
    api.onCoverError()
    await nextTick()
    expect(api.coverSrc.value).toBe(DEFAULT_COVER)
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('rejects unsafe artwork schemes', async () => {
    const { api } = mountCover(
      ref<any>({ title: 'A', artist: 'B', albumArtUri: 'javascript:alert(1)' })
    )
    await nextTick()
    await vi.waitFor(() => expect(api.coverSrc.value).toBe('https://cdn.example.com/cover.jpg'))
  })

  it('aborts a pending lookup when the song changes', async () => {
    let resolveFirst: (value: any) => void = () => {}
    mockedFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)) as any
    )
    const song = ref<any>({ title: 'A', artist: '', albumArtUri: '' })
    const { api } = mountCover(song)
    await nextTick()

    song.value = { title: 'B', artist: '', albumArtUri: 'file:///b.jpg' }
    await nextTick()
    resolveFirst('https://cdn.example.com/late.jpg')
    await nextTick()

    expect(api.coverSrc.value).toContain('b.jpg')
  })
})
