export interface SongItem {
  url: string
  title: string
  artist: string
  album: string
  coverUrl: string
}

export interface NativeAudioPlugin {
  load(options: { url: string }): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  seek(options: { time: number }): Promise<void>
  setVolume(options: { volume: number }): Promise<void>
  getDuration(): Promise<{ duration: number }>
  getCurrentPosition(): Promise<{ position: number }>

  setPlaylist(options: { songs: SongItem[] }): Promise<void>
  playIndex(options: { index: number; autoPlay: boolean }): Promise<void>

  setMetadata(metadata: SongItem & { duration?: number }): Promise<void>
  updatePlaybackState(options: { isPlaying: boolean }): Promise<void>

  addListener(
    eventName:
      | 'ended'
      | 'error'
      | 'timeupdate'
      | 'nexttrack'
      | 'previoustrack'
      | 'songChanged'
      | 'playStateChange',
    listener: (data: any) => void
  ): void
  removeAllListeners(): Promise<void>
}
