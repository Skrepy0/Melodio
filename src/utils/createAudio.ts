import { getAccessibleUrl } from './functions'
import { Song } from './interface'

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

  // ---------------- getters ----------------
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

  // ---------------- events ----------------
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

  // ---------------- media session ----------------
  private setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play())
      navigator.mediaSession.setActionHandler('pause', () => this.pause())
      navigator.mediaSession.setActionHandler('stop', () => this.destroy())
    }
  }

  // ---------------- load ----------------
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

        if (this.currentSong) this.updateMetadata(this.currentSong)

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
  }

  async pause() {
    if (!this.media) return

    this.media.pause()
    this._paused = true

    this.stopTimer()
    this.emit('pause')
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
    if (this._loaded) this.updateMetadata(song)
  }

  async updateMetadata(song: Song) {
    if (!('mediaSession' in navigator)) return

    let cover = song.albumArtUri
    if (cover) cover = getAccessibleUrl(cover)

    const artwork: MediaImage[] = []

    if (cover) {
      let type = 'image/png'
      if (/\.(jpg|jpeg)$/i.test(cover)) type = 'image/jpeg'
      else if (/\.webp$/i.test(cover)) type = 'image/webp'

      artwork.push({ src: cover, sizes: '512x512', type })
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist || 'Unknown',
      album: song.album || '',
      artwork,
    })
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
