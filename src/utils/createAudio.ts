import { registerPlugin } from '@capacitor/core'
import type { NativeAudioPlugin, SongItem } from '@/plugins/native-audio/definitions'
import { useAppStore } from '@/stores/app'

const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio')
export type AudioEvent =
  | 'play'
  | 'pause'
  | 'timeupdate'
  | 'ended'
  | 'error'
  | 'nexttrack'
  | 'previoustrack'
  | 'songChanged'
  | 'playStateChange'

type EventCallback = (data?: any) => void

export class NativeAudioPlayer {
  private static instance: NativeAudioPlayer
  private listeners = new Map<AudioEvent, Set<EventCallback>>()

  private constructor() {
    this.setupListeners()
    NativeAudio.addListener('playStateChange', (data: { isPlaying: boolean }) => {
      this._paused = !data.isPlaying
      this.emit('playStateChange', data)
    })
  }

  private _currentTime = 0

  get currentTime() {
    return this._currentTime
  }

  set currentTime(value: number) {
    this.seek(value).catch(console.error)
  }

  private _duration = 0

  get duration() {
    return this._duration
  }

  private _paused = true

  get paused() {
    return this._paused
  }

  private _volume = 1

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v))
    NativeAudio.setVolume({ volume: this._volume })
  }

  static getInstance() {
    if (!this.instance) this.instance = new NativeAudioPlayer()
    return this.instance
  }

  async setRepeatMode(repeatOne: boolean) {
    await NativeAudio.setRepeatMode({ repeatOne })
  }

  async setPlayQueueRepeat(enabled: boolean) {
    await NativeAudio.setPlayQueueRepeat({ enabled })
  }

  async setCurrentIndex(index: number) {
    await NativeAudio.setCurrentIndex({ index })
  }

  /** Native player snapshot, used to reconcile persisted state on reload. */
  async getState() {
    return NativeAudio.getState()
  }

  addEventListener(event: AudioEvent, cb: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
  }

  removeEventListener(event: AudioEvent, cb: EventCallback) {
    this.listeners.get(event)?.delete(cb)
  }

  async setPlaylist(songs: SongItem[]) {
    await NativeAudio.setPlaylist({ songs })
  }

  /** Re-read the current track's metadata (e.g. after a cover resolves). */
  async refreshCurrentMetadata() {
    await NativeAudio.refreshCurrentMetadata()
  }

  /** Drops the native artwork cache; call alongside the web cover cache. */
  async clearNativeCoverCache() {
    await NativeAudio.clearCoverCache()
  }

  async playIndex(index: number, playQueueRepeat: boolean, autoPlay = true) {
    await NativeAudio.playIndex({ index, playQueueRepeat, autoPlay })
    // State (_paused, _currentTime) is set by native events (songChanged, playStateChange)
  }

  async play() {
    const appStore = useAppStore()
    if (!appStore.getFirstPlayFlag()) {
      // 初始化第一次播放
      appStore.markFirstPlayFlag()
      await this.setPlaybackRate(appStore.playbackRate)
    }
    await NativeAudio.play()
    this._paused = false
  }

  async pause() {
    await NativeAudio.pause()
    this._paused = true
  }

  async seek(time: number) {
    await NativeAudio.seek({ time: time })
    this._currentTime = time
  }

  async stop() {
    await NativeAudio.stop()
    this._paused = true
  }

  async setPlaybackRate(rate: number) {
    await NativeAudio.setPlaybackRate({ rate })
  }

  async saveFile(fileName: string, jsonData: string): Promise<string> {
    const result = await NativeAudio.saveFile({ fileName, data: jsonData })
    return result.uri
  }

  async openFile(): Promise<string> {
    const result = await NativeAudio.openFile()
    return result.data
  }

  async setAudioFocusEnabled(enabled: boolean) {
    await NativeAudio.setAudioFocusEnabled({ enabled })
  }

  private setupListeners() {
    NativeAudio.addListener('timeupdate', (data: any) => {
      if (data?.position != null) {
        this._currentTime = data.position
        this.emit('timeupdate')
      }
    })
    NativeAudio.addListener('songChanged', (data: any) => {
      this._duration = data?.duration ?? 0
      // A track change is not necessarily a play: a restore/prepare with
      // autoPlay=false leaves the player paused.
      this._paused = data?.isPlaying === false
      this.emit('songChanged', data)
    })
    NativeAudio.addListener('nexttrack', () => this.emit('nexttrack'))
    NativeAudio.addListener('previoustrack', () => this.emit('previoustrack'))
    NativeAudio.addListener('ended', () => this.emit('ended'))
    NativeAudio.addListener('error', (data: any) => {
      console.error('[NativeAudio] Error', data)
      this.emit('error', data)
    })
    // Playback was requested but another app holds audio focus. The native
    // side retries automatically when focus returns; this only informs the UI
    // so it does not claim to be playing.
    NativeAudio.addListener('audioFocusDenied', () => {
      this._paused = true
      this.emit('playStateChange', { isPlaying: false })
    })
  }

  private emit(event: AudioEvent, data?: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data))
  }
}

export const audio = NativeAudioPlayer.getInstance()
