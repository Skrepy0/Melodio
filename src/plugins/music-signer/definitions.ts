import { OnlineSong } from '@/utils/interface'

export interface MusicSignerPlugin {
  search(options: {
    keyword: string
    clients: string[]
    limit: number
    connectTimeout: number
    readTimeout: number
    writeTimeout: number
  }): Promise<{ items: OnlineSong[]; total: number }>
  download(options: { url: string; fileName: string }): Promise<{ path: string; size: number }>
}
