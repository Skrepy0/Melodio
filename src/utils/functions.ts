import { Filesystem } from '@capacitor/filesystem'
export async function getCoverBase64(uri: string): Promise<string> {
  try {
    const result = await Filesystem.readFile({ path: uri })
    return `data:image/jpeg;base64,${result.data}`
  } catch (error) {
    console.error('读取封面失败:', error)
    return ''
  }
}
