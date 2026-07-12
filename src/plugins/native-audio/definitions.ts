export interface SongItem {
  url: string
  title: string
  artist: string
  album: string
  coverUrl: string | any
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
  setRepeatMode(options: { repeatOne: boolean }): Promise<void>
  setCurrentIndex(options: { index: number }): Promise<void>
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
  saveFile(options: { fileName: string; data: string }): Promise<{ uri: string }>
  openFile(): Promise<{ data: string }>
  setAudioFocusEnabled(options: { enabled: boolean }): Promise<void>
  setPlaybackRate(options: { rate: number }): Promise<void>
}
