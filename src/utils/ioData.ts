import { useAppStore } from '@/stores/app'
import { audio } from '@/utils/createAudio'
import { Capacitor } from '@capacitor/core'

function isSongRecord(value: any): boolean {
  return (
    value &&
    typeof value === 'object' &&
    ['id', 'uri', 'title'].every((key) => typeof value[key] === 'string') &&
    ['artist', 'album', 'albumArtUri'].every(
      (key) => value[key] == null || typeof value[key] === 'string'
    )
  )
}

/**
 * 将 localStorage 中的指定键值导出为 JSON 文件
 */
export async function exportLocalStorage(keys?: string[], fileName = 'melodio_backup') {
  const data: Record<string, any> = {}
  const targetKeys = keys || Object.keys(localStorage)
  targetKeys.forEach((key) => {
    try {
      data[key] = JSON.parse(localStorage.getItem(key)!)
    } catch {
      data[key] = localStorage.getItem(key)
    }
  })

  const jsonStr = JSON.stringify(data, null, 2)

  if (Capacitor.isNativePlatform()) {
    try {
      const baseName = fileName || 'melodio_backup'
      const counterKey = `exportCounter_${baseName}`
      let counter = 1
      const saved = localStorage.getItem(counterKey)
      if (saved) {
        counter = parseInt(saved, 10) + 1
      }
      localStorage.setItem(counterKey, counter.toString())
      const uniqueFileName = `${baseName}_${counter}.json`

      const uri = await audio.saveFile(uniqueFileName, jsonStr)
      console.log('文件已保存到：', uri)
      return uri
    } catch (error) {
      console.error('保存失败', error)
      throw error
    }
  }
}
/**
 * 从文件导入 localStorage 备份
 */
export async function importLocalStorage(): Promise<void> {
  try {
    const jsonStr: string = await audio.openFile()
    const data = JSON.parse(jsonStr)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid backup: expected an object')
    }
    // Validate every known structured value before changing any stored data.
    const arrayKeys = new Set([
      'allSongs',
      'blacklist',
      'playQueue',
      'songLists',
      'searchHistory',
      'downloadTasks',
      'downloadHistory',
    ])
    const entries = Object.entries(data).map(([key, value]) => {
      let decoded = value
      if (arrayKeys.has(key) || ['likeList', 'playData', 'music_client_status'].includes(key)) {
        if (typeof decoded === 'string') {
          try {
            decoded = JSON.parse(decoded)
          } catch {
            throw new Error(`Invalid backup field: ${key}`)
          }
        }
        const list = Array.isArray(decoded) ? decoded : (decoded as any)?.data
        if (arrayKeys.has(key)) {
          if (
            !Array.isArray(list) ||
            (key === 'searchHistory'
              ? !list.every((item) => typeof item === 'string')
              : !list.every((item) => item && typeof item === 'object' && !Array.isArray(item)))
          ) {
            throw new Error(`Invalid backup field: ${key}`)
          }
          if (['allSongs', 'blacklist', 'playQueue'].includes(key) && !list.every(isSongRecord)) {
            throw new Error(`Invalid backup field: ${key}`)
          }
          if (
            key === 'songLists' &&
            (!list.every(
              (item) =>
                Number.isInteger(item.id) &&
                item.id > 0 &&
                typeof item.name === 'string' &&
                Array.isArray(item.data) &&
                item.data.every(isSongRecord)
            ) ||
              new Set(list.map((item) => item.id)).size !== list.length)
          ) {
            throw new Error(`Invalid backup field: ${key}`)
          }
          if (
            ['downloadTasks', 'downloadHistory'].includes(key) &&
            !list.every((item) => typeof item.taskId === 'string' && item.taskId)
          ) {
            throw new Error(`Invalid backup field: ${key}`)
          }
        } else if (
          !decoded ||
          typeof decoded !== 'object' ||
          Array.isArray(decoded) ||
          (key === 'likeList' &&
            (!Array.isArray((decoded as any).data) || !(decoded as any).data.every(isSongRecord)))
        ) {
          throw new Error(`Invalid backup field: ${key}`)
        }
      }
      if (
        key === 'music_client_status' &&
        !Object.values(decoded as object).every((value) => typeof value === 'boolean')
      ) {
        throw new Error(`Invalid backup field: ${key}`)
      }
      if (key === 'playData') {
        const state = decoded as Record<string, unknown>
        if (
          (state.currentIndex !== undefined &&
            (!Number.isInteger(state.currentIndex) || Number(state.currentIndex) < 0)) ||
          (state.mockCurrentTime !== undefined &&
            (typeof state.mockCurrentTime !== 'number' ||
              !Number.isFinite(state.mockCurrentTime) ||
              state.mockCurrentTime < 0))
        ) {
          throw new Error(`Invalid backup field: ${key}`)
        }
      }
      const encoded = typeof decoded === 'object' ? JSON.stringify(decoded) : String(decoded)
      return [key, encoded] as const
    })
    const previous = new Map(entries.map(([key]) => [key, localStorage.getItem(key)]))
    const written: string[] = []
    try {
      for (const [key, value] of entries) {
        localStorage.setItem(key, value)
        written.push(key)
      }
    } catch (error) {
      for (const key of written.reverse()) {
        const original = previous.get(key)!
        if (original === null) localStorage.removeItem(key)
        else localStorage.setItem(key, original)
      }
      throw error
    }
    useAppStore().prepareForBackupReload()
    console.log('设置导入成功')
  } catch (error) {
    console.error('导入失败', error)
    throw error
  }
}
