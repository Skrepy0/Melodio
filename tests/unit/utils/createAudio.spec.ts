import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audio, NativeAudioPlayer } from '@/utils/createAudio'
import { useAppStore } from '@/stores/app'
import { emitNative, mockMethod, resetPlugins } from '../helpers/capacitor'
import { freshPinia } from '../helpers/store'

/** `audio` is a module-level singleton created at import time. */
const native = (method: string, impl?: any) => mockMethod('NativeAudio', method, impl)

beforeEach(() => {
  resetPlugins()
  freshPinia()
  // The singleton was constructed before this test's mocks; re-arm the
  // instance fields we care about through the public API.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NativeAudioPlayer', () => {
  it('is a singleton', () => {
    expect(NativeAudioPlayer.getInstance()).toBe(audio)
  })

  it('forwards play/pause/stop and tracks the paused flag', async () => {
    const play = native('play')
    const pause = native('pause')
    const stop = native('stop')
    const appStore = useAppStore()
    appStore.markFirstPlayFlag()

    await audio.play()
    expect(play).toHaveBeenCalled()
    expect(audio.paused).toBe(false)

    await audio.pause()
    expect(pause).toHaveBeenCalled()
    expect(audio.paused).toBe(true)

    await audio.stop()
    expect(stop).toHaveBeenCalled()
    expect(audio.paused).toBe(true)
  })

  it('applies the playback rate on the first play only', async () => {
    const rate = native('setPlaybackRate')
    native('play')
    const appStore = useAppStore()

    await audio.play()
    expect(rate).toHaveBeenCalledWith({ rate: appStore.playbackRate })
    expect(appStore.getFirstPlayFlag()).toBe(true)

    rate.mockClear()
    await audio.play()
    expect(rate).not.toHaveBeenCalled()
  })

  it('seeks and updates currentTime', async () => {
    const seek = native('seek')
    await audio.seek(42)
    expect(seek).toHaveBeenCalledWith({ time: 42 })
    expect(audio.currentTime).toBe(42)
  })

  it('assigning currentTime seeks', async () => {
    const seek = native('seek')
    audio.currentTime = 12
    await Promise.resolve()
    expect(seek).toHaveBeenCalledWith({ time: 12 })
  })

  it('clamps volume to 0..1', () => {
    const volume = native('setVolume')
    audio.volume = 1.7
    expect(volume).toHaveBeenLastCalledWith({ volume: 1 })
    audio.volume = -0.5
    expect(volume).toHaveBeenLastCalledWith({ volume: 0 })
    audio.volume = 0.3
    expect(volume).toHaveBeenLastCalledWith({ volume: 0.3 })
  })

  it('forwards playlist and transport commands', async () => {
    const setPlaylist = native('setPlaylist')
    const playIndex = native('playIndex')
    const repeat = native('setRepeatMode')
    const index = native('setCurrentIndex')
    const refresh = native('refreshCurrentMetadata')
    const appStore = useAppStore()

    const songs = [{ url: 'a', title: 'A', artist: 'B', album: '', coverUrl: '' }]
    await audio.setPlaylist(songs)
    expect(setPlaylist).toHaveBeenCalledWith({ songs })

    await audio.playIndex(2, appStore.getPlayQueueRepeat())
    expect(playIndex).toHaveBeenCalledWith({
      index: 2,
      playQueueRepeat: appStore.getPlayQueueRepeat(),
      autoPlay: true,
    })
    await audio.playIndex(1, appStore.getPlayQueueRepeat(), false)
    expect(playIndex).toHaveBeenLastCalledWith({
      index: 1,
      playQueueRepeat: appStore.getPlayQueueRepeat(),
      autoPlay: false,
    })

    await audio.setRepeatMode(true)
    expect(repeat).toHaveBeenCalledWith({ repeatOne: true })

    await audio.setCurrentIndex(4)
    expect(index).toHaveBeenCalledWith({ index: 4 })

    await audio.refreshCurrentMetadata()
    expect(refresh).toHaveBeenCalled()
  })

  it('forwards file and focus helpers', async () => {
    const save = native('saveFile', () => ({ uri: 'file:///backup.json' }))
    const open = native('openFile', () => ({ data: '{"a":1}' }))
    const focus = native('setAudioFocusEnabled')
    const rate = native('setPlaybackRate')

    await expect(audio.saveFile('backup.json', '{}')).resolves.toBe('file:///backup.json')
    expect(save).toHaveBeenCalledWith({ fileName: 'backup.json', data: '{}' })

    await expect(audio.openFile()).resolves.toBe('{"a":1}')
    expect(open).toHaveBeenCalled()

    await audio.setAudioFocusEnabled(false)
    expect(focus).toHaveBeenCalledWith({ enabled: false })

    await audio.setPlaybackRate(1.5)
    expect(rate).toHaveBeenCalledWith({ rate: 1.5 })
  })

  it('exposes the native state snapshot', async () => {
    const state = { isPlaying: true, currentIndex: 3, currentPosition: 12.5, duration: 200 }
    native('getState', () => state)
    await expect(audio.getState()).resolves.toEqual(state)
  })

  it('subscribes and unsubscribes listeners', async () => {
    const listener = vi.fn()
    audio.addEventListener('ended', listener)
    emitNative('NativeAudio', 'ended')
    expect(listener).toHaveBeenCalledTimes(1)

    audio.removeEventListener('ended', listener)
    emitNative('NativeAudio', 'ended')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('mirrors native callbacks into player state', () => {
    emitNative('NativeAudio', 'timeupdate', { position: 30 })
    expect(audio.currentTime).toBe(30)

    emitNative('NativeAudio', 'songChanged', { index: 1, duration: 210, isPlaying: true })
    expect(audio.duration).toBe(210)
    expect(audio.paused).toBe(false)

    emitNative('NativeAudio', 'songChanged', { index: 2, duration: 100, isPlaying: false })
    expect(audio.paused).toBe(true)
  })

  it('re-emits native events to registered listeners', () => {
    const onTime = vi.fn()
    const onSong = vi.fn()
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const onEnded = vi.fn()
    const onError = vi.fn()
    const onPlayState = vi.fn()

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('songChanged', onSong)
    audio.addEventListener('nexttrack', onNext)
    audio.addEventListener('previoustrack', onPrev)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('playStateChange', onPlayState)

    emitNative('NativeAudio', 'timeupdate', { position: 5 })
    emitNative('NativeAudio', 'songChanged', { index: 1, duration: 90, isPlaying: true })
    emitNative('NativeAudio', 'nexttrack')
    emitNative('NativeAudio', 'previoustrack')
    emitNative('NativeAudio', 'ended')
    emitNative('NativeAudio', 'error', { message: 'boom' })
    emitNative('NativeAudio', 'playStateChange', { isPlaying: true })

    expect(onTime).toHaveBeenCalled()
    expect(onSong).toHaveBeenCalledWith({ index: 1, duration: 90, isPlaying: true })
    expect(onNext).toHaveBeenCalled()
    expect(onPrev).toHaveBeenCalled()
    expect(onEnded).toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith({ message: 'boom' })
    expect(onPlayState).toHaveBeenCalledWith({ isPlaying: true })

    for (const cb of [onTime, onSong, onNext, onPrev, onEnded, onError, onPlayState]) {
      cb.mockClear()
    }
  })

  it('pauses the UI when audio focus is denied', () => {
    const onPlayState = vi.fn()
    audio.addEventListener('playStateChange', onPlayState)

    emitNative('NativeAudio', 'audioFocusDenied')

    expect(audio.paused).toBe(true)
    expect(onPlayState).toHaveBeenCalledWith({ isPlaying: false })
  })
})
