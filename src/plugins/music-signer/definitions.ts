import { OnlineSong } from '@/utils/interface'
import { PluginListenerHandle } from '@capacitor/core'

export interface PartialResult {
  source: string
  items: OnlineSong[]
}

export interface SearchResult {
  status: 'done'
}
export interface MusicSignerPlugin {
  search(options: {
    keyword: string
    clients: string[]
    limit: number
    eachSongTimeOut: number
    totalTimeOut?: number
  }): Promise<{ items: OnlineSong[]; total: number }>
  download(options: { url: string; fileName: string }): Promise<{ path: string; size: number }>
  /**
   * 添加事件监听器。
   * @param eventName - 事件名称，支持 'searchPartial' 和 'searchDone'
   * @param listener - 回调函数
   */
  addListener(
    eventName: 'searchPartial',
    listener: (data: PartialResult) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  addListener(
    eventName: 'searchDone',
    listener: () => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle

  /**
   * 移除所有监听器（通常由框架自动处理）。
   */
  removeAllListeners(): Promise<void>
}
