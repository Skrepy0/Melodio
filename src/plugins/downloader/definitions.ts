import { OnlineSong } from '@/utils/interface'
import { PluginListenerHandle } from '@capacitor/core'

export interface DownloadProgress {
  loaded: number // 已下载字节数
  total: number // 总字节数（可能为 -1）
  progress: number // 百分比 0-100，若 total 为 -1 则返回 -1
}

export interface DownloadResult {
  path: string // 文件路径
  uri?: string // Android 10+ 的 MediaStore URI
  size: number // 文件大小（字节）
}
export interface DownloaderPlugin {
  download(options: { url: string; fileName: string }): Promise<DownloadResult>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (progress: DownloadProgress) => void
  ): Promise<PluginListenerHandle>
}
