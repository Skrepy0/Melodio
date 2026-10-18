import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PlayList from '@/components/PlayList.vue'
import PlaylistsList from '@/components/PlaylistsList.vue'
import SongItemSelectable from '@/components/song/SongItemSelectable.vue'
import PlaylistItemSelectable from '@/components/lists/PlaylistItemSelectable.vue'
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
vi.mock('@/utils/createPlaylistSelector', () => ({ showPlaylistSelector: vi.fn() }))
vi.mock('@/utils/createPrompt', () => ({ showPrompt: vi.fn() }))
vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/utils/createPlaylistCoverPicker', () => ({ showPlaylistCoverPicker: vi.fn() }))
vi.mock('@/utils/createInfo', () => ({ showSongInfo: vi.fn() }))

import toast from '@/utils/createToast'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mountList(songs = makeSongs(3), props: Record<string, any> = {}) {
  const wrapper = mountComponent(PlayList, { props: { songs, ...props } })
  return { wrapper, songs }
}

async function enterSelectMode(wrapper: any, songId: string) {
  wrapper.findComponent(SongItemSelectable).vm.$emit('long-press', songId)
  await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
}

function actionButtons(wrapper: any): any[] {
  return wrapper.findAll('.action-btn')
}

describe('PlayList', () => {
  it('renders every song', () => {
    const { wrapper } = mountList()
    expect(wrapper.findAll('.song-item')).toHaveLength(3)
  })

  it('emits song-click when not selecting', async () => {
    const { wrapper, songs } = mountList()
    wrapper.findAllComponents(SongItemSelectable)[1].vm.$emit('click', songs[1])
    await nextTick()
    expect(wrapper.emitted('song-click')?.[0]).toEqual([songs[1]])
  })

  it('enters selection mode on long press', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[1].id)

    const items = wrapper.findAllComponents(SongItemSelectable)
    expect(items[1].props('selectable')).toBe(true)
    expect(items[1].props('selected')).toBe(true)
    expect(items[0].props('selected')).toBe(false)
  })

  it('toggles selection and leaves the mode when empty', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)

    const item = wrapper.findAllComponents(SongItemSelectable)[0]
    item.vm.$emit('toggle-select', songs[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('selects all songs', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)

    await actionButtons(wrapper)[0].trigger('click')
    await nextTick()

    const items = wrapper.findAllComponents(SongItemSelectable)
    expect(items.every((i: any) => i.props('selected'))).toBe(true)
  })

  it('clears the selection', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)

    await actionButtons(wrapper)[1].trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('adds selected songs to the queue', async () => {
    const store = useAppStore()
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[0].trigger('click') // select all
    await nextTick()
    await actionButtons(wrapper)[2].trigger('click')

    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(3))
    expect(toast.success).toHaveBeenCalled()
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('warns when the selected songs are already queued', async () => {
    const store = useAppStore()
    const { wrapper, songs } = mountList(makeSongs(1))
    store.setPlayQueue([songs[0]])
    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[2].trigger('click')

    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(store.getPlayQueue()).toHaveLength(1)
  })

  it('adds selected songs to a named playlist', async () => {
    const store = useAppStore()
    const list = makePlaylist({ id: 1, name: 'Target', data: [] })
    store.setSongLists([list])
    vi.mocked(showPlaylistSelector).mockResolvedValue({ ...list, data: [] })
    const { wrapper, songs } = mountList(makeSongs(2))

    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[0].trigger('click')
    await nextTick()
    await actionButtons(wrapper)[3].trigger('click')

    await vi.waitFor(() => expect(store.getSongLists()[0].data).toHaveLength(2))
    expect(toast.success).toHaveBeenCalled()
  })

  it('adds selected songs to the liked list', async () => {
    const store = useAppStore()
    vi.mocked(showPlaylistSelector).mockResolvedValue(makePlaylist({ id: 0, name: 'Liked' }))
    const { wrapper, songs } = mountList(makeSongs(2))

    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[0].trigger('click')
    await nextTick()
    await actionButtons(wrapper)[3].trigger('click')

    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(2))
  })

  it('warns when every selected song is already in the liked list', async () => {
    const store = useAppStore()
    const songs = makeSongs(1)
    store.setLikeListData(songs)
    vi.mocked(showPlaylistSelector).mockResolvedValue(makePlaylist({ id: 0, name: 'Liked' }))
    const { wrapper } = mountList(songs)

    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[3].trigger('click')

    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(store.getLikeList().data).toHaveLength(1)
  })

  it('warns when every selected song is already in the playlist', async () => {
    const store = useAppStore()
    const songs = makeSongs(1)
    const list = makePlaylist({ id: 1, name: 'A', data: songs })
    store.setSongLists([list])
    vi.mocked(showPlaylistSelector).mockResolvedValue(list)
    const { wrapper } = mountList(songs)

    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[3].trigger('click')

    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(store.getSongLists()[0].data).toHaveLength(1)
  })

  it('does nothing when the playlist selector is dismissed', async () => {
    const store = useAppStore()
    vi.mocked(showPlaylistSelector).mockResolvedValue(null)
    const { wrapper, songs } = mountList(makeSongs(1))

    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[3].trigger('click')

    await vi.waitFor(() => expect(showPlaylistSelector).toHaveBeenCalled())
    expect(store.getSongLists()).toHaveLength(0)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('emits batch-delete with the selected ids', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[4].trigger('click')

    expect(wrapper.emitted('batch-delete')?.[0]).toEqual([[songs[0].id]])
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('emits add-to-blacklist with the selected ids', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[1].id)
    await actionButtons(wrapper)[5].trigger('click')

    expect(wrapper.emitted('add-to-blacklist')?.[0]).toEqual([[songs[1].id]])
  })

  it('closes selection mode from the cancel button', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)
    await actionButtons(wrapper)[6].trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('forwards delete-song from a row menu', async () => {
    const { wrapper, songs } = mountList()
    wrapper
      .findAllComponents({ name: 'SongItem' })[0]
      .findComponent({ name: 'DropdownButton' })
      .vm.$emit('select', { value: 'delete' })
    await nextTick()
    expect(wrapper.emitted('delete-song')?.[0]).toEqual([songs[0]])
  })

  it('hides actions according to the visibility props', async () => {
    const { wrapper, songs } = mountList(makeSongs(3), {
      visibility: {
        selectAll: false,
        clear: false,
        addToQueue: false,
        addToPlaylist: true,
        delete: false,
        ban: false,
        close: true,
      },
    })
    await enterSelectMode(wrapper, songs[0].id)

    const labels = actionButtons(wrapper).map((b: any) => b.text())
    expect(labels).toHaveLength(2) // addToPlaylist + cancel
  })

  it('ignores song clicks while selecting', async () => {
    const { wrapper, songs } = mountList()
    await enterSelectMode(wrapper, songs[0].id)
    wrapper.findAllComponents(SongItemSelectable)[1].vm.$emit('click', songs[1])
    await nextTick()
    expect(wrapper.emitted('song-click')).toBeUndefined()
  })
})

describe('PlaylistsList', () => {
  function mountPlaylists(playlists = [makePlaylist({ id: 1 }), makePlaylist({ id: 2 })]) {
    const wrapper = mountComponent(PlaylistsList, { props: { playlists } })
    return { wrapper, playlists }
  }

  it('renders every playlist', () => {
    const { wrapper } = mountPlaylists()
    expect(wrapper.findAllComponents(PlaylistItemSelectable)).toHaveLength(2)
  })

  it('emits playlist-click', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper.findAllComponents(PlaylistItemSelectable)[1].vm.$emit('click', playlists[1])
    await nextTick()
    expect(wrapper.emitted('playlist-click')?.[0]).toEqual([playlists[1]])
  })

  it('enters selection mode on long press', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper.findAllComponents(PlaylistItemSelectable)[0].vm.$emit('long-press', playlists[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))

    expect(wrapper.findAllComponents(PlaylistItemSelectable)[0].props('selected')).toBe(true)
  })

  it('selects all playlists and emits batch-delete', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper.findAllComponents(PlaylistItemSelectable)[0].vm.$emit('long-press', playlists[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))

    await wrapper.findAll('.action-btn')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('.action-btn')[2].trigger('click')

    const emitted = wrapper.emitted('batch-delete')?.[0]?.[0] as number[]
    expect(emitted.sort()).toEqual([1, 2])
  })

  it('clears the selection', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper.findAllComponents(PlaylistItemSelectable)[0].vm.$emit('long-press', playlists[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))

    await wrapper.findAll('.action-btn')[1].trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('toggles a playlist off and exits when none remain', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper.findAllComponents(PlaylistItemSelectable)[0].vm.$emit('long-press', playlists[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))

    wrapper.findAllComponents(PlaylistItemSelectable)[0].vm.$emit('toggle-select', playlists[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(false))
  })

  it('forwards menu selections', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper
      .findAllComponents(PlaylistItemSelectable)[0]
      .vm.$emit('menuSelect', 'edit', playlists[0])
    await nextTick()
    expect(wrapper.emitted('menu-select')?.[0]).toEqual(['edit', playlists[0]])
  })

  it('ignores clicks in selection mode', async () => {
    const { wrapper, playlists } = mountPlaylists()
    wrapper.findAllComponents(PlaylistItemSelectable)[0].vm.$emit('long-press', playlists[0].id)
    await vi.waitFor(() => expect(wrapper.find('.bottom-actions').exists()).toBe(true))
    wrapper.findAllComponents(PlaylistItemSelectable)[1].vm.$emit('click', playlists[1])
    await nextTick()
    expect(wrapper.emitted('playlist-click')).toBeUndefined()
  })
})
