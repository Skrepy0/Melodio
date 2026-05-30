import { Filesystem } from '@capacitor/filesystem'
import { Song } from './interface'

export const getAccessibleUrl = (path: string): string => {
  if (path.startsWith('file://')) {
    return encodeURI(path)
  }

  if (path.startsWith('https://localhost/_capacitor_file_/')) {
    const filePath = path.slice('https://localhost/_capacitor_file_'.length) // /storage/emulated/0/...
    return encodeURI('file://' + filePath)
  }

  if (path.startsWith('/')) {
    return encodeURI('file://' + path)
  }
  return encodeURI(path)
}
export async function getCoverBase64(uri: string): Promise<string> {
  try {
    const result = await Filesystem.readFile({ path: uri })
    return `data:image/jpeg;base64,${result.data}`
  } catch (error) {
    console.error('读取封面失败:', error)
    return ''
  }
}
export const isInList = (id: string, queue: Song[]) => queue.some((song) => song.id === id)
