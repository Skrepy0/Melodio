import { DownloadTaskActionResult, DownloadTaskResult } from '@/utils/interface'
import { PluginListenerHandle } from '@capacitor/core'

export interface DownloadProgress {
  taskId: string
  loaded: number // 已下载字节数
  total: number // 总字节数（可能为 -1）
  progress: number // 百分比 0-100，若 total 为 -1 则返回 -1
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed'
}

export interface DownloaderPlugin {
  startDownload(options: {
    taskId: string
    url: string
    fileName: string
  }): Promise<DownloadTaskResult>
  pauseDownload(options: { taskId: string }): Promise<DownloadTaskActionResult>
  resumeDownload(options: {
    taskId: string
    url: string
    fileName: string
    loaded?: number
  }): Promise<DownloadTaskResult>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (progress: DownloadProgress) => void
  ): Promise<PluginListenerHandle>
}
