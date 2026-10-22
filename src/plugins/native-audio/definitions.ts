import type { LyricCacheEntry, LyricCacheRecord } from '@/utils/lyricCache'
export interface SongItem {
  url: string
  title: string
  artist: string
  album: string
  lyric?: string | null
  duration?: number
  coverUrl: string | any
}

export interface PlaybackStateSnapshot {
  isPlaying: boolean
  currentIndex: number
  currentPosition: number
  duration: number
}

export interface NativeLyricsOptions {
  enabled: boolean
  online: boolean
  retryCount: number
  metingApi: string
}

export interface NativeAudioPlugin {
  importLyricsCache(options: { entries: LyricCacheRecord[] }): Promise<void>
  listLyricsCache(): Promise<{ entries: LyricCacheEntry[] }>
  readLyricsCache(options: { id: string }): Promise<{ lyrics: string }>
  deleteLyricsCache(options: { id: string }): Promise<void>
  clearLyricsCache(): Promise<void>
  configureLyrics(options: NativeLyricsOptions): Promise<void>
  lookupLyrics(
    options: Omit<NativeLyricsOptions, 'enabled'> & { song: Omit<SongItem, 'coverUrl'> }
  ): Promise<{ lines: Array<{ time: number; text: string }> }>

  load(options: { url: string }): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  seek(options: { time: number }): Promise<void>
  setVolume(options: { volume: number }): Promise<void>
  getDuration(): Promise<{ duration: number }>
  getCurrentPosition(): Promise<{ position: number }>

  setPlaylist(options: { songs: SongItem[] }): Promise<void>
  refreshCurrentMetadata(): Promise<void>
  /** Drops the native artwork cache when the web-side cover cache is cleared. */
  clearCoverCache(): Promise<void>
  playIndex(options: { index: number; playQueueRepeat: boolean; autoPlay: boolean }): Promise<void>
  setPlayQueueRepeat(options: { enabled: boolean }): Promise<void>
  setMetadata(metadata: SongItem & { duration?: number }): Promise<void>
  updatePlaybackState(options: { isPlaying: boolean }): Promise<void>
  setRepeatMode(options: { repeatOne: boolean }): Promise<void>
  setCurrentIndex(options: { index: number }): Promise<void>
  /** Native player snapshot used to reconcile state after a WebView reload. */
  getState(): Promise<PlaybackStateSnapshot>
  addListener(
    eventName:
      | 'ended'
      | 'error'
      | 'timeupdate'
      | 'nexttrack'
      | 'previoustrack'
      | 'songChanged'
      | 'playStateChange'
      | 'audioFocusDenied',
    listener: (data: any) => void
  ): void
  removeAllListeners(): Promise<void>
  saveFile(options: { fileName: string; data: string }): Promise<{ uri: string }>
  openFile(): Promise<{ data: string }>
  setAudioFocusEnabled(options: { enabled: boolean }): Promise<void>
  setPlaybackRate(options: { rate: number }): Promise<void>
  getEmbeddedCover(options: { uri: string; key: string }): Promise<{ path?: string }>
}
