import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ScanBlacklistPage from '@/views/ScanBlacklistPage.vue'
import SortSongsPage from '@/views/SortSongsPage.vue'
import PlayList from '@/components/PlayList.vue'
import SearchBox from '@/components/SearchBox.vue'
import { useAppStore } from '@/stores/app'
import { makePlaylist, makeSongs } from '../helpers/factories'
import { resetPlugins } from '../helpers/capacitor'
import { mountComponent } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/router', () => ({
  default: { back: vi.fn(), push: vi.fn(async () => {}) },
}))

import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import router from '@/router'

const mounted: any[] = []

beforeEach(() => {
  // jsdom does not implement pointer capture.
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  // jsdom ships no PointerEvent; a MouseEvent with the extra fields is enough.
  if (typeof (globalThis as any).PointerEvent === 'undefined') {
    ;(globalThis as any).PointerEvent = class PointerEvent extends MouseEvent {
      pointerId: number
      pointerType: string
      constructor(type: string, init: any = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
        this.pointerType = init.pointerType ?? 'mouse'
      }
    }
  }
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
})

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted.length = 0
  vi.restoreAllMocks()
})

function mountPage(component: any) {
  const wrapper = mountComponent(component)
  mounted.push(wrapper)
  return wrapper
}

describe('ScanBlacklistPage', () => {
  it('shows the empty state', async () => {
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('lists blacklisted songs', async () => {
    const store = useAppStore()
    store.setBlacklist(makeSongs(2))
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()
    expect(wrapper.findAll('.song-item')).toHaveLength(2)
  })

  it('goes back', async () => {
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()
    await wrapper.find('.nav-back').trigger('click')
    expect(router.back).toHaveBeenCalled()
  })

  it('enters and exits search mode', async () => {
    const store = useAppStore()
    store.setBlacklist(makeSongs(3))
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    await wrapper.find('.nav-action').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.search-mode').exists()).toBe(true))

    await wrapper.findComponent(SearchBox).vm.$emit('update:modelValue', 'song 2')
    await wrapper.findComponent(SearchBox).vm.$emit('search')
    await nextTick()
    expect(wrapper.findAll('.song-item')).toHaveLength(1)

    await wrapper.find('.search-mode .nav-action').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.search-mode').exists()).toBe(false))
    expect(wrapper.findAll('.song-item')).toHaveLength(3)
  })

  it('restores the full list for an empty keyword', async () => {
    const store = useAppStore()
    store.setBlacklist(makeSongs(2))
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    await wrapper.find('.nav-action').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.search-mode').exists()).toBe(true))
    await wrapper.findComponent(SearchBox).vm.$emit('update:modelValue', '   ')
    await wrapper.findComponent(SearchBox).vm.$emit('search')
    await nextTick()
    expect(wrapper.findAll('.song-item')).toHaveLength(2)
  })

  it('shows a no-match state', async () => {
    const store = useAppStore()
    store.setBlacklist(makeSongs(2))
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    await wrapper.find('.nav-action').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.search-mode').exists()).toBe(true))
    await wrapper.findComponent(SearchBox).vm.$emit('update:modelValue', 'zzz')
    await wrapper.findComponent(SearchBox).vm.$emit('search')
    await nextTick()
    expect(wrapper.findAll('.song-item')).toHaveLength(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('removes selected songs after confirmation', async () => {
    const store = useAppStore()
    const songs = makeSongs(3)
    store.setBlacklist(songs)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    wrapper.findComponent(PlayList).vm.$emit('batch-delete', [songs[0].id])
    await vi.waitFor(() => expect(store.getBlacklist()).toHaveLength(2))
    expect(toast.success).toHaveBeenCalled()
  })

  it('keeps songs when removal is cancelled', async () => {
    const store = useAppStore()
    const songs = makeSongs(2)
    store.setBlacklist(songs)
    vi.mocked(showConfirm).mockResolvedValue(false)
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    wrapper.findComponent(PlayList).vm.$emit('batch-delete', [songs[0].id])
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled())
    expect(store.getBlacklist()).toHaveLength(2)
  })

  it('clears the whole blacklist', async () => {
    const store = useAppStore()
    store.setBlacklist(makeSongs(2))
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'delete_all',
    })
    await vi.waitFor(() => expect(store.getBlacklist()).toHaveLength(0))
    expect(toast.success).toHaveBeenCalled()
  })

  it('warns when clearing an empty blacklist', async () => {
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountPage(ScanBlacklistPage)
    await nextTick()

    wrapper.findAllComponents({ name: 'DropdownButton' })[0].vm.$emit('select', {
      value: 'delete_all',
    })
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
  })
})

describe('SortSongsPage', () => {
  function seedLikeList(count = 3) {
    const store = useAppStore()
    const songs = makeSongs(count)
    store.setLikeListData(songs)
    store.setToBeSortedSongListIndex(0)
    return { store, songs }
  }

  function seedPlaylist(count = 3) {
    const store = useAppStore()
    const songs = makeSongs(count, 'trip')
    // Store ids are 1-based positions, so id 7 needs six placeholder lists.
    const lists = Array.from({ length: 6 }, (_, i) => makePlaylist({ id: i + 1 }))
    lists.push(makePlaylist({ id: 7, name: 'Trip', data: songs, songCount: count }))
    store.setSongLists(lists)
    store.setToBeSortedSongListIndex(7)
    return { store, songs }
  }

  it('renders the songs in their stored order', async () => {
    seedLikeList(3)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    const names = wrapper.findAll('.song-name').map((el) => el.text())
    expect(names).toEqual(['song 1', 'song 2', 'song 3'])
    expect(wrapper.find('.song-count').text()).toContain('3')
  })

  it('warns when no list was selected', async () => {
    const store = useAppStore()
    store.setToBeSortedSongListIndex(-1)
    mountPage(SortSongsPage)
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('warns when the playlist no longer exists', async () => {
    const store = useAppStore()
    store.setSongLists([])
    store.setToBeSortedSongListIndex(99)
    mountPage(SortSongsPage)
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('sorts by title descending', async () => {
    seedLikeList(3)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.mode-select').setValue('title')
    await nextTick()
    expect(wrapper.findAll('.song-name').map((el) => el.text())).toEqual([
      'song 1',
      'song 2',
      'song 3',
    ])

    await wrapper.find('.sort-btn').trigger('click')
    await nextTick()
    expect(wrapper.findAll('.song-name').map((el) => el.text())).toEqual([
      'song 3',
      'song 2',
      'song 1',
    ])
  })

  it('sorts by artist and added time', async () => {
    const store = useAppStore()
    const songs = makeSongs(3).map((song, i) => ({
      ...song,
      artist: ['Zed', 'Alice', 'Mike'][i],
      dateAdded: [300, 100, 200][i],
    }))
    store.setLikeListData(songs)
    store.setToBeSortedSongListIndex(0)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.mode-select').setValue('artist')
    await nextTick()
    expect(wrapper.findAll('.song-name').map((el) => el.text())).toEqual([
      'song 2',
      'song 3',
      'song 1',
    ])

    await wrapper.find('.mode-select').setValue('addedTime')
    await nextTick()
    expect(wrapper.findAll('.song-name').map((el) => el.text())).toEqual([
      'song 2',
      'song 3',
      'song 1',
    ])
  })

  it('reverses the custom order', async () => {
    seedLikeList(3)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.sort-btn').trigger('click')
    await nextTick()
    expect(wrapper.findAll('.song-name').map((el) => el.text())).toEqual([
      'song 3',
      'song 2',
      'song 1',
    ])
  })

  it('saves the liked list order and goes back', async () => {
    const { store } = seedLikeList(3)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.sort-btn').trigger('click')
    await nextTick()
    await wrapper.find('.save-btn').trigger('click')

    await vi.waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(store.getLikeList().data.map((s) => s.title)).toEqual(['song 3', 'song 2', 'song 1'])
    expect(toast.success).toHaveBeenCalled()
  })

  it('saves a named playlist order and updates the count', async () => {
    const { store } = seedPlaylist(3)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.sort-btn').trigger('click')
    await nextTick()
    await wrapper.find('.save-btn').trigger('click')

    await vi.waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(store.getSongLists()[6].data.map((s) => s.title)).toEqual(['trip 3', 'trip 2', 'trip 1'])
    expect(store.getSongLists()[6].songCount).toBe(3)
  })

  it('asks before leaving with unsaved changes', async () => {
    seedLikeList(2)
    vi.mocked(showConfirm).mockResolvedValue(false)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.sort-btn').trigger('click')
    await nextTick()
    await wrapper.find('.back-btn').trigger('click')

    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled())
    expect(router.back).not.toHaveBeenCalled()
  })

  it('leaves when the unsaved-changes prompt is confirmed', async () => {
    seedLikeList(2)
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.sort-btn').trigger('click')
    await nextTick()
    await wrapper.find('.back-btn').trigger('click')

    await vi.waitFor(() => expect(router.back).toHaveBeenCalled())
  })

  it('leaves without prompting when nothing changed', async () => {
    seedLikeList(2)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    await wrapper.find('.back-btn').trigger('click')
    await vi.waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(showConfirm).not.toHaveBeenCalled()
  })

  it('shows the drag handles only in custom mode', async () => {
    seedLikeList(2)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()
    expect(wrapper.findAll('.drag-handle')).toHaveLength(2)

    await wrapper.find('.mode-select').setValue('title')
    await nextTick()
    expect(wrapper.findAll('.drag-handle')).toHaveLength(0)
  })

  it('reorders songs by dragging', async () => {
    seedLikeList(3)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()

    const rows = wrapper.findAll('.song-row')
    const source = rows[0].find('.drag-handle')
    // Dispatch by hand: VTU's trigger() tries to assign `button` onto the event,
    // which jsdom's MouseEvent only exposes as a getter.
    source.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        bubbles: true,
        cancelable: true,
      })
    )
    await nextTick()

    const target = wrapper.findAll('.song-row')[2]
    ;(document as any).elementsFromPoint = vi.fn(() => [target.element])
    document.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true })
    )
    await nextTick()

    expect(wrapper.findAll('.song-name').map((el) => el.text())).toEqual([
      'song 2',
      'song 3',
      'song 1',
    ])

    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }))
    delete (document as any).elementsFromPoint
  })

  it('shows an empty hint for an empty list', async () => {
    seedLikeList(0)
    const wrapper = mountPage(SortSongsPage)
    await nextTick()
    expect(wrapper.find('.empty-hint').exists()).toBe(true)
  })
})
