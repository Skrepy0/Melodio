import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import HomePage from '@/views/HomePage.vue'
import { useAppStore } from '@/stores/app'
import { makePlaylist, makeSongs } from '../helpers/factories'
import { resetPlugins } from '../helpers/capacitor'
import { mountComponent } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return {
    ...actual,
    fetchCoverFromWeb: vi.fn(async () => null),
    checkPlayableUrl: vi.fn(async () => true),
  }
})

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/utils/createPrompt', () => ({ showPrompt: vi.fn() }))
vi.mock('@/utils/audioScanner', () => ({ scanAllAudio: vi.fn() }))

const push = vi.fn(async () => {})
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push, back: vi.fn() }) }
})

import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import { showPrompt } from '@/utils/createPrompt'
import { scanAllAudio } from '@/utils/audioScanner'
import { checkPlayableUrl } from '@/utils/functions'
import SearchBox from '@/components/SearchBox.vue'
import PlayList from '@/components/PlayList.vue'
import PlaylistsList from '@/components/PlaylistsList.vue'

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
  vi.mocked(checkPlayableUrl).mockResolvedValue(true)
  vi.mocked(scanAllAudio).mockResolvedValue({ success: true, songs: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mountHome() {
  const store = useAppStore()
  await store.init()
  const wrapper = mountComponent(HomePage)
  await nextTick()
  return { store, wrapper }
}

describe('HomePage', () => {
  it('renders the library and song list', async () => {
    const { store, wrapper } = await mountHome()
    const songs = makeSongs(3)
    store.setAllSongs(songs)
    // Re-mount so the page picks up the seeded library.
    const fresh = mountComponent(HomePage)
    await nextTick()

    expect(fresh.find('h1.title').text()).toBeTruthy()
    expect(fresh.findAll('.song-item')).toHaveLength(3)
    expect(wrapper.exists()).toBe(true)
  })

  it('shows the empty state for an empty library', async () => {
    const { wrapper } = await mountHome()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('switches to the playlists category', async () => {
    const { store, wrapper } = await mountHome()
    store.setSongLists([makePlaylist({ id: 1, name: 'Road Trip', data: makeSongs(2) })])
    await nextTick()

    const tabs = wrapper.findComponent({ name: 'HorizontalSelect' })
    tabs.vm.$emit('update:modelValue', 'play-lists')
    await nextTick()

    expect(wrapper.findComponent(PlaylistsList).exists()).toBe(true)
  })

  it('filters the song list as the user types', async () => {
    const { store } = await mountHome()
    store.setAllSongs(makeSongs(3))
    const fresh = mountComponent(HomePage)
    await nextTick()

    const search = fresh.findComponent(SearchBox)
    await search.vm.$emit('update:modelValue', 'song 2')
    await search.vm.$emit('search')
    await nextTick()

    expect(fresh.findAll('.song-item')).toHaveLength(1)
  })

  it('filters playlists by description', async () => {
    const { store } = await mountHome()
    store.setSongLists([
      makePlaylist({ id: 1, name: 'A', description: 'highway' }),
      makePlaylist({ id: 2, name: 'B', description: 'calm' }),
    ])
    const fresh = mountComponent(HomePage)
    await nextTick()
    fresh.findComponent({ name: 'HorizontalSelect' }).vm.$emit('update:modelValue', 'play-lists')
    await nextTick()

    const search = fresh.findComponent(SearchBox)
    await search.vm.$emit('update:modelValue', 'highway')
    await search.vm.$emit('search')
    await nextTick()

    const playlists = fresh.findComponent(PlaylistsList).props('playlists') as any[]
    expect(playlists.map((p) => p.name)).toContain('A')
    expect(playlists.map((p) => p.name)).not.toContain('B')
  })

  it('opens a playlist', async () => {
    const { store } = await mountHome()
    store.setSongLists([makePlaylist({ id: 3, name: 'Road Trip' })])
    const fresh = mountComponent(HomePage)
    await nextTick()
    fresh.findComponent({ name: 'HorizontalSelect' }).vm.$emit('update:modelValue', 'play-lists')
    await nextTick()

    fresh.findComponent(PlaylistsList).vm.$emit('playlist-click', { id: 3 })
    await nextTick()

    expect(store.getCurrentPlayListIndex()).toBe(3)
    expect(push).toHaveBeenCalledWith('/song-list')
  })

  it('creates a playlist from the menu', async () => {
    const { store, wrapper } = await mountHome()
    vi.mocked(showPrompt).mockResolvedValue('My List')

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', {
      value: 'new-songs-list',
    })
    await vi.waitFor(() => expect(store.getSongLists()).toHaveLength(1))
    expect(store.getSongLists()[0].name).toBe('My List')
    expect(store.getSongLists()[0].id).toBe(1)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('assigns the next free playlist id', async () => {
    const { store, wrapper } = await mountHome()
    store.setSongLists([makePlaylist({ id: 4 })])
    vi.mocked(showPrompt).mockResolvedValue('Next')

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', {
      value: 'new-songs-list',
    })
    await vi.waitFor(() => expect(store.getSongLists()).toHaveLength(2))
    expect(store.getSongLists()[1].id).toBe(5)
  })

  it('ignores a cancelled playlist prompt', async () => {
    const { store, wrapper } = await mountHome()
    vi.mocked(showPrompt).mockResolvedValue(null)

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', {
      value: 'new-songs-list',
    })
    await vi.waitFor(() => expect(showPrompt).toHaveBeenCalled())
    expect(store.getSongLists()).toHaveLength(0)
  })

  it('navigates from the menu', async () => {
    const { wrapper } = await mountHome()
    const dropdown = wrapper.findComponent({ name: 'DropdownButton' })

    for (const [value, path] of [
      ['settings', '/settings'],
      ['search', '/search'],
      ['downloads', '/downloads'],
      ['blacklist', '/blacklist'],
    ]) {
      dropdown.vm.$emit('select', { value })
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith(path))
    }
  })

  it('rescans the library', async () => {
    const { store, wrapper } = await mountHome()
    const songs = makeSongs(2)
    vi.mocked(scanAllAudio).mockResolvedValue({ success: true, songs })

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', {
      value: 'scan-songs',
    })
    await vi.waitFor(() => expect(store.getAllSongs()).toHaveLength(2))
    expect(toast.success).toHaveBeenCalled()
  })

  it('reports a failed scan', async () => {
    const { wrapper } = await mountHome()
    vi.mocked(scanAllAudio).mockResolvedValue({ success: false, songs: [], error: 'x' })

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', {
      value: 'scan-songs',
    })
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('excludes blacklisted songs from a scan', async () => {
    const { store, wrapper } = await mountHome()
    const songs = makeSongs(2)
    store.setBlacklist([songs[0]])
    vi.mocked(scanAllAudio).mockResolvedValue({ success: true, songs })

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', {
      value: 'scan-songs',
    })
    await vi.waitFor(() => expect(store.getAllSongs()).toHaveLength(1))
    expect(store.getAllSongs()[0].id).toBe(songs[1].id)
  })

  it('plays a song', async () => {
    const { store } = await mountHome()
    const songs = makeSongs(2)
    store.setAllSongs(songs)
    const fresh = mountComponent(HomePage)
    await nextTick()

    fresh.findComponent(PlayList).vm.$emit('song-click', songs[1])
    await vi.waitFor(() => expect(store.getPlayData().currentIndex).toBe(1))
    expect(store.getPlayQueue()).toHaveLength(2)
  })

  it('plays the visible list', async () => {
    const { store } = await mountHome()
    store.setAllSongs(makeSongs(2))
    const fresh = mountComponent(HomePage)
    await nextTick()

    await fresh.find('.icon-action').trigger('click')
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(2))
    expect(store.getPlayData().currentIndex).toBe(0)
  })

  it('deletes selected songs after confirmation', async () => {
    const { store } = await mountHome()
    const songs = makeSongs(3)
    store.setAllSongs(songs)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const fresh = mountComponent(HomePage)
    await nextTick()

    fresh.findComponent(PlayList).vm.$emit('batch-delete', [songs[0].id])
    await vi.waitFor(() => expect(store.getAllSongs()).toHaveLength(2))
    expect(toast.success).toHaveBeenCalled()
  })

  it('removes a song from the library', async () => {
    const { store } = await mountHome()
    const songs = makeSongs(2)
    store.setAllSongs(songs)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const fresh = mountComponent(HomePage)
    await nextTick()

    fresh.findComponent(PlayList).vm.$emit('delete-song', songs[0])
    await vi.waitFor(() => expect(store.getAllSongs()).toHaveLength(1))
  })

  it('bans selected songs', async () => {
    const { store } = await mountHome()
    const songs = makeSongs(3)
    store.setAllSongs(songs)
    const fresh = mountComponent(HomePage)
    await nextTick()

    fresh.findComponent(PlayList).vm.$emit('add-to-blacklist', [songs[0].id])
    await vi.waitFor(() => expect(store.getBlacklist()).toHaveLength(1))
    expect(store.getAllSongs()).toHaveLength(2)
  })

  it('deletes playlists after confirmation', async () => {
    const { store } = await mountHome()
    store.setSongLists([makePlaylist({ id: 1 }), makePlaylist({ id: 2 })])
    vi.mocked(showConfirm).mockResolvedValue(true)
    const fresh = mountComponent(HomePage)
    await nextTick()
    fresh.findComponent({ name: 'HorizontalSelect' }).vm.$emit('update:modelValue', 'play-lists')
    await nextTick()

    fresh.findComponent(PlaylistsList).vm.$emit('batch-delete', [1])
    await vi.waitFor(() => expect(store.getSongLists()).toHaveLength(1))
  })

  it('refuses to delete the liked list', async () => {
    await mountHome()
    const fresh = mountComponent(HomePage)
    await nextTick()
    fresh.findComponent({ name: 'HorizontalSelect' }).vm.$emit('update:modelValue', 'play-lists')
    await nextTick()

    fresh.findComponent(PlaylistsList).vm.$emit('batch-delete', [0])
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(showConfirm).not.toHaveBeenCalled()
  })

  it('removes invalid songs on mount', async () => {
    const { store } = await mountHome()
    const songs = makeSongs(3)
    store.setAllSongs(songs)
    store.setLikeListData(songs)
    store.setSongLists([makePlaylist({ id: 1, data: songs, songCount: 3 })])
    store.setPlayQueue(songs)
    vi.mocked(checkPlayableUrl).mockImplementation(async (url: string) => !url.includes('song2'))

    mountComponent(HomePage)
    await vi.waitFor(() => expect(store.getAllSongs()).toHaveLength(2))
    expect(store.getLikeList().data).toHaveLength(2)
    expect(store.getSongLists()[0].data).toHaveLength(2)
    expect(store.getPlayQueue()).toHaveLength(2)
    expect(toast.warning).toHaveBeenCalled()
  })

  it('skips validation when the setting is off', async () => {
    const { store } = await mountHome()
    store.setAllSongs(makeSongs(2))
    store.setAutoDelInvalidSongs(false)
    vi.mocked(checkPlayableUrl).mockClear()

    mountComponent(HomePage)
    await nextTick()
    await nextTick()

    expect(checkPlayableUrl).not.toHaveBeenCalled()
  })
})
