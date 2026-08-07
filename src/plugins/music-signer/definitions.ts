import { OnlineSong, Song } from '@/utils/interface'

export interface MusicSignerPlugin {
  search(options: {
    keyword: string
    clients: string[]
    limit: number
    eachSongTimeOut: number
    totalTimeOut?: number
  }): Promise<{ items: OnlineSong[]; total: number }>
  download(options: { url: string; fileName: string }): Promise<{ path: string; size: number }>
  getAudioInfo(options: { path: string }): Promise<Song>
}
