import { DownloadHistoryItem, DownloadTaskSnapshot, OnlineSong } from '@/utils/interface'
import { Downloader, useAppStore } from '@/stores/app'
import { getSongInfoByPath } from '@/utils/audioScanner'

let progressListenerPromise: Promise<void> | null = null
const downloadSources = new Map<string, OnlineSong>()

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'unknown'
}

function sanitizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function createTaskId(song: OnlineSong) {
  return `${song.source}:${song.identifier}`
}

function createDownloadSnapshot(song: OnlineSong, taskId: string): DownloadTaskSnapshot {
  const now = Date.now()
  return {
    taskId,
    songIdentifier: song.identifier,
    source: song.source,
    name: song.name,
    singers: song.singers,
    album: song.album,
    ext: song.ext,
    coverUrl: song.cover_url,
    fileSizeBytes: song.file_size_bytes,
    duration: song.duration,
    downloadUrl: song.download_url,
    downloadUrlStatus: song.download_url_status,
    progress: 0,
    loaded: 0,
    total: song.file_size_bytes > 0 ? song.file_size_bytes : -1,
    status: 'queued',
    errorMessage: null,
    localPath: null,
    size: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

function getSongFromTaskSnapshot(task: DownloadTaskSnapshot): OnlineSong | null {
  const downloadUrl = sanitizeText(task.downloadUrl)
  if (!downloadUrl) return null

  return {
    source: sanitizeText(task.source),
    name: sanitizeText(task.name),
    singers: sanitizeText(task.singers),
    album: sanitizeText(task.album),
    ext: sanitizeText(task.ext),
    file_size_bytes: Number(task.fileSizeBytes) || 0,
    duration: Number(task.duration) || 0,
    lyric: null,
    cover_url: task.coverUrl,
    download_url: downloadUrl,
    download_url_status: task.downloadUrlStatus || {
      ok: true,
      status_code: 200,
      reason: [],
    },
    identifier: sanitizeText(task.songIdentifier),
  }
}

function getSongForTask(taskId: string): OnlineSong {
  const cachedSong = downloadSources.get(taskId)
  if (cachedSong) return cachedSong

  const appStore = useAppStore()
  const task = appStore.getDownloadTasks().find((item) => item.taskId === taskId)
  if (!task) {
    throw new Error('下载任务不存在')
  }

  const song = getSongFromTaskSnapshot(task)
  if (!song) {
    appStore.setDownloadTaskStatus(taskId, 'failed', {
      errorMessage: '下载任务缺少恢复信息，请重新发起下载',
    })
    throw new Error('下载任务缺少恢复信息，请重新发起下载')
  }

  downloadSources.set(taskId, song)
  return song
}

async function ensureDownloadProgressListener() {
  if (progressListenerPromise) return progressListenerPromise

  progressListenerPromise = Downloader.addListener('downloadProgress', (data) => {
    const appStore = useAppStore()
    appStore.setDownloadTaskProgress({
      taskId: data.taskId,
      loaded: data.loaded,
      total: data.total,
      progress: data.progress,
      status: data.status,
    })
  }).then(() => undefined)

  return progressListenerPromise
}

function buildHistoryItem(task: DownloadTaskSnapshot): DownloadHistoryItem | null {
  if (!task.localPath || !task.completedAt) return null
  return {
    taskId: task.taskId,
    songIdentifier: task.songIdentifier,
    name: task.name,
    singers: task.singers,
    album: task.album,
    ext: task.ext,
    coverUrl: task.coverUrl,
    localPath: task.localPath,
    size: task.size,
    completedAt: task.completedAt,
  }
}

async function addDownloadedSongToLibrary(song: OnlineSong, path: string) {
  const appStore = useAppStore()
  const newSong = await getSongInfoByPath(path, song)
  if (!newSong) {
    console.warn('无法获取歌曲信息，未添加到本地列表')
    return
  }

  const allSongs = appStore.getAllSongs()
  const exists = allSongs.some((item) => item.uri === newSong.uri)
  if (exists) return

  appStore.setAllSongs([newSong, ...allSongs])
}

async function finalizeDownload(
  taskId: string,
  song: OnlineSong,
  result: { path: string; size: number }
) {
  const appStore = useAppStore()

  appStore.setDownloadTaskStatus(taskId, 'completed', {
    localPath: result.path,
    size: result.size,
    progress: 100,
    loaded: result.size,
    total: result.size,
    errorMessage: null,
  })

  const completedTask = appStore.getDownloadTasks().find((item) => item.taskId === taskId)
  if (completedTask) {
    const historyItem = buildHistoryItem(completedTask)
    if (historyItem) appStore.appendDownloadHistory(historyItem)
  }

  await addDownloadedSongToLibrary(song, result.path)
}

export function getDownloadTaskId(song: OnlineSong) {
  return createTaskId(song)
}

export function isSongDownloading(song: OnlineSong) {
  const appStore = useAppStore()
  const taskId = createTaskId(song)
  const task = appStore.getDownloadTasks().find((item) => item.taskId === taskId)
  return task ? ['queued', 'downloading', 'paused'].includes(task.status) : false
}

export async function downloadMusic(song: OnlineSong): Promise<{ path: string; size: number }> {
  const appStore = useAppStore()
  const taskId = createTaskId(song)
  const existingTask = appStore.getDownloadTasks().find((item) => item.taskId === taskId)

  if (existingTask && ['queued', 'downloading'].includes(existingTask.status)) {
    throw new Error('该歌曲已在下载中')
  }

  const url = song.download_url?.trim()
  if (!url) {
    throw new Error('该歌曲没有可用的下载链接')
  }

  if (song.download_url_status && !song.download_url_status.ok) {
    throw new Error(song.download_url_status.reason?.join(', ') || '下载链接无效')
  }

  await ensureDownloadProgressListener()

  const snapshot = existingTask
    ? {
        ...existingTask,
        ...createDownloadSnapshot(song, taskId),
        loaded: existingTask.loaded,
        total: existingTask.total,
        progress: existingTask.progress,
        localPath: existingTask.localPath,
        size: existingTask.size,
        createdAt: existingTask.createdAt,
        completedAt: existingTask.completedAt,
        errorMessage: null,
        status: 'queued' as const,
        updatedAt: Date.now(),
      }
    : createDownloadSnapshot(song, taskId)

  appStore.upsertDownloadTask(snapshot)
  appStore.setDownloadTaskStatus(taskId, 'downloading', { errorMessage: null })
  downloadSources.set(taskId, song)

  try {
    const fileName = sanitizeFileName(`${song.name}.${song.ext}`)
    const result = await Downloader.startDownload({ taskId, url, fileName })
    await finalizeDownload(taskId, song, result)

    return {
      path: result.path,
      size: result.size,
    }
  } catch (error: any) {
    appStore.setDownloadTaskStatus(taskId, 'failed', {
      errorMessage: error?.message || '下载失败',
    })
    console.error('下载失败:', error)
    throw new Error(error?.message || '下载失败')
  }
}

export async function pauseDownloadTask(taskId: string) {
  const appStore = useAppStore()
  const result = await Downloader.pauseDownload({ taskId })
  appStore.setDownloadTaskStatus(taskId, result.status)
  return result
}

export async function resumeDownloadTask(taskId: string) {
  const appStore = useAppStore()
  const task = appStore.getDownloadTasks().find((item) => item.taskId === taskId)
  if (!task) throw new Error('下载任务不存在')

  const song = getSongForTask(taskId)
  const fileName = sanitizeFileName(`${song.name}.${song.ext}`)

  await ensureDownloadProgressListener()
  appStore.setDownloadTaskStatus(taskId, 'downloading', { errorMessage: null })

  try {
    const result = await Downloader.resumeDownload({
      taskId,
      url: song.download_url || '',
      fileName,
      loaded: task.loaded,
    })
    await finalizeDownload(taskId, song, result)
    return result
  } catch (error: any) {
    appStore.setDownloadTaskStatus(taskId, 'failed', {
      errorMessage: error?.message || '下载失败',
    })
    throw new Error(error?.message || '下载失败')
  }
}

export async function retryDownloadTask(taskId: string) {
  const appStore = useAppStore()
  const task = appStore.getDownloadTasks().find((item) => item.taskId === taskId)
  if (!task) throw new Error('下载任务不存在')

  const song = getSongForTask(taskId)
  appStore.removeDownloadTask(taskId)
  return await downloadMusic(song)
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
