import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SongItem from '@/components/song/SongItem.vue'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import PlaylistItem from '@/components/lists/PlaylistItem.vue'
import PlaylistCoverImage from '@/components/lists/PlaylistCoverImage.vue'
import { useAppStore } from '@/stores/app'
import { audio } from '@/utils/createAudio'
import { makePlaylist, makeSong, makeSongs } from '../helpers/factories'
import { emitNative, resetPlugins } from '../helpers/capacitor'
import { mountComponent } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, fetchCoverFromWeb: vi.fn(async () => null) }
})

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('@/utils/createPlaylistSelector', () => ({
  showPlaylistSelector: vi.fn(),
}))

vi.mock('@/utils/createInfo', () => ({ showSongInfo: vi.fn() }))

vi.mock('@/utils/createPrompt', () => ({ showPrompt: vi.fn() }))
vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/utils/createPlaylistCoverPicker', () => ({ showPlaylistCoverPicker: vi.fn() }))

import toast from '@/utils/createToast'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
import { showSongInfo } from '@/utils/createInfo'
import { showPrompt } from '@/utils/createPrompt'
import { showConfirm } from '@/utils/createConfirm'
import { showPlaylistCoverPicker } from '@/utils/createPlaylistCoverPicker'

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SongItem', () => {
  it('renders the title, artist and duration', async () => {
    const wrapper = mountComponent(SongItem, {
      props: { song: makeSong({ title: '夜曲', artist: '周杰伦', duration: 185000 }) },
    })
    await nextTick()

    expect(wrapper.find('.song-name').text()).toBe('夜曲')
    expect(wrapper.find('.song-artist').text()).toBe('周杰伦')
    expect(wrapper.find('.song-duration').text()).toBe('03:05')
  })

  it('emits click with the song', async () => {
    const song = makeSong()
    const wrapper = mountComponent(SongItem, { props: { song } })
    await wrapper.find('.song-item').trigger('click')
    expect(wrapper.emitted('click')?.[0]).toEqual([song])
  })

  it('marks the current song and shows the equalizer', async () => {
    const song = makeSong({ id: 'current' })
    const store = useAppStore()
    store.setPlayQueue([song])
    store.setIsPlaying(true)

    const wrapper = mountComponent(SongItem, { props: { song } })
    await nextTick()

    expect(wrapper.classes()).toContain('current')
    expect(wrapper.find('.equalizer').exists()).toBe(true)
    expect(wrapper.find('.equalizer').classes()).not.toContain('paused')
  })

  it('pauses the equalizer animation when playback stops', async () => {
    const song = makeSong({ id: 'current' })
    const store = useAppStore()
    store.setPlayQueue([song])
    store.setIsPlaying(false)

    const wrapper = mountComponent(SongItem, { props: { song } })
    await nextTick()
    expect(wrapper.find('.equalizer').classes()).toContain('paused')
  })

  it('adds the song to the queue from the menu', async () => {
    const song = makeSong()
    const store = useAppStore()
    const wrapper = mountComponent(SongItem, { props: { song } })
    wrapper.vm.$.exposed // touch to keep the setup object referenced

    // The dropdown emits a select with the queue item.
    const dropdown = wrapper.findComponent({ name: 'DropdownButton' })
    dropdown.vm.$emit('select', { value: 'queue' })
    await nextTick()

    expect(store.getPlayQueue()).toEqual([song])
    expect(toast.success).toHaveBeenCalled()
  })

  it('likes a song and refuses duplicates', async () => {
    const song = makeSong()
    const store = useAppStore()
    const wrapper = mountComponent(SongItem, { props: { song } })
    const dropdown = wrapper.findComponent({ name: 'DropdownButton' })

    dropdown.vm.$emit('select', { value: 'like' })
    await nextTick()
    expect(store.getLikeList().data).toEqual([song])

    dropdown.vm.$emit('select', { value: 'like' })
    await nextTick()
    expect(store.getLikeList().data).toHaveLength(1)
    expect(toast.warning).toHaveBeenCalled()
  })

  it('adds the song to the selected playlist', async () => {
    const song = makeSong()
    const store = useAppStore()
    const list = makePlaylist({ id: 1, name: 'Target', data: [] })
    store.setSongLists([list])
    vi.mocked(showPlaylistSelector).mockResolvedValue({ ...list, data: [] })

    const wrapper = mountComponent(SongItem, { props: { song } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'addToPlaylist' })
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(store.getSongLists()[0].data).toEqual([song])
  })

  it('warns when the song is already in the playlist', async () => {
    const song = makeSong()
    const store = useAppStore()
    const list = makePlaylist({ id: 1, data: [song] })
    store.setSongLists([list])
    vi.mocked(showPlaylistSelector).mockResolvedValue(list)

    const wrapper = mountComponent(SongItem, { props: { song } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'addToPlaylist' })
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(store.getSongLists()[0].data).toHaveLength(1)
  })

  it('inserts the song right after the current one', async () => {
    const [a, b, c] = makeSongs(3)
    const store = useAppStore()
    store.setPlayQueue([a, b])
    store.setMockCurrentTime(0)
    store.playData.currentIndex = 0

    const wrapper = mountComponent(SongItem, { props: { song: c } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'next' })
    await nextTick()

    expect(store.getPlayQueue().map((s) => s.id)).toEqual([a.id, c.id, b.id])
  })

  it('calls the delete handler', async () => {
    const song = makeSong()
    const onDelete = vi.fn()
    const wrapper = mountComponent(SongItem, { props: { song, onDelete } })

    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'delete' })
    await nextTick()

    expect(onDelete).toHaveBeenCalledWith(song)
  })

  it('plays a song by inserting it after the current track', async () => {
    const [a, b] = makeSongs(2)
    const store = useAppStore()
    store.setPlayQueue([a])
    store.setMockCurrentTime(0)
    store.playData.currentIndex = 0

    const wrapper = mountComponent(SongItem, { props: { song: b } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'play' })
    await vi.waitFor(() => expect(store.getIsSwitchingSong()).toBe(false))

    expect(store.getPlayQueue().map((s) => s.id)).toEqual([a.id, b.id])
    expect(store.getPlayData().currentIndex).toBe(1)
  })

  it('opens the song details dialog', async () => {
    const song = makeSong()
    const wrapper = mountComponent(SongItem, { props: { song } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'detail' })
    await nextTick()
    expect(showSongInfo).toHaveBeenCalledWith(song)
  })

  it('uses custom operations and a custom select handler', async () => {
    const onMenuItemSelect = vi.fn()
    const operations = [{ value: 'custom', icon: 'x', description: 'Custom' }]
    const wrapper = mountComponent(SongItem, {
      props: { song: makeSong(), operations, onMenuItemSelect },
    })
    const dropdown = wrapper.findComponent({ name: 'DropdownButton' })
    expect(dropdown.props('options')).toEqual(operations)

    dropdown.vm.$emit('select', operations[0])
    await nextTick()
    expect(onMenuItemSelect).toHaveBeenCalledWith(operations[0])
  })
})

describe('NowPlayingBar', () => {
  it('renders nothing without a current song', () => {
    const wrapper = mountComponent(NowPlayingBar)
    expect(wrapper.find('.now-playing-bar').exists()).toBe(false)
  })

  it('shows the current track and progress', async () => {
    const store = useAppStore()
    const song = makeSong({ title: 'Playing', artist: 'Someone', duration: 120000 })
    store.setPlayQueue([song])
    store.setIsPlaying(true)
    store.setMockCurrentTime(30)

    const wrapper = mountComponent(NowPlayingBar)
    await nextTick()

    expect(wrapper.text()).toContain('Playing')
    expect(wrapper.text()).toContain('Someone')
    expect(wrapper.find('.progress-fill-line').attributes('style')).toContain('25%')
  })

  it('toggles playback from the button', async () => {
    const store = useAppStore()
    const song = makeSong()
    store.setPlayQueue([song])
    store.setIsPlaying(false)
    const toggle = vi.spyOn(store, 'togglePlay').mockResolvedValue()

    const wrapper = mountComponent(NowPlayingBar)
    await nextTick()
    await wrapper.find('.play-pause-btn').trigger('click')

    expect(toggle).toHaveBeenCalled()
  })

  it('emits expand when the track info is tapped', async () => {
    const store = useAppStore()
    store.setPlayQueue([makeSong()])
    const wrapper = mountComponent(NowPlayingBar)
    await nextTick()

    await wrapper.find('.song-info').trigger('click')
    expect(wrapper.emitted('expand')).toHaveLength(1)
  })

  it('updates the progress from native time updates', async () => {
    const store = useAppStore()
    store.setPlayQueue([makeSong({ duration: 100000 })])
    const wrapper = mountComponent(NowPlayingBar)
    await nextTick()

    emitNative('NativeAudio', 'timeupdate', { position: 50 })
    await nextTick()

    expect(wrapper.find('.progress-fill-line').attributes('style')).toContain('50%')
  })
})

describe('PlaylistItem', () => {
  it('shows the name and song count', async () => {
    const wrapper = mountComponent(PlaylistItem, {
      props: { playlist: makePlaylist({ name: 'Road Trip', songCount: 7 }) },
    })
    await nextTick()
    expect(wrapper.text()).toContain('Road Trip')
    expect(wrapper.text()).toContain('7')
  })

  it('renders a heart for the liked list', async () => {
    const wrapper = mountComponent(PlaylistItem, {
      props: { playlist: makePlaylist({ id: 0, name: 'Liked' }) },
    })
    await nextTick()
    expect(wrapper.find('.liked-icon').exists()).toBe(true)
  })

  it('emits click', async () => {
    const playlist = makePlaylist()
    const wrapper = mountComponent(PlaylistItem, { props: { playlist } })
    await wrapper.find('.playlist-item').trigger('click')
    expect(wrapper.emitted('click')?.[0]).toEqual([playlist])
  })

  it('refuses to edit or delete the liked list', async () => {
    const wrapper = mountComponent(PlaylistItem, {
      props: { playlist: makePlaylist({ id: 0, name: 'Liked' }) },
    })
    const dropdown = wrapper.findComponent({ name: 'DropdownButton' })

    dropdown.vm.$emit('select', { value: 'edit' })
    await nextTick()
    dropdown.vm.$emit('select', { value: 'delete' })
    await nextTick()
    dropdown.vm.$emit('select', { value: 'cover' })
    await nextTick()

    expect(showPrompt).not.toHaveBeenCalled()
    expect(showConfirm).not.toHaveBeenCalled()
    expect(showPlaylistCoverPicker).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledTimes(3)
  })

  it('renames a playlist', async () => {
    const store = useAppStore()
    const playlist = makePlaylist({ id: 1, name: 'Old' })
    store.setSongLists([playlist])
    vi.mocked(showPrompt).mockResolvedValue('New')

    const wrapper = mountComponent(PlaylistItem, { props: { playlist } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'edit' })
    await vi.waitFor(() => expect(store.getSongLists()[0].name).toBe('New'))
    expect(toast.success).toHaveBeenCalled()
  })

  it('warns when the new name is unchanged', async () => {
    const store = useAppStore()
    const playlist = makePlaylist({ id: 1, name: 'Same' })
    store.setSongLists([playlist])
    vi.mocked(showPrompt).mockResolvedValue('Same')

    const wrapper = mountComponent(PlaylistItem, { props: { playlist } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'edit' })
    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(store.getSongLists()[0].name).toBe('Same')
  })

  it('deletes a playlist after confirmation', async () => {
    const store = useAppStore()
    store.setSongLists([makePlaylist({ id: 1, name: 'A' }), makePlaylist({ id: 2, name: 'B' })])
    vi.mocked(showConfirm).mockResolvedValue(true)

    const wrapper = mountComponent(PlaylistItem, {
      props: { playlist: store.getSongLists()[0] },
    })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'delete' })
    await vi.waitFor(() => expect(store.getSongLists()).toHaveLength(1))
    expect(store.getSongLists()[0].name).toBe('B')
  })

  it('keeps the playlist when deletion is cancelled', async () => {
    const store = useAppStore()
    store.setSongLists([makePlaylist({ id: 1 })])
    vi.mocked(showConfirm).mockResolvedValue(false)

    const wrapper = mountComponent(PlaylistItem, { props: { playlist: store.getSongLists()[0] } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'delete' })
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled())
    expect(store.getSongLists()).toHaveLength(1)
  })

  it('updates the cover from the picker', async () => {
    const store = useAppStore()
    store.setSongLists([makePlaylist({ id: 1, name: 'A', coverUrl: '' })])
    vi.mocked(showPlaylistCoverPicker).mockResolvedValue('data:image/png;base64,AAA')

    const wrapper = mountComponent(PlaylistItem, { props: { playlist: store.getSongLists()[0] } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'cover' })
    await vi.waitFor(() =>
      expect(store.getSongLists()[0].coverUrl).toBe('data:image/png;base64,AAA')
    )
  })

  it('resets the cover when the picker resolves null', async () => {
    const store = useAppStore()
    store.setSongLists([makePlaylist({ id: 1, coverUrl: 'https://x/a.jpg' })])
    vi.mocked(showPlaylistCoverPicker).mockResolvedValue(null)

    const wrapper = mountComponent(PlaylistItem, { props: { playlist: store.getSongLists()[0] } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'cover' })
    await vi.waitFor(() => expect(store.getSongLists()[0].coverUrl).toBe(''))
  })

  it('ignores a dismissed cover picker', async () => {
    const store = useAppStore()
    store.setSongLists([makePlaylist({ id: 1, coverUrl: 'https://x/a.jpg' })])
    vi.mocked(showPlaylistCoverPicker).mockResolvedValue(undefined)

    const wrapper = mountComponent(PlaylistItem, { props: { playlist: store.getSongLists()[0] } })
    wrapper.findComponent({ name: 'DropdownButton' }).vm.$emit('select', { value: 'cover' })
    await vi.waitFor(() => expect(showPlaylistCoverPicker).toHaveBeenCalled())
    expect(store.getSongLists()[0].coverUrl).toBe('https://x/a.jpg')
  })
})

describe('PlaylistCoverImage', () => {
  it('shows the custom cover image', async () => {
    const wrapper = mountComponent(PlaylistCoverImage, {
      props: {
        playlist: makePlaylist({ id: 1, name: 'A', coverUrl: 'https://cdn.example.com/a.jpg' }),
      },
    })
    await nextTick()
    expect(wrapper.find('img').attributes('src')).toBe('https://cdn.example.com/a.jpg')
  })

  it('shows the default icon without a cover', async () => {
    const wrapper = mountComponent(PlaylistCoverImage, {
      props: { playlist: makePlaylist({ id: 1, name: 'A', coverUrl: '' }) },
    })
    await nextTick()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.default-cover').exists()).toBe(true)
  })

  it('shows a heart for the liked list', async () => {
    const wrapper = mountComponent(PlaylistCoverImage, {
      props: { playlist: makePlaylist({ id: 0 }) },
    })
    await nextTick()
    expect(wrapper.find('.like-icon').exists()).toBe(true)
  })
})
