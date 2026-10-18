import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OnlineSearchPage from '@/views/OnlineSearchPage.vue'
import OnlineSongItemSelectable from '@/components/song/OnlineSongItemSelectable.vue'
import SearchBox from '@/components/SearchBox.vue'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import { useAppStore } from '@/stores/app'
import { makeOnlineSong } from '../helpers/factories'
import { resetPlugins } from '../helpers/capacitor'
import { mountComponent } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, fetchCoverFromWeb: vi.fn(async () => null) }
})

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/utils/musicDownloader', () => ({
  downloadMusic: vi.fn(),
  downloadMultipleSongs: vi.fn(),
  isSongDownloading: vi.fn(() => false),
}))
vi.mock('@/utils/createPlaylistSelector', () => ({ showPlaylistSelector: vi.fn() }))
vi.mock('@/utils/createInfo', () => ({ showSongInfo: vi.fn() }))
vi.mock('@/router', () => ({
  default: { back: vi.fn(), push: vi.fn(async () => {}) },
}))

import toast from '@/utils/createToast'
import { downloadMusic, downloadMultipleSongs, isSongDownloading } from '@/utils/musicDownloader'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
import { showSongInfo } from '@/utils/createInfo'
import router from '@/router'

const mounted: any[] = []

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
  vi.mocked(isSongDownloading).mockReturnValue(false)
})

afterEach(async () => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted.length = 0
  vi.restoreAllMocks()
})

function mountPage() {
  const wrapper = mountComponent(OnlineSearchPage)
  mounted.push(wrapper)
  return wrapper
}

/** Invoke the row menu handler directly with the row's identifier selected. */
async function selectMenu(wrapper: any, index: number, value: string, songs: any[]) {
  const item = wrapper.findAllComponents(OnlineSongItemSelectable)[index]
  item.vm.$emit('update:dropdownOpen', true)
  await nextTick()
  const handler = item.props('onMenuItemSelect')
  await handler({ value })
  await nextTick()
  return item
}

function seedResults(
  songs = [makeOnlineSong(), makeOnlineSong({ identifier: 'online-2', name: 'Second' })]
) {
  const store = useAppStore()
  store.searchResults = songs
  store.hasSearched = true
  return { store, songs }
}

describe('OnlineSearchPage', () => {
  it('shows the initial hint before searching', () => {
    const wrapper = mountPage()
    expect(wrapper.find('.status-placeholder').exists()).toBe(true)
    expect(wrapper.findAllComponents(OnlineSongItemSelectable)).toHaveLength(0)
  })

  it('renders the results', async () => {
    seedResults()
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.findAllComponents(OnlineSongItemSelectable)).toHaveLength(2)
  })

  it('shows the empty state after a search with no results', async () => {
    const store = useAppStore()
    store.hasSearched = true
    store.searchResults = []
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.find('.status-placeholder').exists()).toBe(true)
  })

  it('shows the search error', async () => {
    const store = useAppStore()
    store.hasSearched = true
    store.searchError = 'boom'
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.find('.status-placeholder.error').text()).toContain('boom')
  })

  it('shows the loading indicator', async () => {
    seedResults()
    const store = useAppStore()
    store.isLoading = true
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.find('.loading-indicator').exists()).toBe(true)
  })

  it('goes back', async () => {
    const wrapper = mountPage()
    await wrapper.find('.header-back').trigger('click')
    expect(router.back).toHaveBeenCalled()
  })

  it('searches from the search box', async () => {
    const store = useAppStore()
    const search = vi.spyOn(store, 'search').mockResolvedValue(undefined)
    const wrapper = mountPage()
    await nextTick()

    const box = wrapper.findComponent(SearchBox)
    await box.vm.$emit('update:modelValue', 'jay')
    await box.vm.$emit('search', 'jay')

    await vi.waitFor(() => expect(search).toHaveBeenCalled())
    expect(search.mock.calls[0][0]).toBe('jay')
  })

  it('does not search while loading', async () => {
    const store = useAppStore()
    store.isLoading = true
    const search = vi.spyOn(store, 'search').mockResolvedValue(undefined)
    const wrapper = mountPage()
    await nextTick()

    await wrapper.findComponent(SearchBox).vm.$emit('search', 'jay')
    expect(search).not.toHaveBeenCalled()
  })

  it('renders and uses the search history', async () => {
    const store = useAppStore()
    store.searchHistory = ['one', 'two']
    const wrapper = mountPage()
    await nextTick()

    expect(wrapper.findAll('.history-item')).toHaveLength(2)
    await wrapper.findAll('.history-main')[0].trigger('click')
    await nextTick()
    expect(store.searchKeyword).toBe('one')
    expect(wrapper.find('.history-panel').exists()).toBe(false)
  })

  it('removes and clears search history', async () => {
    const store = useAppStore()
    store.searchHistory = ['one', 'two']
    const wrapper = mountPage()
    await nextTick()

    await wrapper.findAll('.history-remove')[0].trigger('click')
    expect(store.searchHistory).toEqual(['two'])

    await wrapper.find('.history-clear').trigger('click')
    expect(store.searchHistory).toEqual([])
  })

  it('plays an online song', async () => {
    const { store, songs } = seedResults()
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[1].vm.$emit('click', songs[1])
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(1))
    expect(store.getPlayQueue()[0].title).toBe('Second')
  })

  it('toggles playback when the current online song is tapped', async () => {
    const { store, songs } = seedResults([makeOnlineSong()])
    store.setPlayQueue([])
    const toggle = vi.spyOn(store, 'togglePlay').mockResolvedValue()
    const wrapper = mountPage()
    await nextTick()

    // First tap queues and plays; simulate it being current.
    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('click', songs[0])
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(1))
    store.playData.currentIndex = 0
    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('click', songs[0])
    await vi.waitFor(() => expect(toggle).toHaveBeenCalled())
  })

  it('downloads a song from its menu', async () => {
    const { songs } = seedResults([makeOnlineSong()])
    vi.mocked(downloadMusic).mockResolvedValue({} as any)
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'download', songs)
    await vi.waitFor(() => expect(downloadMusic).toHaveBeenCalledWith(songs[0]))
    expect(toast.success).toHaveBeenCalled()
  })

  it('warns when the song is already downloading', async () => {
    seedResults([makeOnlineSong()])
    vi.mocked(isSongDownloading).mockReturnValue(true)
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'download', [])
    await vi.waitFor(() => expect(isSongDownloading).toHaveBeenCalled())
    expect(downloadMusic).not.toHaveBeenCalled()
  })

  it('warns when the download URL is missing', async () => {
    seedResults([makeOnlineSong({ download_url: '' })])
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'download', [])
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(downloadMusic).not.toHaveBeenCalled()
  })

  it('reports an invalid download URL', async () => {
    seedResults([
      makeOnlineSong({
        download_url_status: { ok: false, status_code: 403, reason: ['forbidden'] },
      }),
    ])
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'download', [])
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(downloadMusic).not.toHaveBeenCalled()
  })

  it('reports a download failure', async () => {
    seedResults([makeOnlineSong()])
    vi.mocked(downloadMusic).mockRejectedValue(new Error('disk full'))
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'download', [])
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('likes an online song', async () => {
    const { store, songs } = seedResults([makeOnlineSong()])
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'like', songs)
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(1))
    expect(toast.success).toHaveBeenCalled()
    expect(songs).toHaveLength(1)
  })

  it('refuses to like a duplicate', async () => {
    const { store, songs } = seedResults([makeOnlineSong()])
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'like', songs)
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(1))

    await selectMenu(wrapper, 0, 'like', songs)
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(songs).toHaveLength(1)
  })

  it('opens the song details', async () => {
    const { songs } = seedResults([makeOnlineSong()])
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'detail', songs)
    await vi.waitFor(() => expect(showSongInfo).toHaveBeenCalledWith(songs[0]))
  })

  it('adds a song to the liked list via the playlist selector', async () => {
    const { store } = seedResults([makeOnlineSong()])
    vi.mocked(showPlaylistSelector).mockResolvedValue({
      id: 0,
      name: 'Liked',
      data: [],
    } as any)
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'addToPlaylist', [])
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(1))
  })

  it('adds a song to a named playlist via the playlist selector', async () => {
    const { store } = seedResults([makeOnlineSong()])
    store.setSongLists([
      { id: 1, name: 'List', description: '', coverUrl: '', songCount: 0, data: [] },
    ])
    vi.mocked(showPlaylistSelector).mockResolvedValue({
      id: 1,
      name: 'List',
      data: [],
    } as any)
    const wrapper = mountPage()
    await nextTick()

    await selectMenu(wrapper, 0, 'addToPlaylist', [])
    await vi.waitFor(() => expect(store.getSongLists()[0].data).toHaveLength(1))
  })

  it('enters selection mode and selects all results', async () => {
    seedResults()
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))

    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    const items = wrapper.findAllComponents(OnlineSongItemSelectable)
    expect(items.every((i: any) => i.props('selected'))).toBe(true)
  })

  it('batch downloads the selection', async () => {
    seedResults()
    vi.mocked(downloadMultipleSongs).mockResolvedValue({
      succeeded: 2,
      failed: 0,
      invalidSongsCount: 0,
    } as any)
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('.action-btn')[2].trigger('click')

    await vi.waitFor(() => expect(downloadMultipleSongs).toHaveBeenCalled())
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('reports a partial batch download', async () => {
    seedResults()
    vi.mocked(downloadMultipleSongs).mockResolvedValue({
      succeeded: 1,
      failed: 1,
      invalidSongsCount: 0,
    } as any)
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('.action-btn')[2].trigger('click')

    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
  })

  it('reports a batch download error', async () => {
    seedResults()
    vi.mocked(downloadMultipleSongs).mockRejectedValue(new Error('nope'))
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('.action-btn')[2].trigger('click')

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('warns when nothing downloadable is selected', async () => {
    const { songs } = seedResults([makeOnlineSong({ download_url: '' })])
    const wrapper = mountPage()
    await nextTick()

    wrapper
      .findAllComponents(OnlineSongItemSelectable)[0]
      .vm.$emit('long-press', songs[0].identifier)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[2].trigger('click')

    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(downloadMultipleSongs).not.toHaveBeenCalled()
  })

  it('adds the selection to the queue', async () => {
    const { store } = seedResults()
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('.action-btn')[3].trigger('click')

    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(2))
    expect(toast.success).toHaveBeenCalled()
  })

  it('adds the selection to a playlist', async () => {
    const { store } = seedResults()
    vi.mocked(showPlaylistSelector).mockResolvedValue({ id: 0, name: 'Liked', data: [] } as any)
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('.action-btn')[4].trigger('click')

    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(2))
  })

  it('clears the selection and cancels', async () => {
    seedResults()
    const wrapper = mountPage()
    await nextTick()

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[1].trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))

    wrapper.findAllComponents(OnlineSongItemSelectable)[0].vm.$emit('long-press', 'online-1')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    await wrapper.findAll('.action-btn')[5].trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('cancels an in-flight search when the keyword changes', async () => {
    const store = useAppStore()
    store.isLoading = true
    const reset = vi.spyOn(store, 'resetSearch')
    const wrapper = mountPage()
    await nextTick()

    await wrapper.findComponent(SearchBox).vm.$emit('update:modelValue', 'new term')
    await vi.waitFor(() => expect(reset).toHaveBeenCalled())
  })

  it('expands the player from the now playing bar', async () => {
    const { store } = seedResults()
    store.setPlayQueue([
      {
        id: 'x',
        displayName: 'x',
        uri: '/x.mp3',
        size: 1,
        mimeType: 'audio/mpeg',
        dateAdded: 0,
        dateModified: 0,
        mediaType: 'audio',
        duration: 1000,
        title: 'x',
        artist: 'a',
        album: '',
        track: 1,
        year: 2024,
        albumArtUri: '',
      },
    ])
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(NowPlayingBar).vm.$emit('expand')
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/player-view'))
  })
})
