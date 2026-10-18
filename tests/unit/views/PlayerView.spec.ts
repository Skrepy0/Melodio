import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PlayerView from '@/views/PlayerView.vue'
import { useAppStore } from '@/stores/app'
import { makeSongs } from '../helpers/factories'
import { resetPlugins } from '../helpers/capacitor'
import { mountComponent, routerMock } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, fetchCoverFromWeb: vi.fn(async () => null) }
})

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))

vi.mock('@/router', () => ({
  default: { back: vi.fn(), push: vi.fn(async () => {}) },
}))

import { showConfirm } from '@/utils/createConfirm'
import router from '@/router'

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function seedQueue() {
  const store = useAppStore()
  const songs = makeSongs(3)
  store.setPlayQueue(songs)
  store.setMockCurrentTime(0)
  store.setIsPlaying(false)
  return { store, songs }
}

describe('PlayerView', () => {
  it('renders the current track and queue', async () => {
    const { songs } = seedQueue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    expect(wrapper.find('.song-name').text()).toBe(songs[0].title)
    expect(wrapper.find('.song-artist').text()).toBe(songs[0].artist)
    expect(wrapper.findAll('.queue-item')).toHaveLength(3)
    expect(wrapper.find('.queue-item').classes()).toContain('current')
  })

  it('shows a fallback title without a current song', async () => {
    const wrapper = mountComponent(PlayerView)
    await nextTick()
    expect(wrapper.find('.song-name').text()).toBeTruthy()
    expect(wrapper.findAll('.queue-item')).toHaveLength(0)
  })

  it('toggles playback', async () => {
    const { store } = seedQueue()
    const toggle = vi.spyOn(store, 'togglePlay').mockResolvedValue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.find('.play-pause').trigger('click')
    expect(toggle).toHaveBeenCalled()
  })

  it('skips to the next and previous track', async () => {
    const { store } = seedQueue()
    const next = vi.spyOn(store, 'nextSong').mockResolvedValue()
    const prev = vi.spyOn(store, 'prevSong').mockResolvedValue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const controls = wrapper.findAll('.controls .control-btn')
    // Order: play mode, previous, [play], next, shuffle.
    await controls[1].trigger('click')
    expect(prev).toHaveBeenCalled()
    await controls[2].trigger('click')
    expect(next).toHaveBeenCalled()
  })

  it('cycles the play mode', async () => {
    const { store } = seedQueue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()
    expect(store.getPlayMode()).toBe('sequential')

    await wrapper.find('.controls .control-btn.small').trigger('click')
    expect(store.getPlayMode()).toBe('repeatOne')
    expect(wrapper.find('.controls .control-btn.small').classes()).toContain('active')

    await wrapper.find('.controls .control-btn.small').trigger('click')
    expect(store.getPlayMode()).toBe('sequential')
  })

  it('cycles the playback rate', async () => {
    const { store } = seedQueue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()
    expect(wrapper.find('.rate-btn').text()).toBe('1×')

    await wrapper.find('.rate-btn').trigger('click')
    await nextTick()
    expect(store.playbackRate).toBe(1.25)
    expect(wrapper.find('.rate-btn').text()).toBe('1.25×')

    // 1.25 → 1.5 → 2 → 0.5 (wraps) → 0.65 → 0.8 → 1
    for (let i = 0; i < 3; i++) {
      await wrapper.find('.rate-btn').trigger('click')
      await nextTick()
    }
    expect(store.playbackRate).toBe(0.5)
  })

  it('formats the elapsed and total time', async () => {
    const { store } = seedQueue()
    store.setMockCurrentTime(65)
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const times = wrapper.findAll('.time').map((el) => el.text())
    expect(times).toContain('01:05')
    expect(times[1]).toMatch(/^\d{2}:\d{2}$/)
  })

  it('seeks with the keyboard', async () => {
    const { store } = seedQueue()
    store.setMockCurrentTime(30)
    const seek = vi.fn()
    const audio = (await import('@/utils/createAudio')).audio
    audio.seek = seek
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.find('.progress-bar-container').trigger('keydown', { key: 'ArrowRight' })
    expect(seek).toHaveBeenCalledWith(35)

    await wrapper.find('.progress-bar-container').trigger('keydown', { key: 'ArrowLeft' })
    expect(seek).toHaveBeenCalledWith(30)
  })

  it('clamps seeking to the track bounds', async () => {
    const { store } = seedQueue()
    store.setMockCurrentTime(0)
    const seek = vi.fn()
    const audio = (await import('@/utils/createAudio')).audio
    audio.seek = seek
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.find('.progress-bar-container').trigger('keydown', { key: 'ArrowLeft' })
    expect(seek).toHaveBeenCalledWith(0)
  })

  it('plays a song from the queue', async () => {
    const { store } = seedQueue()
    const audio = (await import('@/utils/createAudio')).audio
    const playIndex = vi.spyOn(audio, 'playIndex').mockResolvedValue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.findAll('.queue-item')[2].trigger('click')
    await vi.waitFor(() => expect(playIndex).toHaveBeenCalledWith(2))
    expect(store.getPlayData().mockCurrentTime).toBe(0)
  })

  it('toggles playback when tapping the current queue row', async () => {
    const { store } = seedQueue()
    const toggle = vi.spyOn(store, 'togglePlay').mockResolvedValue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.findAll('.queue-item')[0].trigger('click')
    expect(toggle).toHaveBeenCalled()
  })

  it('shuffles the tail of the queue but keeps the current track first', async () => {
    const { store } = seedQueue()
    store.playData.currentIndex = 0
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const shuffle = wrapper.findAll('.controls .control-btn')[3]
    await shuffle.trigger('click')
    await nextTick()

    const queue = store.getPlayQueue()
    expect(queue).toHaveLength(3)
    expect(queue[0].id).toBe('song-1')
  })

  it('clears the queue after confirmation', async () => {
    const { store } = seedQueue()
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.find('.clear-queue-btn').trigger('click')
    await vi.waitFor(() => expect(store.getPlayQueue()).toEqual([]))
  })

  it('keeps the queue when clearing is cancelled', async () => {
    const { store } = seedQueue()
    vi.mocked(showConfirm).mockResolvedValue(false)
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    await wrapper.find('.clear-queue-btn').trigger('click')
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled())
    expect(store.getPlayQueue()).toHaveLength(3)
  })

  it('removes a song from the queue', async () => {
    const { store } = seedQueue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const dropdown = wrapper.findAllComponents({ name: 'DropdownButton' })[1]
    dropdown.vm.$emit('select', { value: 'remove' })
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(2))
  })

  it('removes the current song and keeps the index in range', async () => {
    const { store } = seedQueue()
    store.playData.currentIndex = 2
    const audio = (await import('@/utils/createAudio')).audio
    const setIndex = vi.spyOn(store, 'setCurrentIndex')
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const dropdowns = wrapper.findAllComponents({ name: 'DropdownButton' })
    dropdowns[2].vm.$emit('select', { value: 'remove' })
    await vi.waitFor(() => expect(store.getPlayQueue()).toHaveLength(2))
    // Removing the last track clamps the index onto the new last track.
    expect(setIndex).toHaveBeenCalledWith(1)
  })

  it('adds a queue song to the playlist', async () => {
    const { store } = seedQueue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const dropdown = wrapper.findAllComponents({ name: 'DropdownButton' })[0]
    dropdown.vm.$emit('select', { value: 'like' })
    await vi.waitFor(() => expect(store.getLikeList().data).toHaveLength(1))
  })

  it('goes back from the top bar', async () => {
    seedQueue()
    const wrapper = mountComponent(PlayerView)
    await nextTick()
    await wrapper.find('.top-bar .bar-btn').trigger('click')
    expect(router.back).toHaveBeenCalled()
  })

  it('marks songs before the current one', async () => {
    const { store } = seedQueue()
    store.playData.currentIndex = 2
    const wrapper = mountComponent(PlayerView)
    await nextTick()

    const items = wrapper.findAll('.queue-item')
    expect(items[0].classes()).toContain('past-song')
    expect(items[2].classes()).toContain('current')
  })
})
