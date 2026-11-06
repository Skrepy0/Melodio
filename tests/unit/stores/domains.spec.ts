import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useSearchStore } from '@/stores/search'
import { useDownloadsStore } from '@/stores/downloads'
import { useMusicClientStore } from '@/stores/musicClient'
import { useSettingsStore } from '@/stores/settings'
import { usePlayerStore } from '@/stores/player'
import { useThemeStore } from '@/stores/theme'
import { clearStorage, freshPinia } from '../helpers/store'
import { mockMethod } from '../helpers/capacitor'
import { makeSongs, makeSong } from '../helpers/factories'

describe('domain stores and compatibility facade', () => {
  beforeEach(() => {
    clearStorage()
    freshPinia()
  })

  it('uses search, downloads and client settings without creating the facade', () => {
    const search = useSearchStore()
    search.pushSearchHistory(' song ')
    expect(search.searchHistory).toEqual(['song'])
    expect(JSON.parse(localStorage.getItem('searchHistory')!)).toEqual(['song'])
    const downloads = useDownloadsStore()
    downloads.clearDownloadHistory()
    expect(downloads.downloadHistory).toEqual([])
    const clients = useMusicClientStore()
    clients.initMusicClientStatus()
    clients.setMusicClientLimitation(8)
    expect(clients.getMusicClientLimitation()).toBe(8)
    expect(localStorage.getItem('music_client_limitation')).toBe('8')
  })

  it('survives damaged startup storage', () => {
    localStorage.setItem('searchHistory', 'not-json')
    expect(useSearchStore().searchHistory).toEqual([])
    const player = usePlayerStore()
    for (const key of ['allSongs', 'blacklist']) localStorage.setItem(key, 'not-json')
    expect(() => {
      player.initAllSongs()
      player.initBlacklist()
    }).not.toThrow()
    expect(player.allSongs).toEqual([])
    expect(player.blacklist).toEqual([])
  })

  it('submits large queues without waiting for artwork and bounds native lookups', async () => {
    const player = usePlayerStore()
    await player.setCanFetchCoverFromWeb(false)
    const pending = new Map<string, (value: { path: string }) => void>()
    const embedded = mockMethod(
      'NativeAudio',
      'getEmbeddedCover',
      (options: { uri: string; key: string }) =>
        new Promise<{ path: string }>((resolve) => pending.set(options.key, resolve))
    )
    const queue = makeSongs(1000)
    const playlist = await player.buildNativePlaylist(queue)
    expect(playlist).toHaveLength(1000)
    expect(embedded).not.toHaveBeenCalled()
    player.setPlayQueue(queue)
    await vi.waitFor(() => expect(embedded).toHaveBeenCalledTimes(6))
    expect(embedded.mock.calls[0][0].key).toBe(queue[0].id)
    for (const resolve of pending.values()) resolve({ path: '' })
    player.$dispose()
  })

  it('coalesces progress checkpoints and flushes terminal and page-hide states', () => {
    vi.useFakeTimers()
    const store = useDownloadsStore()
    store.upsertDownloadTask(store.normalizeDownloadTask({ taskId: 'a' }))
    const write = vi.spyOn(Storage.prototype, 'setItem')
    try {
      for (let i = 1; i <= 20; i++)
        store.setDownloadTaskProgress({
          taskId: 'a',
          loaded: i,
          total: 100,
          progress: i,
          status: 'downloading',
        })
      expect(write).not.toHaveBeenCalled()
      expect(store.getDownloadTasks()[0].loaded).toBe(20)
      vi.advanceTimersByTime(1000)
      expect(write).toHaveBeenCalledTimes(1)
      expect(JSON.parse(localStorage.getItem('downloadTasks')!)[0].loaded).toBe(20)
      store.setDownloadTaskProgress({ taskId: 'a', loaded: 30, total: 100, progress: 30 })
      window.dispatchEvent(new Event('pagehide'))
      expect(JSON.parse(localStorage.getItem('downloadTasks')!)[0].loaded).toBe(30)
      store.setDownloadTaskProgress({ taskId: 'a', loaded: 40, total: 100, progress: 40 })
      store.setDownloadTaskStatus('a', 'paused')
      expect(JSON.parse(localStorage.getItem('downloadTasks')!)[0]).toMatchObject({
        loaded: 40,
        status: 'paused',
      })
      const writes = write.mock.calls.length
      vi.advanceTimersByTime(2000)
      expect(write).toHaveBeenCalledTimes(writes)
    } finally {
      store.$dispose()
      write.mockRestore()
      vi.useRealTimers()
    }
  })

  it('preserves ref identity and assignments in both directions', () => {
    const app = useAppStore()
    const search = useSearchStore()
    const player = usePlayerStore()
    const theme = useThemeStore()
    const downloads = useDownloadsStore()
    expect(storeToRefs(app).playQueue.value).toBe(storeToRefs(player).playQueue.value)
    app.searchKeyword = 'hello'
    expect(search.searchKeyword).toBe('hello')
    search.searchResults = []
    expect(app.searchResults).toBe(search.searchResults)
    player.setPlayQueue([makeSong()])
    expect(app.playQueue).toBe(player.playQueue)
    app.darkMode = true
    expect(theme.darkMode).toBe(true)
    downloads.downloadHistory = []
    expect(app.downloadHistory).toBe(downloads.downloadHistory)
    app.setShowLyrics(false)
    expect(useSettingsStore().showLyrics).toBe(false)
    useSettingsStore().setFetchTimeOut(15)
    expect(app.getFetchTimeOut()).toBe(15)
  })
})
