import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SongListPage from '@/views/SongListPage.vue'
import { useAppStore } from '@/stores/app'
import { makePlaylist, makeSongs } from '../helpers/factories'
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
vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/utils/createPrompt', () => ({ showPrompt: vi.fn() }))
vi.mock('@/utils/createPlaylistCoverPicker', () => ({ showPlaylistCoverPicker: vi.fn() }))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(async () => {}), back: vi.fn() }),
  }
})
vi.mock('@/router', () => ({
  default: { back: vi.fn(), push: vi.fn(async () => {}) },
}))

import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import { showPrompt } from '@/utils/createPrompt'
import { showPlaylistCoverPicker } from '@/utils/createPlaylistCoverPicker'
import router from '@/router'
import SearchBox from '@/components/SearchBox.vue'

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function seedLikeList(count = 3) {
  const store = useAppStore()
  const songs = makeSongs(count)
  store.setLikeListData(songs)
  store.setCurrentPlayListIndex(0)
  return { store, songs }
}

function seedPlaylist(name = 'Road Trip', count = 2) {
  const store = useAppStore()
  const songs = makeSongs(count, 'trip')
  store.setSongLists([makePlaylist({ id: 1, name, data: songs, songCount: count })])
  store.setCurrentPlayListIndex(1)
  return { store, songs }
}

describe('SongListPage', () => {
  it('renders the liked list', async () => {
    const { songs } = seedLikeList()
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    expect(wrapper.find('.title').text()).toBeTruthy()
    expect(wrapper.findAll('.song-item')).toHaveLength(3)
    expect(wrapper.text()).toContain(songs[0].title)
  })

  it('renders a named playlist', async () => {
    seedPlaylist('Road Trip', 2)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    expect(wrapper.find('.title').text()).toBe('Road Trip')
    expect(wrapper.findAll('.song-item')).toHaveLength(2)
  })

  it('shows an empty state', async () => {
    seedLikeList(0)
    const wrapper = mountComponent(SongListPage)
    await nextTick()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('goes back', async () => {
    seedLikeList()
    const wrapper = mountComponent(SongListPage)
    await nextTick()
    await wrapper.find('.nav-back').trigger('click')
    expect(router.back).toHaveBeenCalled()
  })

  it('plays a song and sets the queue', async () => {
    const { store, songs } = seedLikeList()
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    await wrapper.findAll('.song-item')[1].trigger('click')
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(3))
    expect(store.getPlayQueue()[1].id).toBe(songs[1].id)
  })

  it('toggles playback when tapping the current song', async () => {
    const { store, songs } = seedLikeList()
    store.setPlayQueue(songs)
    store.playData.currentIndex = 0
    const toggle = vi.spyOn(store, 'togglePlay').mockResolvedValue()
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    await wrapper.findAll('.song-item')[0].trigger('click')
    expect(toggle).toHaveBeenCalled()
  })

  it('enters and exits search mode', async () => {
    seedLikeList(3)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    await wrapper.find('.nav-action').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.search-mode').exists()).toBe(true))

    const search = wrapper.findComponent(SearchBox)
    await search.vm.$emit('update:modelValue', 'song 2')
    await search.vm.$emit('search')
    await nextTick()
    expect(wrapper.findAll('.song-item')).toHaveLength(1)
    expect(wrapper.find('.song-item').text()).toContain('song 2')
  })

  it('shows a no-match state', async () => {
    seedLikeList(3)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    await wrapper.find('.nav-action').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.search-mode').exists()).toBe(true))
    const search = wrapper.findComponent(SearchBox)
    await search.vm.$emit('update:modelValue', 'zzz')
    await search.vm.$emit('search')
    await nextTick()

    expect(wrapper.findAll('.song-item')).toHaveLength(0)
    expect(wrapper.text()).toContain('')
  })

  it('deletes selected songs after confirmation', async () => {
    const { store, songs } = seedLikeList(3)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    const playlist = wrapper.findComponent({ name: 'PlayList' })
    playlist.vm.$emit('batch-delete', [songs[0].id])
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(2))
    expect(toast.success).toHaveBeenCalled()
  })

  it('keeps songs when deletion is cancelled', async () => {
    const { store, songs } = seedLikeList(3)
    vi.mocked(showConfirm).mockResolvedValue(false)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findComponent({ name: 'PlayList' }).vm.$emit('batch-delete', [songs[0].id])
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled())
    expect(store.getLikeList().data).toHaveLength(3)
  })

  it('removes a single song from the playlist', async () => {
    const { store, songs } = seedLikeList(3)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findComponent({ name: 'PlayList' }).vm.$emit('delete-song', songs[1])
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(2))
    expect(store.getLikeList().data.map((s) => s.id)).not.toContain(songs[1].id)
  })

  it('renames a playlist from the menu', async () => {
    const { store } = seedPlaylist('Old', 2)
    vi.mocked(showPrompt).mockResolvedValue('New')
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'edit_name',
    })
    await vi.waitFor(() => expect(store.getSongLists()[0].name).toBe('New'))
    expect(wrapper.find('.title').text()).toBe('New')
  })

  it('refuses to rename the liked list', async () => {
    seedLikeList()
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'edit_name',
    })
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(showPrompt).not.toHaveBeenCalled()
  })

  it('updates the playlist cover', async () => {
    const { store } = seedPlaylist('A', 1)
    vi.mocked(showPlaylistCoverPicker).mockResolvedValue('https://cdn.example.com/new.jpg')
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'cover',
    })
    await vi.waitFor(() =>
      expect(store.getSongLists()[0].coverUrl).toBe('https://cdn.example.com/new.jpg')
    )
  })

  it('refuses to change the liked list cover', async () => {
    seedLikeList()
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'cover',
    })
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(showPlaylistCoverPicker).not.toHaveBeenCalled()
  })

  it('deletes all songs after confirmation', async () => {
    const { store } = seedLikeList(3)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'delete_all',
    })
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(0))
  })

  it('warns when deleting all songs from an empty list', async () => {
    seedLikeList(0)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'delete_all',
    })
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
  })

  it('opens the sort page', async () => {
    const { store } = seedPlaylist('A', 2)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'sort',
    })
    await vi.waitFor(() => expect(store.getToBeSortedSongListIndex()).toBe(1))
    expect(router.push).toHaveBeenCalledWith('/sort-song')
  })

  it('plays the whole list from the top', async () => {
    const { store, songs } = seedLikeList(3)
    const wrapper = mountComponent(SongListPage)
    await nextTick()

    await wrapper.find('.play-all').trigger('click')
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(3))
    expect(store.getPlayData().currentIndex).toBe(0)
    expect(store.getPlayQueue()[0].id).toBe(songs[0].id)
  })
})
