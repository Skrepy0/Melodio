import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as lyrics from '@/utils/lyrics'
import { nextTick } from 'vue'
import PlayerView from '@/views/PlayerView.vue'
import { useAppStore } from '@/stores/app'
import { makeSongs } from '../helpers/factories'
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
  vi.spyOn(lyrics, 'loadTrackLyrics').mockImplementation(async (song) =>
    lyrics.parseLyrics(song.lyric || '')
  )
})

afterEach(() => {
  vi.useRealTimers()
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
  it('passes the retry setting and cancels work when online lyrics are disabled', async () => {
    const { store } = seedQueue()
    store.setLyricsRetryCount(7)
    const wrapper = mountComponent(PlayerView)
    expect(vi.mocked(lyrics.loadTrackLyrics).mock.calls[0][3]).toBe(7)
    const signal = vi.mocked(lyrics.loadTrackLyrics).mock.calls[0][2]
    store.setSearchLyricsOnline(false)
    await nextTick()
    expect(signal.aborted).toBe(true)
    const latest = vi.mocked(lyrics.loadTrackLyrics).mock.calls.at(-1)!
    expect(latest[1]).toBe(false)
    expect(latest[3]).toBe(7)
    wrapper.unmount()
  })

  it('keeps lyric swipes out of the player collapse gesture', async () => {
    seedQueue()
    const wrapper = mountComponent(PlayerView)
    await wrapper
      .find('.lyrics')
      .trigger('pointerdown', { pointerId: 42, pointerType: 'touch', clientY: 200 })
    const move = new Event('pointermove', { bubbles: true, cancelable: true })
    Object.assign(move, { pointerId: 42, clientY: 100 })
    document.dispatchEvent(move)
    expect(move.defaultPrevented).toBe(false)
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--p')).toBe('')
    document.dispatchEvent(Object.assign(new Event('pointercancel'), { pointerId: 42 }))
    wrapper.unmount()
  })

  it('centers the active lyric within its own scroll container', async () => {
    const { store } = seedQueue()
    vi.mocked(lyrics.loadTrackLyrics).mockResolvedValueOnce([
      { time: 0, text: 'First' },
      { time: 10, text: 'Next' },
    ])
    const wrapper = mountComponent(PlayerView)
    await vi.waitFor(() => expect(wrapper.findAll('.lyric-line')).toHaveLength(2))
    const container = wrapper.find('.lyrics').element as HTMLElement
    const line = wrapper.findAll('.lyric-line')[1].element as HTMLElement
    container.scrollTop = 40
    Object.defineProperty(container, 'clientHeight', { value: 120 })
    Object.defineProperty(container, 'scrollHeight', { value: 500 })
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 200 } as DOMRect)
    vi.spyOn(line, 'getBoundingClientRect').mockReturnValue({ top: 310, height: 32 } as DOMRect)
    const scrollTo = vi.fn()
    container.scrollTo = scrollTo
    store.setMockCurrentTime(11)
    await nextTick()
    await nextTick()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 106, behavior: 'smooth' })

    vi.useFakeTimers()
    await wrapper.find('.lyrics').trigger('wheel', { deltaY: 50 })
    scrollTo.mockClear()
    store.setMockCurrentTime(0)
    await nextTick()
    await nextTick()
    expect(scrollTo).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2999)
    expect(scrollTo).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)

    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    store.setMockCurrentTime(11)
    await nextTick()
    await nextTick()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 106, behavior: 'auto' })
    wrapper.unmount()
  })

  it('loads online lyrics by default and clears old requests on track changes', async () => {
    const { store } = seedQueue()
    let finish: (lines: lyrics.LyricLine[]) => void = () => {}
    vi.mocked(lyrics.loadTrackLyrics)
      .mockImplementationOnce(
        (_song, _online, signal) =>
          new Promise((resolve) => {
            finish = resolve
            expect(signal.aborted).toBe(false)
          })
      )
      .mockResolvedValueOnce([{ time: 0, text: 'Next song' }])
    const wrapper = mountComponent(PlayerView)
    expect(wrapper.find('.lyrics-empty').text()).toBeTruthy()
    store.getPlayData().currentIndex = 1
    await vi.waitFor(() => expect(wrapper.find('.lyric-line').text()).toBe('Next song'))
    finish([{ time: 0, text: 'Stale song' }])
    await nextTick()
    expect(wrapper.find('.lyric-line').text()).toBe('Next song')
    wrapper.unmount()
  })

  it('shows failure and lets the user retry', async () => {
    seedQueue()
    vi.mocked(lyrics.loadTrackLyrics)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ time: 0, text: 'Found' }])
    const wrapper = mountComponent(PlayerView)
    await vi.waitFor(() => expect(wrapper.find('.lyrics-retry').exists()).toBe(true))
    await wrapper.find('.lyrics-retry').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.lyric-line').text()).toBe('Found'))
    wrapper.unmount()
  })

  it('toggles lyrics and follows playback and backward seeks', async () => {
    const { store, songs } = seedQueue()
    store.setShowLyrics(false)
    songs[0].lyric = '[00:01]First\n[00:05]Second'
    store.setPlayQueue(songs)
    const wrapper = mountComponent(PlayerView)
    expect(wrapper.find('.lyrics').exists()).toBe(false)
    store.setShowLyrics(true)
    await vi.waitFor(() => expect(wrapper.findAll('.lyric-line')).toHaveLength(2))
    expect(wrapper.find('.lyric-line.active').exists()).toBe(false)
    store.setMockCurrentTime(6)
    await nextTick()
    expect(wrapper.find('.lyric-line.active').text()).toBe('Second')
    store.setMockCurrentTime(2)
    await nextTick()
    expect(wrapper.find('.lyric-line.active').text()).toBe('First')
    store.setShowLyrics(false)
    await nextTick()
    expect(wrapper.find('.lyrics').exists()).toBe(false)
    wrapper.unmount()
  })

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
    await vi.waitFor(() =>
      expect(playIndex).toHaveBeenCalledWith(2, store.getPlayQueueRepeat(), true)
    )
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
