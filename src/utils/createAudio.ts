import { Capacitor } from '@capacitor/core'
import { MediaSession } from '@pejota14/capacitor-media-session'
import { Song } from './interface'
const DEFAULT_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(`
<svg t="1780215911476" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1731" width="200" height="200"><path d="M742.3 100.3l-25.6 44.3c126.2 73 204.7 208.9 204.7 354.6 0 225.7-183.6 409.3-409.3 409.3S102.8 724.8 102.8 499.1c0-145.7 78.4-281.5 204.7-354.6l-25.6-44.3c-142 82.1-230.2 235-230.2 398.8 0 253.9 206.6 460.5 460.5 460.5S972.6 753 972.6 499.1c0-163.9-88.2-316.7-230.3-398.8z" fill="#1afa29" p-id="1732"></path><path d="M464.2 437l-25.6-44.3c-45.3 26.2-73.5 75-73.5 127.3 0 81 65.9 147 147 147s147-65.9 147-147v-6.3L451.2 115.4h164V64.2H366.8l241 461.8c-3.1 50.1-44.8 89.9-95.6 89.9-52.8 0-95.8-43-95.8-95.8-0.1-34.1 18.2-66 47.8-83.1z" fill="#1afa29" p-id="1733"></path></svg>
`)
export type AudioEvent =
  | 'loadstart'
  | 'loadedmetadata'
  | 'canplay'
  | 'play'
  | 'pause'
  | 'timeupdate'
  | 'ended'
  | 'error'

type EventCallback = (data?: any) => void

export class NativeAudioPlayer {
  private static instance: NativeAudioPlayer

  static getInstance() {
    if (!this.instance) this.instance = new NativeAudioPlayer()
    return this.instance
  }

  private constructor() {
    this.setupMediaSessionHandlers()
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('MediaSession')) {
      if (this.currentSong && this._loaded) {
        this.updateMediaSessionMetadata(this.currentSong)
      }
    }
  }
  private updatePositionState() {
    console.log('[MediaSession] updatePositionState', {
      duration: this._duration,
      position: this._currentTime,
    })
    if (this._duration > 0 && this._currentTime >= 0) {
      try {
        // eslint-disable-next-line no-extra-semi
        ;(MediaSession as any).setPositionState?.({
          duration: this._duration,
          playbackRate: 1.0,
          position: this._currentTime,
        })
      } catch (e) {
        console.warn('插件不支持 setPositionState，进度无法显示')
      }
    }
  }
  public async updateMediaSessionMetadata(song: Song) {
    console.log('[MediaSession] setMetadata called', song?.title)
    if (!song || !Capacitor.isPluginAvailable('MediaSession')) return
    try {
      const coverSrc = song.albumArtUri || DEFAULT_COVER
      try {
        await MediaSession.setMetadata({
          title: song.title,
          artist: song.artist || 'Unknown',
          album: song.album || '',
          artwork: [{ src: coverSrc, sizes: '512x512', type: 'image/png' }],
        })
        console.log('[MediaSession] setMetadata success')
      } catch (e) {
        console.error('[MediaSession] setMetadata failed', e)
      }
    } catch (e) {
      console.warn('MediaSession setMetadata failed', e)
    }
  }

  private async updateMediaSessionPlaybackState(isPlaying: boolean) {
    console.log('[MediaSession] setPlaybackState', isPlaying)
    if (!Capacitor.isPluginAvailable('MediaSession')) return
    try {
      await MediaSession.setPlaybackState({
        playbackState: isPlaying ? 'playing' : 'paused',
      })
    } catch (e) {
      console.warn('MediaSession setPlaybackState failed', e)
    }
  }

  private media: Media | null = null
  private _src = ''
  private _duration = 0
  private _currentTime = 0
  private _paused = true
  private _loaded = false
  private _loading = false
  private _volume = 1
  private _loop = false

  private timer: number | null = null

  private seekingLock = false
  private _pendingSeek: number | null = null
  private _pendingSeekResolver: (() => void) | null = null

  private currentSong: Song | null = null
  private listeners = new Map<AudioEvent, Set<EventCallback>>()

  get src() {
    return this._src
  }

  set src(val: string) {
    if (!val || val === this._src) return
    this._src = val
    this._currentTime = 0
    this._duration = 0
    this._paused = true
    this._loaded = false
    this.emit('loadstart')
    this.load()
  }

  get currentTime() {
    return this._currentTime
  }

  set currentTime(v: number) {
    this.seek(v)
  }

  get duration() {
    return this._duration
  }

  get paused() {
    return this._paused
  }

  addEventListener(event: AudioEvent, cb: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(cb)
  }

  removeEventListener(event: AudioEvent, cb: EventCallback) {
    this.listeners.get(event)?.delete(cb)
  }

  private emit(event: AudioEvent, data?: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data))
  }

  private setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play())
      navigator.mediaSession.setActionHandler('pause', () => this.pause())
      navigator.mediaSession.setActionHandler('stop', () => this.destroy())
    }
  }

  async load() {
    if (!this._src || this._loading) return

    this._loading = true
    this.releaseMedia()

    try {
      this.media = new Media(
        this._src,
        () => this.onEnded(),
        (err) => this.onError(err),
        (status) => {
          if (status === 2 && !this._loaded) {
            this.resolveDuration()
          }
        }
      )

      this.media.setVolume(this._volume)
    } catch (e) {
      this.onError(e)
    } finally {
      this._loading = false
    }
  }

  // ---------------- duration ----------------
  private async resolveDuration(retries = 10, interval = 300) {
    for (let i = 0; i < retries; i++) {
      await new Promise((r) => setTimeout(r, interval))
      const d = this.media?.getDuration() || 0

      if (d > 0) {
        this._duration = d
        this._loaded = true

        this.emit('loadedmetadata')
        this.emit('canplay')

        if (this.currentSong) {
          this.updateMediaSessionMetadata(this.currentSong)
        }
        this.updatePositionState()
        this.flushPendingSeek()
        return
      }
    }

    this._loaded = true
    this._duration = -1
    this.emit('loadedmetadata')
    this.emit('canplay')
  }

  private flushPendingSeek() {
    if (this._pendingSeek == null) return

    const t = this._pendingSeek
    this._pendingSeek = null

    try {
      this.media?.seekTo(t * 1000)
      this._currentTime = t
      this.emit('timeupdate')
      this._pendingSeekResolver?.()
    } finally {
      this._pendingSeekResolver = null
    }
  }

  // ---------------- play / pause ----------------
  async play() {
    if (!this.media) await this.load()
    if (!this.media) return

    try {
      this.media.play({ numberOfLoops: this._loop ? -1 : 0 })
      this._paused = false

      this.startTimer()
      this.emit('play')
    } catch (e) {
      this.onError(e)
    }
    console.log('[Audio] play executed, paused:', this._paused)
    this.updateMediaSessionPlaybackState(true)
    this.updatePositionState()
  }

  async pause() {
    if (!this.media) return

    this.media.pause()
    this._paused = true

    this.stopTimer()
    this.emit('pause')
    this.updateMediaSessionPlaybackState(false)
  }

  // ---------------- seek ----------------
  async seek(time: number): Promise<void> {
    const t = Math.max(0, Math.min(time, this._duration > 0 ? this._duration : 0))

    if (this.seekingLock) return
    this.seekingLock = true

    if (!this._loaded || this._duration <= 0) {
      this._pendingSeek = t

      return new Promise((resolve) => {
        this._pendingSeekResolver = resolve
        this.seekingLock = false
      })
    }

    try {
      this.media?.seekTo(t * 1000)
      this._currentTime = t
      this.emit('timeupdate')
      this.updatePositionState()
    } finally {
      this.seekingLock = false
    }
  }

  // ---------------- timer（关键修复点） ----------------
  private startTimer() {
    if (this.timer) return // 防止重复启动

    this.timer = window.setInterval(() => {
      if (this._paused || !this.media) return

      this.media.getCurrentPosition(
        (pos) => {
          if (typeof pos === 'number' && pos >= 0) {
            this._currentTime = pos
            this.emit('timeupdate')
            this.updatePositionState()
          }
        },
        (err) => console.warn('[Audio] position error', err)
      )
    }, 1000)
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // ---------------- lifecycle ----------------
  private releaseMedia() {
    this.stopTimer()

    if (this.media) {
      this.media.stop()
      this.media.release()
      this.media = null
    }

    this._loaded = false
    this._paused = true
    this._currentTime = 0
    this._duration = 0
  }

  async destroy() {
    this.releaseMedia()
  }

  // ---------------- song ----------------
  setSong(song: Song) {
    this.currentSong = song
    if (this._loaded) {
      this.updateMediaSessionMetadata(song)
    }
  }

  // ---------------- events ----------------
  private onEnded() {
    if (!this._loop) {
      this._paused = true
      this.stopTimer()
      this.emit('ended')
    }
  }

  private onError(e: any) {
    console.error('[Audio] error', e)
    this.emit('error', e)
  }

  // ---------------- volume ----------------
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v))
    this.media?.setVolume(this._volume)
  }
}

export const audio = NativeAudioPlayer.getInstance()
