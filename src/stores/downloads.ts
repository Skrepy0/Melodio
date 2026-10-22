import { DownloadHistoryItem, DownloadTaskSnapshot } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDownloadsStore = defineStore('downloads', () => {
  const downloadTasks = ref<DownloadTaskSnapshot[]>([])

  const downloadHistory = ref<DownloadHistoryItem[]>([])

  function saveDownloadTasks() {
    localStorage.setItem('downloadTasks', JSON.stringify(downloadTasks.value))
  }

  function saveDownloadHistory() {
    localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory.value))
  }

  function getDownloadTasks() {
    return downloadTasks.value
  }

  function getActiveDownloadTasks() {
    return downloadTasks.value.filter((task) => task.status !== 'completed')
  }

  function getDownloadHistory() {
    return downloadHistory.value
  }

  function upsertDownloadTask(task: DownloadTaskSnapshot) {
    const index = downloadTasks.value.findIndex((item) => item.taskId === task.taskId)
    if (index >= 0) {
      downloadTasks.value[index] = task
    } else {
      downloadTasks.value.unshift(task)
    }
    saveDownloadTasks()
  }

  function setDownloadTaskProgress(options: {
    taskId: string
    loaded: number
    total: number
    progress: number
    status?: DownloadTaskSnapshot['status']
  }) {
    const task = downloadTasks.value.find((item) => item.taskId === options.taskId)
    if (!task) return
    task.loaded = options.loaded
    task.total = options.total
    task.progress = options.progress
    if (options.status) task.status = options.status
    task.updatedAt = Date.now()
    saveDownloadTasks()
  }

  function setDownloadTaskStatus(
    taskId: string,
    status: DownloadTaskSnapshot['status'],
    extras: Partial<DownloadTaskSnapshot> = {}
  ) {
    const task = downloadTasks.value.find((item) => item.taskId === taskId)
    if (!task) return
    Object.assign(task, extras)
    task.status = status
    task.updatedAt = Date.now()
    if (status === 'completed' && !task.completedAt) {
      task.completedAt = task.updatedAt
    }
    saveDownloadTasks()
  }

  function removeDownloadTask(taskId: string) {
    downloadTasks.value = downloadTasks.value.filter((item) => item.taskId !== taskId)
    saveDownloadTasks()
  }

  function appendDownloadHistory(item: DownloadHistoryItem) {
    const nextHistory = downloadHistory.value.filter((history) => history.taskId !== item.taskId)
    nextHistory.unshift(item)
    downloadHistory.value = nextHistory
    saveDownloadHistory()
  }

  function clearDownloadHistory() {
    downloadHistory.value = []
    saveDownloadHistory()
  }

  function normalizeDownloadTask(task: Partial<DownloadTaskSnapshot>): DownloadTaskSnapshot {
    const status =
      task.status === 'completed' ? 'completed' : task.status === 'failed' ? 'failed' : 'paused'
    const now = Date.now()

    return {
      taskId: task.taskId || '',
      songIdentifier: task.songIdentifier || '',
      source: task.source || '',
      name: task.name || '',
      singers: task.singers || '',
      album: task.album || '',
      ext: task.ext || '',
      coverUrl: task.coverUrl ?? null,
      fileSizeBytes: Number(task.fileSizeBytes) || 0,
      duration: Number(task.duration) || 0,
      downloadUrl: task.downloadUrl ?? null,
      downloadUrlStatus: task.downloadUrlStatus ?? null,
      searchKeyword: task.searchKeyword ?? null,
      progress: Number(task.progress) || 0,
      loaded: Number(task.loaded) || 0,
      total: typeof task.total === 'number' ? task.total : -1,
      status,
      errorMessage: status === 'completed' ? (task.errorMessage ?? null) : null,
      localPath: task.localPath ?? null,
      size: Number(task.size) || 0,
      createdAt: Number(task.createdAt) || now,
      updatedAt: Number(task.updatedAt) || now,
      completedAt: status === 'completed' ? (task.completedAt ?? task.updatedAt ?? now) : null,
    }
  }

  function initDownloadTasks() {
    const obj = localStorage.getItem('downloadTasks')
    if (obj) {
      try {
        const parsed = JSON.parse(obj)
        const rawTasks: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.data)
            ? parsed.data
            : []
        downloadTasks.value = rawTasks
          .map((task: unknown) => normalizeDownloadTask(task as Partial<DownloadTaskSnapshot>))
          .filter((task: DownloadTaskSnapshot) => task.taskId)
        saveDownloadTasks()
      } catch (e) {
        console.error(e)
      }
    }
  }

  function initDownloadHistory() {
    const obj = localStorage.getItem('downloadHistory')
    if (obj) {
      try {
        const parsed = JSON.parse(obj)
        if (Array.isArray(parsed)) downloadHistory.value = parsed
        else if (Array.isArray(parsed.data)) downloadHistory.value = parsed.data
      } catch (e) {
        console.error(e)
      }
    }
  }
  return {
    downloadTasks,
    downloadHistory,
    saveDownloadTasks,
    saveDownloadHistory,
    getDownloadTasks,
    getActiveDownloadTasks,
    getDownloadHistory,
    upsertDownloadTask,
    setDownloadTaskProgress,
    setDownloadTaskStatus,
    removeDownloadTask,
    appendDownloadHistory,
    clearDownloadHistory,
    normalizeDownloadTask,
    initDownloadTasks,
    initDownloadHistory,
  }
})
