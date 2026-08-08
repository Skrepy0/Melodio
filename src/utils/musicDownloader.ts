import { OnlineSong } from '@/utils/interface'
import { MusicSigner, useAppStore } from '@/stores/app'
import { getSongInfoByPath } from '@/utils/audioScanner'

export async function downloadMusic(song: OnlineSong): Promise<{ path: string; size: number }> {
  try {
    const url: string = song.download_url as string
    const fileName: string = song.name + '.' + song.ext

    const result = await MusicSigner.download({ url, fileName })
    const new_song = await getSongInfoByPath(result.path, song)
    if (new_song) {
      const appStore = useAppStore()
      appStore.setAllSongs([new_song, ...appStore.getAllSongs()])
    } else {
      console.error('获取歌曲信息失败，无法添加到本地列表')
    }

    return result
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
