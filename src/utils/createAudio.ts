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
    if (!this.instance) {
      this.instance = new NativeAudioPlayer()
    }
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
  private _volume = 1
  private _loop = false
  private _pendingSeek: number | null = null
  private _pendingSeekResolver: (() => void) | null = null
  private seekingLock = false
  private currentSong: Song | null = null
  private timer: number | null = null
  private listeners = new Map<AudioEvent, Set<EventCallback>>()

  get src() {
    return this._src
  }

  set src(val: string) {
    if (!val || this._src === val) return
    console.log('[Audio] set src:', val)
    this.stopTimer()
    this._src = val
    this._currentTime = 0
    this._duration = 0
    this._paused = true
    this.emit('loadstart')
    this.load().catch(console.error)
  }

  get currentTime() {
    return this._currentTime
  }

  set currentTime(val: number) {
    this.seek(val)
  }

  get duration() {
    return this._duration
  }

  get paused() {
    return this._paused
  }

  get volume() {
    return this._volume
  }

  set volume(val: number) {
    this._volume = Math.max(0, Math.min(1, val))
    if (this.media) {
      this.media.setVolume(this._volume)
    }
  }

  get loop() {
    return this._loop
  }

  set loop(val: boolean) {
    this._loop = val
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

  setSong(song: Song) {
    this.currentSong = song
    if (this._loaded) {
      this.updateMetadata(song)
    }
  }

  async updateMetadata(song: Song) {
    if (!this._loaded) return
    let cover = song.albumArtUri
    if (cover) {
      cover = getAccessibleUrl(cover)
    }
    try {
      if ('mediaSession' in navigator) {
        const artwork: MediaImage[] = []
        if (cover) {
          let type = 'image/png'
          if (/\.(jpg|jpeg)$/i.test(cover)) type = 'image/jpeg'
          else if (/\.webp$/i.test(cover)) type = 'image/webp'
          artwork.push({ src: cover, sizes: '512x512', type })
        }
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist || 'Unknown Artist',
          album: song.album || '',
          artwork,
        })
      }
    } catch (e) {
      console.error('[Audio] updateMetadata error', e)
    }
  }

  private setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play())
      navigator.mediaSession.setActionHandler('pause', () => this.pause())
      navigator.mediaSession.setActionHandler('stop', () => this.destroy())
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
  }

  async load() {
    if (!this._src) return
    this.releaseMedia()
    console.log('[Audio] loading:', this._src)
    try {
      this.media = new Media(
        this._src,
        () => {
          console.log('[Audio] ended')
          if (!this._loop) {
            this._paused = true
            this.stopTimer()
            this.emit('ended')
          }
        },
        (error: MediaError) => {
          console.error('[Audio] error', error)
          this._loaded = false
          this.emit('error', error)
        },
        (status: number) => {
          if (status === 2 && !this._loaded) {
            this.tryGetValidDuration()
          }
        }
      )
      this.media.setVolume(this._volume)
    } catch (e) {
      console.error('[Audio] load error:', e)
      this._loaded = false
      this.emit('error', e)
      throw e
    }
  }

  private async tryGetValidDuration(retries = 10, interval = 300) {
    for (let i = 0; i < retries; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval))
      const dur = this.media?.getDuration() || 0
      console.log(`[Audio] getDuration attempt ${i + 1}:`, dur)
      if (dur > 0) {
        this._duration = dur
        this._loaded = true
        console.log('[Audio] duration:', this._duration)
        this.emit('loadedmetadata')
        this.emit('canplay')
        if (this.currentSong) {
          this.updateMetadata(this.currentSong)
        }
        // 处理延迟的 seek
        if (this._pendingSeek !== null) {
          const seekTime = this._pendingSeek
          this._pendingSeek = null
          const resolver = this._pendingSeekResolver
          this._pendingSeekResolver = null
          try {
            // 直接执行 seek 操作，不再通过 this.seek 避免递归锁
            this.media?.seekTo(seekTime * 1000)
            this._currentTime = seekTime
            this.emit('timeupdate')
            if (resolver) resolver()
          } catch (e) {
            console.error('[Audio] delayed seek error:', e)
            if (resolver) resolver() // 即使出错也要 resolve，避免外部等待挂起
          }
        }
        return
      }
    }
    console.warn('[Audio] failed to get valid duration, using fallback')
    this._duration = -1
    this._loaded = true
    this.emit('loadedmetadata')
    this.emit('canplay')
  }

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

  async play() {
    if (!this.media) {
      await this.load()
    }
    if (!this.media) return
    try {
      this.media.play({ numberOfLoops: this._loop ? -1 : 0 })
      this._paused = false
      this.startTimer()
      this.emit('play')
      if (this.currentSong) {
        this.updateMetadata(this.currentSong)
      }
    } catch (e) {
      console.error('[Audio] play error:', e)
      this.emit('error', e)
    }
  }

  async pause() {
    if (!this.media) return
    this.media.pause()
    this._paused = true
    this.stopTimer()
    this.emit('pause')
  }

  async setSrc(src: string) {
    this.src = src
    await this.load()
  }

  async seek(time: number): Promise<void> {
    console.log('[Audio] seek called', {
      time,
      loaded: this._loaded,
      duration: this._duration,
    })

    if (this.seekingLock) {
      console.warn('[Audio] seek skipped due to lock')
      return
    }
    this.seekingLock = true

    const validTime = Math.max(0, Math.min(time, this._duration > 0 ? this._duration : 0))

    if (!this._loaded || this._duration <= 0) {
      console.log('[Audio] seek deferred (not ready)')
      // 如果有旧的挂起 seek，先 resolve 它（表示被新 seek 覆盖）
      if (this._pendingSeekResolver) {
        this._pendingSeekResolver()
        this._pendingSeekResolver = null
      }
      this._pendingSeek = validTime
      // 返回一个 Promise，等待真正 seek 完成
      const promise = new Promise<void>((resolve) => {
        this._pendingSeekResolver = resolve
      })
      this.seekingLock = false
      return promise
    }

    if (!this.media) {
      console.warn('[Audio] seek aborted, no media instance')
      this.seekingLock = false
      return
    }

    console.log('[Audio] performing seek to', validTime)
    try {
      this.media.seekTo(validTime * 1000)
      this._currentTime = validTime
      this.emit('timeupdate')
      console.log('[Audio] seek success')
    } catch (e) {
      console.error('[Audio] seek error:', e)
      throw e
    } finally {
      this.seekingLock = false
    }
  }

  private startTimer() {
    if (this.timer) return
    this.timer = window.setInterval(() => {
      if (this._loaded && !this._paused && this.media) {
        this.media.getCurrentPosition(
          (position: number) => {
            this._currentTime = position
            this.emit('timeupdate')
          },
          (error: MediaError) => {
            console.error('[Audio] getCurrentPosition error:', error)
          }
        )
      }
      if (this._loaded && this.currentSong) {
        this.updateMetadata(this.currentSong)
        this.setupMediaSessionHandlers()
      }
    }, 1000)
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}

export const audio = NativeAudioPlayer.getInstance()
