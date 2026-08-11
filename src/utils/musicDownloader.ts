import { OnlineSong } from '@/utils/interface'
import { Downloader, useAppStore } from '@/stores/app'
import { getSongInfoByPath } from '@/utils/audioScanner'

export async function downloadMusic(song: OnlineSong): Promise<{ path: string; size: number }> {
  try {
    const url = song.download_url as string
    const fileName = `${song.name}.${song.ext}`

    // 1. 先监听进度
    const progressListener = await Downloader.addListener('downloadProgress', (data) => {
      const percent = data.progress >= 0 ? data.progress : '未知'
      console.log(`下载了 ${data.loaded} / ${data.total} (${percent}%)`)
      const progressBar = document.getElementById('progress-bar')
      if (progressBar && data.progress >= 0) {
        progressBar.style.width = `${data.progress}%`
      }
    })

    // 2. 发起下载，等待最终结果
    const result = await Downloader.download({ url, fileName })

    // 3. 下载完成，移除监听器
    await progressListener.remove()

    // 4. 处理下载后的文件信息
    const newSong = await getSongInfoByPath(result.path, song)
    if (newSong) {
      const appStore = useAppStore()
      appStore.setAllSongs([newSong, ...appStore.getAllSongs()])
    } else {
      console.warn('无法获取歌曲信息，未添加到本地列表')
    }

    // 5. 返回符合声明的结果
    return {
      path: result.path,
      size: result.size,
    }
  } catch (error: any) {
    console.error('下载失败:', error)
    throw new Error(error.message || '下载失败')
  }
}
/**
 * 并行下载多首歌曲
 * @param songs 包含 download_url 和 name 的歌曲数组
 * @returns 下载结果统计
 */
export async function downloadMultipleSongs(songs: OnlineSong[]) {
  const validSongs = songs.filter((song) => song.download_url && song.download_url_status?.ok)

  const tasks = validSongs.map(async (song) => {
    return await downloadMusic(song)
  })

  const results = await Promise.allSettled(tasks)

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
  const invalidSongsCount = songs.length - validSongs.length

  console.log(`下载完成：成功 ${succeeded} 首，失败 ${failed} 首，无效链接 ${invalidSongsCount} 首`)
  return { succeeded, failed, invalidSongsCount, results }
}
