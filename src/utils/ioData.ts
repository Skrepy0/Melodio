import { useAppStore } from '@/stores/app'
import { audio } from '@/utils/createAudio'
import { Capacitor } from '@capacitor/core'

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
      const uri = await audio.saveFile(`${fileName}.json`, jsonStr)
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
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'object') {
        localStorage.setItem(key, JSON.stringify(value))
      } else {
        localStorage.setItem(key, String(value))
      }
    })
    console.log('设置导入成功')
    const appStore = useAppStore()
    appStore.init()
  } catch (error) {
    console.error('导入失败', error)
    throw error
  }
}
