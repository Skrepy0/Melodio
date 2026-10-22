import { beforeEach, describe, expect, it } from 'vitest'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useSearchStore } from '@/stores/search'
import { useDownloadsStore } from '@/stores/downloads'
import { useMusicClientStore } from '@/stores/musicClient'
import { useSettingsStore } from '@/stores/settings'
import { usePlayerStore } from '@/stores/player'
import { useThemeStore } from '@/stores/theme'
import { clearStorage, freshPinia } from '../helpers/store'
import { makeSong } from '../helpers/factories'

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
