import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadMusic,
  downloadMultipleSongs,
  getDownloadTaskId,
  isSongDownloading,
  pauseDownloadTask,
  resumeDownloadTask,
  retryDownloadTask,
} from '@/utils/musicDownloader'
import { getSongInfoByPath } from '@/utils/audioScanner'
import { useAppStore } from '@/stores/app'
import type { DownloadTaskSnapshot } from '@/utils/interface'
import { emitNative, mockMethod, resetPlugins } from '../helpers/capacitor'
import { makeOnlineSong, makeSong } from '../helpers/factories'
import { freshPinia } from '../helpers/store'

vi.mock('@/utils/audioScanner', () => ({
  getSongInfoByPath: vi.fn(),
}))

const mockedGetSongInfoByPath = vi.mocked(getSongInfoByPath)

const downloader = (method: string, impl?: any) => mockMethod('Downloader', method, impl)

function seedTask(overrides: Partial<DownloadTaskSnapshot> = {}): DownloadTaskSnapshot {
  const task: DownloadTaskSnapshot = {
    taskId: 'Kuwo:online-1',
    songIdentifier: 'online-1',
    source: 'Kuwo',
    name: 'Online Song',
    singers: 'Online Artist',
    album: 'Online Album',
    ext: 'mp3',
    coverUrl: '',
    fileSizeBytes: 2048,
    duration: 200,
    downloadUrl: 'https://example.com/song.mp3',
    downloadUrlStatus: { ok: true, status_code: 200, reason: [] },
    searchKeyword: null,
    progress: 40,
    loaded: 400,
    total: 2048,
    status: 'paused',
    errorMessage: null,
    localPath: null,
    size: 0,
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...overrides,
  }
  useAppStore().upsertDownloadTask(task)
  return task
}

beforeEach(() => {
  resetPlugins()
  freshPinia()
  mockedGetSongInfoByPath.mockReset()
  mockedGetSongInfoByPath.mockResolvedValue(
    makeSong({ uri: '/music/downloaded.mp3', title: 'Downloaded' })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('downloadMusic', () => {
  it('downloads a song, completes the task and adds it to the library', async () => {
    const start = downloader('startDownload', () => ({ path: '/music/a.mp3', size: 4096 }))
    const song = makeOnlineSong()

    await expect(downloadMusic(song)).resolves.toEqual({ path: '/music/a.mp3', size: 4096 })

    expect(start).toHaveBeenCalledWith({
      taskId: 'Kuwo:online-1',
      url: 'https://example.com/song.mp3',
      fileName: 'Online Song.mp3',
    })

    const store = useAppStore()
    const task = store.getDownloadTasks().find((item) => item.taskId === 'Kuwo:online-1')
    expect(task).toMatchObject({
      status: 'completed',
      progress: 100,
      loaded: 4096,
      total: 4096,
      localPath: '/music/a.mp3',
      size: 4096,
    })
    expect(task?.completedAt).toBeTruthy()

    expect(store.getDownloadHistory()[0]).toMatchObject({
      taskId: 'Kuwo:online-1',
      localPath: '/music/a.mp3',
      size: 4096,
    })
    expect(mockedGetSongInfoByPath).toHaveBeenCalledWith('/music/a.mp3', song)
    expect(store.getAllSongs()[0].uri).toBe('/music/downloaded.mp3')
  })

  it('replaces the queued task snapshot with the new download', async () => {
    downloader('startDownload', () => ({ path: '/music/a.mp3', size: 1 }))
    seedTask({ taskId: 'Kuwo:online-1', status: 'failed' })

    await downloadMusic(makeOnlineSong())

    const tasks = useAppStore().getDownloadTasks()
    expect(tasks.filter((t) => t.taskId === 'Kuwo:online-1')).toHaveLength(1)
    expect(tasks[0].status).toBe('completed')
  })

  it('does not duplicate a song already in the library', async () => {
    downloader('startDownload', () => ({ path: '/music/a.mp3', size: 1 }))
    const existing = makeSong({ uri: '/music/downloaded.mp3' })
    useAppStore().setAllSongs([existing])

    await downloadMusic(makeOnlineSong())

    expect(useAppStore().getAllSongs()).toHaveLength(1)
  })

  it('skips library insertion when metadata cannot be read', async () => {
    downloader('startDownload', () => ({ path: '/music/a.mp3', size: 1 }))
    mockedGetSongInfoByPath.mockResolvedValue(null)

    await downloadMusic(makeOnlineSong())

    expect(useAppStore().getAllSongs()).toEqual([])
  })

  it('rejects a song that is already queued or downloading', async () => {
    seedTask({ status: 'downloading' })
    await expect(downloadMusic(makeOnlineSong())).rejects.toThrow('该歌曲已在下载中')
    seedTask({ status: 'queued' })
    await expect(downloadMusic(makeOnlineSong())).rejects.toThrow('该歌曲已在下载中')
  })

  it('rejects a song without a download URL', async () => {
    await expect(downloadMusic(makeOnlineSong({ download_url: '   ' }))).rejects.toThrow(
      '该歌曲没有可用的下载链接'
    )
    await expect(downloadMusic(makeOnlineSong({ download_url: null as any }))).rejects.toThrow(
      '该歌曲没有可用的下载链接'
    )
  })

  it('rejects an invalid download link status', async () => {
    await expect(
      downloadMusic(
        makeOnlineSong({
          download_url_status: { ok: false, status_code: 403, reason: ['无版权', '试听'] },
        })
      )
    ).rejects.toThrow('无版权, 试听')

    await expect(
      downloadMusic(
        makeOnlineSong({ download_url_status: { ok: false, status_code: 403, reason: [] } })
      )
    ).rejects.toThrow('下载链接无效')
  })

  it('marks the task as failed when the native download rejects', async () => {
    downloader('startDownload', () => Promise.reject(new Error('网络中断')))

    await expect(downloadMusic(makeOnlineSong())).rejects.toThrow('网络中断')

    const task = useAppStore().getDownloadTasks()[0]
    expect(task.status).toBe('failed')
    expect(task.errorMessage).toBe('网络中断')
  })

  it('falls back to a generic failure message', async () => {
    downloader('startDownload', () => Promise.reject({}))
    await expect(downloadMusic(makeOnlineSong())).rejects.toThrow('下载失败')
    expect(useAppStore().getDownloadTasks()[0].errorMessage).toBe('下载失败')
  })

  it('sanitises characters that are invalid in file names', async () => {
    const start = downloader('startDownload', () => ({ path: '/music/a.mp3', size: 1 }))
    await downloadMusic(makeOnlineSong({ name: 'A/B:C*D?' }))

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'A_B_C_D_.mp3' }))
  })

  it('forwards native progress events to the task', async () => {
    downloader('startDownload', () => new Promise(() => {}))
    void downloadMusic(makeOnlineSong())

    // Let downloadMusic get past the listener/upsert awaits before firing.
    await new Promise((resolve) => setTimeout(resolve, 0))
    emitNative('Downloader', 'downloadProgress', {
      taskId: 'Kuwo:online-1',
      loaded: 1024,
      total: 2048,
      progress: 50,
      status: 'downloading',
    })

    const task = useAppStore().getDownloadTasks()[0]
    expect(task).toMatchObject({ loaded: 1024, total: 2048, progress: 50, status: 'downloading' })
  })
})

describe('pauseDownloadTask', () => {
  it('forwards the native status to the store', async () => {
    seedTask({ status: 'downloading' })
    const pause = downloader('pauseDownload', () => ({ status: 'paused' }))

    const result = await pauseDownloadTask('Kuwo:online-1')

    expect(pause).toHaveBeenCalledWith({ taskId: 'Kuwo:online-1' })
    expect(result).toEqual({ status: 'paused' })
    expect(useAppStore().getDownloadTasks()[0].status).toBe('paused')
  })
})

describe('resumeDownloadTask', () => {
  it('resumes from the stored offset and finalises', async () => {
    seedTask({ status: 'paused' })
    const resume = downloader('resumeDownload', () => ({ path: '/music/a.mp3', size: 2048 }))

    const result = await resumeDownloadTask('Kuwo:online-1')

    expect(resume).toHaveBeenCalledWith({
      taskId: 'Kuwo:online-1',
      url: 'https://example.com/song.mp3',
      fileName: 'Online Song.mp3',
      loaded: 400,
    })
    expect(result).toEqual({ path: '/music/a.mp3', size: 2048 })
    expect(useAppStore().getDownloadTasks()[0].status).toBe('completed')
  })

  it('rejects an unknown task', async () => {
    await expect(resumeDownloadTask('missing')).rejects.toThrow('下载任务不存在')
  })

  it('marks the task failed when resuming fails', async () => {
    seedTask({ status: 'paused' })
    downloader('resumeDownload', () => Promise.reject(new Error('断点失效')))

    await expect(resumeDownloadTask('Kuwo:online-1')).rejects.toThrow('断点失效')
    expect(useAppStore().getDownloadTasks()[0].status).toBe('failed')
  })

  it('fails a task whose snapshot has no download URL', async () => {
    seedTask({ taskId: 'Kuwo:no-url', songIdentifier: 'no-url', status: 'paused', downloadUrl: '' })

    await expect(resumeDownloadTask('Kuwo:no-url')).rejects.toThrow(
      '下载任务缺少恢复信息，请重新发起下载'
    )
    expect(useAppStore().getDownloadTasks()[0]).toMatchObject({
      status: 'failed',
      errorMessage: '下载任务缺少恢复信息，请重新发起下载',
    })
  })
})

describe('retryDownloadTask', () => {
  it('removes the old task and starts a fresh download', async () => {
    seedTask({ status: 'failed' })
    downloader('startDownload', () => ({ path: '/music/a.mp3', size: 7 }))

    await retryDownloadTask('Kuwo:online-1')

    const tasks = useAppStore().getDownloadTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].status).toBe('completed')
  })

  it('rejects an unknown task', async () => {
    await expect(retryDownloadTask('missing')).rejects.toThrow('下载任务不存在')
  })
})

describe('downloadMultipleSongs', () => {
  it('reports succeeded, failed and invalid counts', async () => {
    downloader('startDownload', ({ taskId }: { taskId: string }) =>
      taskId.endsWith('bad')
        ? Promise.reject(new Error('boom'))
        : { path: `/music/${taskId}.mp3`, size: 1 }
    )

    const result = await downloadMultipleSongs([
      makeOnlineSong({ identifier: 'good' }),
      makeOnlineSong({ identifier: 'bad' }),
      makeOnlineSong({
        identifier: 'invalid',
        download_url_status: { ok: false, status_code: 0, reason: [] },
      }),
      makeOnlineSong({ identifier: 'empty', download_url: '' }),
    ])

    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.invalidSongsCount).toBe(2)
    expect(result.results).toHaveLength(2)
  })
})

describe('task helpers', () => {
  it('builds a stable task id from source and identifier', () => {
    expect(getDownloadTaskId(makeOnlineSong({ source: 'Kuwo', identifier: 'abc' }))).toBe(
      'Kuwo:abc'
    )
  })

  it('reports active tasks only', () => {
    const store = useAppStore()
    const song = makeOnlineSong()
    expect(isSongDownloading(song)).toBe(false)

    for (const status of ['queued', 'downloading', 'paused'] as const) {
      seedTask({ status })
      expect(isSongDownloading(song)).toBe(true)
    }

    seedTask({ status: 'completed' })
    expect(isSongDownloading(song)).toBe(false)
    expect(store.getDownloadTasks()).toHaveLength(1)
  })
})
