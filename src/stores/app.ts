import {
  ClientKey,
  DownloadHistoryItem,
  DownloadTaskSnapshot,
  MusicClientStatus,
  OnlineSong,
  Playlist,
  PlayMode,
  Song,
} from '@/utils/interface'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { audio, getEmbeddedCover } from '@/utils/createAudio'
import {
  fetchCoverFromWeb,
  getAccessibleUrl,
  getCachedCover,
  getCoverSrc,
  getNativeCoverUrl,
  parseSearchError,
} from '@/utils/functions'
import { lookupCoverUrl } from '@/utils/coverCache'
import toast from '@/utils/createToast'
import { i18n } from '@/i18n'
import { registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import type { SystemBarPlugin } from '@/plugins/system-bar/definitions'
import { getContrastText, hexToRgb, mixColors } from '@/utils/color'
import { musicClients } from '@/config'
import { MusicSignerPlugin } from '@/plugins/music-signer/definitions'
import { requestMediaPermissions } from '@/utils/permission'
import { DownloaderPlugin } from '@/plugins/downloader/definitions'
import { runCoverMigration } from '@/utils/coverMigration'
import { Directory, Filesystem } from '@capacitor/filesystem'

const SystemBar = registerPlugin<SystemBarPlugin>('SystemBar')
export const MusicSigner = registerPlugin<MusicSignerPlugin>('MusicSigner')
export const Downloader = registerPlugin<DownloaderPlugin>('Downloader')
const SUPPORTED_LOCALES = ['zh-CN', 'en-US']

/** How the wallpaper is fitted to the viewport. */
export type WallpaperFit = 'cover' | 'contain' | 'stretch'
/**
 * The wallpaper lives at a fixed filename under `Directory.Data`; the renderable
 * URL is resolved at runtime via `Filesystem.getUri` + `getCoverSrc`. Data URLs
 * and remote URLs are no longer accepted — they end up in a CSS `url()` and in
 * localStorage.
 */
const WALLPAPER_FILENAME_RE = /^wallpaper\.jpg$/i
const isWallpaperFilename = (value: string) => WALLPAPER_FILENAME_RE.test(value)
const wallpaperFilename = ref<string>('')
const clampNumber = (raw: string | null, min: number, max: number, fallback: number) => {
  const value = Number(raw)
  if (raw === null || raw === '' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
function getSystemLanguage(): string {
  const browserLang = navigator.language
  if (SUPPORTED_LOCALES.includes(browserLang)) return browserLang
  const prefix = browserLang.split('-')[0]
  if (prefix === 'zh') return 'zh-CN'
  return 'en-US'
}
export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') === 'true')
  const pinyinSearch = ref(localStorage.getItem('pinyinSearch') === 'true')
  const playQueueRepeat = ref(true)
  const autoPauseOnDisconnect = ref(true)
  const autoPlayOnConnect = ref(false)
  const autoDelInvalidSongs = ref(true)
  const currentLanguage = ref('zh-CN')
  const isI18nReady = ref(false)
  const canFetchCoverFromWeb = ref(true)
  const audioFocusPause = ref(true)
  const blacklist = ref<Song[]>([])
  const firstPlayFlag = ref(false)
  // Matches the default accent in theme.scss: a muted cobalt that reads as
  // part of the neutral shell rather than as a system-blue leftover.
  const themeColor = ref<string>('#3d63dd')
  // Wallpaper: the image itself, plus how much of it the interface lets
  // through, how soft it is, and how it is fitted to the viewport.
  const wallpaper = ref<string>('')
  const wallpaperTransparency = ref(25)
  const wallpaperBlur = ref(0)
  const wallpaperFit = ref<WallpaperFit>('cover')
  const musicClientStatus = ref<MusicClientStatus>()
  const musicClientLimitation = ref<number>(5)
  const fetchTimeOut = ref<number>(30)
  const eachSongAveTimeOut = ref<number>(10)
  // 搜索
  const searchKeyword = ref<string>('')
  const searchResults = ref<OnlineSong[]>([])
  const searchHistory = ref<string[]>(JSON.parse(localStorage.getItem('searchHistory') || '[]'))
  const isLoading = ref(false)
  const searchError = ref<string | null>(null)
  const hasSearched = ref(false)

  let partialListener: any = null
  let doneListener: any = null
  let searchPromise: Promise<any> | null = null

  const addUniqueSongs = (newSongs: OnlineSong[]) => {
    const existingIds = new Set(searchResults.value.map((s) => s.identifier))
    const toAdd = newSongs.filter((s) => !existingIds.has(s.identifier))
    if (toAdd.length) {
      searchResults.value = [...searchResults.value, ...toAdd]
    }
  }

  const pushSearchHistory = (keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) return
    const next = [normalized, ...searchHistory.value.filter((item) => item !== normalized)].slice(
      0,
      20
    )
    searchHistory.value = next
    localStorage.setItem('searchHistory', JSON.stringify(next))
  }

  const removeSearchHistoryItem = (keyword: string) => {
    const next = searchHistory.value.filter((item) => item !== keyword)
    searchHistory.value = next
    localStorage.setItem('searchHistory', JSON.stringify(next))
  }

  const clearSearchHistory = () => {
    searchHistory.value = []
    localStorage.setItem('searchHistory', JSON.stringify([]))
  }

  const cleanupSearch = () => {
    if (partialListener) {
      partialListener.remove()
      partialListener = null
    }
    if (doneListener) {
      doneListener.remove()
      doneListener = null
    }
    searchPromise = null
  }

  const search = async (
    keyword: string,
    clients: string[],
    limit: number,
    eachSongTimeOut: number,
    totalTimeOut: number,
    t: any
  ) => {
    // 如果已有搜索进行中，先取消
    cleanupSearch()

    // 重置状态
    searchResults.value = []
    searchError.value = null
    isLoading.value = true
    hasSearched.value = true
    pushSearchHistory(keyword)

    try {
      partialListener = await MusicSigner.addListener('searchPartial', (data: any) => {
        const newSongs = data.items || []
        addUniqueSongs(newSongs)
      })
      doneListener = await MusicSigner.addListener('searchDone', () => {
        // 完成搜索
      })

      searchPromise = MusicSigner.search({
        keyword,
        clients,
        limit,
        eachSongTimeOut,
        totalTimeOut,
      })
      await searchPromise
    } catch (e: any) {
      const parsedError = parseSearchError(e)
      const errorMsg = e?.message || String(e)

      if (parsedError.code === -1) {
        if (errorMsg.includes('Missing keyword')) {
          searchError.value = t('search.error.no_keyword')
        } else if (errorMsg.includes('stream was reset: CANCEL')) {
          // ignore 请求被正常取消
        } else {
          searchError.value = t('search.error.network.no_network') + `\n${e.toString()}`
        }
      } else if (
        parsedError.body &&
        typeof parsedError.body === 'object' &&
        parsedError.body.code === 1001
      ) {
        const clientName = parsedError.body.msg?.split(': ')?.[1] || ''
        searchError.value = t('search.error.backend.music_client', { music_client: clientName })
      } else if (
        errorMsg.includes('Invalid signature') ||
        parsedError.body?.detail === 'Invalid signature'
      ) {
        searchError.value = t('search.error.backend.sign') + `\n${e.toString()}`
      } else if (parsedError.code >= 500 && parsedError.code < 600) {
        searchError.value = t('search.error.backend.server') + `\n${e.toString()}`
      } else if (parsedError.code >= 400 && parsedError.code < 500) {
        const isTimeout =
          errorMsg.includes('timeout') || errorMsg.includes('Timeout') || e?.code === 'ECONNABORTED'
        searchError.value = isTimeout
          ? t('search.error.network.timeout')
          : t('search.error.client') + `\n${e.toString()}`
      } else {
        searchError.value = t('search.error.unknown') + `\n${e.toString()}`
      }
      console.error(e)
      searchResults.value = []
    } finally {
      isLoading.value = false
      cleanupSearch()
    }
  }
  const resetSearch = () => {
    searchError.value = null
    isLoading.value = false
    hasSearched.value = false
    cleanupSearch()
  }

  function initEachSongAveTimeOut() {
    const stored = localStorage.getItem('eachSongAveTimeOut')
    eachSongAveTimeOut.value = stored ? parseInt(stored) : 10
  }
  function getEachSongAveTimeOut() {
    return eachSongAveTimeOut.value
  }
  function setEachSongAveTimeOut(value: number) {
    eachSongAveTimeOut.value = value
    localStorage.setItem('eachSongAveTimeOut', value.toString())
  }
  function initFetchTimeOut() {
    const stored = localStorage.getItem('fetchTimeOut')
    fetchTimeOut.value = stored ? parseInt(stored) : 30
  }
  function getFetchTimeOut() {
    return fetchTimeOut.value
  }
  function setFetchTimeOut(value: number) {
    fetchTimeOut.value = value
    localStorage.setItem('fetchTimeOut', value.toString())
  }
  function initMusicClientLimitation() {
    const stored = localStorage.getItem('music_client_limitation')
    musicClientLimitation.value = stored ? parseInt(stored) : 5
  }
  function getMusicClientLimitation() {
    return musicClientLimitation.value
  }
  function setMusicClientLimitation(limitation: number) {
    musicClientLimitation.value = limitation
    localStorage.setItem('music_client_limitation', String(limitation))
  }

  function initMusicClientStatus() {
    const defaultStatus = Object.fromEntries(
      Object.keys(musicClients).map((key) => [key, false])
    ) as MusicClientStatus
    defaultStatus.Migu = true
    const stored = localStorage.getItem('music_client_status')
    musicClientStatus.value = stored ? (JSON.parse(stored) as MusicClientStatus) : defaultStatus
  }
  function getMusicClientStatus() {
    return musicClientStatus.value
  }
  function setMusicClientStatus(status: MusicClientStatus) {
    musicClientStatus.value = status
    saveMusicClientStatus()
  }
  function setClients(keys: ClientKey[], status: boolean) {
    if (!Array.isArray(keys)) return
    const statusObj = musicClientStatus.value
    if (!statusObj) return

    keys.forEach((key) => {
      statusObj[key] = status
    })
    saveMusicClientStatus()
  }
  function saveMusicClientStatus() {
    localStorage.setItem('music_client_status', JSON.stringify(musicClientStatus.value))
  }
  function getEnabledClients(): string[] {
    const status = musicClientStatus.value
    if (!status) return []

    return (Object.keys(musicClients) as Array<keyof typeof musicClients>)
      .filter((key) => status[key])
      .map((key) => musicClients[key])
  }
  function initThemeColor() {
    setThemeColor(localStorage.getItem('theme_color') ?? themeColor.value)
  }
  function setThemeColor(val: string) {
    themeColor.value = val
    localStorage.setItem('theme_color', val)
    applyThemeColor()
  }
  function applyThemeColor() {
    const color = themeColor.value
    const [r, g, b] = hexToRgb(color)
    document.documentElement.style.setProperty('--primary-color', color)
    // In dark mode a lighter companion reads better against the dark surface;
    // in light mode the companion needs to be darker for gradients to hold up.
    document.documentElement.style.setProperty(
      '--primary-color-dark',
      darkMode.value ? mixColors(color, '#fff', 0.2) : mixColors(color, '#000', 0.2)
    )
    document.documentElement.style.setProperty('--primary-color-rgb', `${r}, ${g}, ${b}`)
    // Type sitting on a filled accent surface has to follow the accent's own
    // lightness, or a pale user colour would leave white text unreadable.
    document.documentElement.style.setProperty('--on-primary-color', getContrastText(color))
  }
  function getThemeColor() {
    return themeColor.value
  }

  // ----- Wallpaper -----
  // The interface ground is translucent over the wallpaper, never the wallpaper
  // itself: text and hairlines keep their contrast because every page still
  // paints `--bg-color`, just at an alpha.
  const WALLPAPER_MIN_GROUND_ALPHA = 0.08

  async function resolveWallpaperSrc(filename: string): Promise<string> {
    if (!filename) return ''
    try {
      const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Data,
      })
      return getCoverSrc(uri) // file:// → Capacitor 本地服务器
    } catch {
      return ''
    }
  }

  async function refreshWallpaperUrl() {
    wallpaper.value = await resolveWallpaperSrc(wallpaperFilename.value)
    applyWallpaper()
  }

  function applyWallpaper() {
    const root = document.documentElement
    const hasWallpaper = !!wallpaper.value
    if (hasWallpaper) root.classList.add('has-wallpaper')
    else root.classList.remove('has-wallpaper')
    const open = Math.min(100, Math.max(0, wallpaperTransparency.value)) / 100
    const alpha = hasWallpaper ? Math.max(WALLPAPER_MIN_GROUND_ALPHA, 1 - open) : 1
    root.style.setProperty('--wallpaper-ground-alpha', alpha.toFixed(3))
    root.style.setProperty('--wallpaper-blur', `${wallpaperBlur.value}px`)
    root.style.setProperty(
      '--wallpaper-fit',
      wallpaperFit.value === 'stretch' ? '100% 100%' : wallpaperFit.value
    )
    root.style.setProperty('--wallpaper-image', hasWallpaper ? `url("${wallpaper.value}")` : 'none')
  }
  async function setWallpaper(filename: string): Promise<boolean> {
    if (!isWallpaperFilename(filename)) return false
    try {
      localStorage.setItem('wallpaper', filename)
    } catch {
      // Quota exceeded — still apply in memory for this session, but report failure.
      wallpaperFilename.value = filename
      await refreshWallpaperUrl()
      return false
    }
    wallpaperFilename.value = filename
    // Resolve the file:// URL before returning so `getWallpaper()` is immediately
    // renderable for the caller.
    await refreshWallpaperUrl()
    return true
  }

  function removeWallpaper() {
    const previous = wallpaperFilename.value
    wallpaperFilename.value = ''
    wallpaper.value = ''
    try {
      localStorage.removeItem('wallpaper')
    } catch {
      /* storage unavailable — the in-memory state is already cleared */
    }
    applyWallpaper()
    if (previous) {
      Filesystem.deleteFile({ path: previous, directory: Directory.Data }).catch(() => {})
    }
  }

  function getWallpaper() {
    // Returns the renderable URL, not the filename. Empty while the async
    // resolution is still in flight (or when no wallpaper is set).
    return wallpaper.value
  }

  function initWallpaper() {
    const stored = localStorage.getItem('wallpaper') ?? ''
    // Older versions persisted a data URL here. That path is no longer
    // supported; drop it rather than resurrect a multi-megabyte string.
    if (stored && !isWallpaperFilename(stored)) {
      localStorage.removeItem('wallpaper')
      wallpaperFilename.value = ''
      wallpaper.value = ''
    } else {
      wallpaperFilename.value = stored
      if (stored) void refreshWallpaperUrl()
    }
    wallpaperTransparency.value = clampNumber(
      localStorage.getItem('wallpaperTransparency'),
      0,
      100,
      25
    )
    wallpaperBlur.value = clampNumber(localStorage.getItem('wallpaperBlur'), 0, 40, 0)
    const fit = localStorage.getItem('wallpaperFit')
    wallpaperFit.value = fit === 'contain' || fit === 'stretch' ? fit : 'cover'
    applyWallpaper()
  }

  function setWallpaperTransparency(value: number) {
    wallpaperTransparency.value = clampNumber(String(value), 0, 100, 25)
    localStorage.setItem('wallpaperTransparency', String(wallpaperTransparency.value))
    applyWallpaper()
  }

  function getWallpaperTransparency() {
    return wallpaperTransparency.value
  }

  function setWallpaperBlur(value: number) {
    wallpaperBlur.value = clampNumber(String(value), 0, 40, 0)
    localStorage.setItem('wallpaperBlur', String(wallpaperBlur.value))
    applyWallpaper()
  }

  function getWallpaperBlur() {
    return wallpaperBlur.value
  }

  function setWallpaperFit(value: WallpaperFit) {
    if (value !== 'cover' && value !== 'contain' && value !== 'stretch') return
    wallpaperFit.value = value
    localStorage.setItem('wallpaperFit', value)
    applyWallpaper()
  }

  function getWallpaperFit() {
    return wallpaperFit.value
  }

  function getFirstPlayFlag() {
    return firstPlayFlag.value
  }
  function markFirstPlayFlag() {
    firstPlayFlag.value = true
  }
  function initBlacklist() {
    const obj = localStorage.getItem('blacklist')
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) blacklist.value = parsed
      else if (Array.isArray(parsed.data)) blacklist.value = parsed.data
    }
  }
  function getBlacklist() {
    return blacklist.value
  }
  function setBlacklist(val: Song[]) {
    blacklist.value = val
    saveBlacklist()
  }
  function saveBlacklist() {
    localStorage.setItem('blacklist', JSON.stringify(blacklist.value))
  }
  function addToBlacklist(val: Song) {
    blacklist.value.push(val)
    saveBlacklist()
  }

  function initLanguage() {
    let targetLang: string
    const savedLang = localStorage.getItem('appLanguage')
    if (savedLang && SUPPORTED_LOCALES.includes(savedLang)) {
      targetLang = savedLang
    } else {
      const systemLang = getSystemLanguage()
      targetLang = SUPPORTED_LOCALES.includes(systemLang) ? systemLang : 'en-US'
      localStorage.setItem('appLanguage', targetLang)
    }
    i18n.global.locale.value = targetLang
    currentLanguage.value = targetLang
    isI18nReady.value = true
  }

  function getLanguage() {
    return currentLanguage.value
  }
  function setLanguage(lang: string) {
    if (!SUPPORTED_LOCALES.includes(lang)) return
    currentLanguage.value = lang
    localStorage.setItem('appLanguage', lang)
    i18n.global.locale.value = lang
  }

  function syncLanguageFromI18n() {
    const i18nLocale = i18n.global.locale.value
    if (i18nLocale !== currentLanguage.value) {
      currentLanguage.value = i18nLocale
      localStorage.setItem('appLanguage', i18nLocale)
    }
  }

  function initAutoDelInvalidSongs() {
    const val = localStorage.getItem('autoDelInvalidSongs')
    if (val && ['true', 'false'].includes(val)) {
      autoDelInvalidSongs.value = val === 'true'
    } else {
      setAutoDelInvalidSongs(true)
    }
  }

  function setAutoDelInvalidSongs(val: boolean) {
    autoDelInvalidSongs.value = val
    localStorage.setItem('autoDelInvalidSongs', String(autoDelInvalidSongs.value))
  }

  function getAutoDelInvalidSongs() {
    return autoDelInvalidSongs.value
  }

  async function initAudioFocusPause() {
    const storage = localStorage.getItem('audioFocusPause') || ''
    if (['true', 'false'].includes(storage)) {
      audioFocusPause.value = storage === 'true'
    }
    await audio.setAudioFocusEnabled(audioFocusPause.value)
  }

  async function setAudioFocusPause(val: boolean) {
    audioFocusPause.value = val
    await audio.setAudioFocusEnabled(val)
    localStorage.setItem('audioFocusPause', String(val))
  }
  function getAudioFocusPause() {
    return audioFocusPause.value
  }
  async function initCanFetchCoverFromWeb() {
    const storage = localStorage.getItem('canFetchCoverFromWeb') || ''
    if (['true', 'false'].includes(storage)) {
      canFetchCoverFromWeb.value = storage === 'true'
    }
  }

  async function setCanFetchCoverFromWeb(val: boolean) {
    canFetchCoverFromWeb.value = val
    localStorage.setItem('canFetchCoverFromWeb', String(canFetchCoverFromWeb.value))
    if (playQueue.value.length === 0) return
    if (val) {
      // Pick up web artwork for the current queue now that it is allowed.
      void resolveQueueCovers(playQueue.value, updateVersion)
    } else {
      coverLookupAbort?.abort()
      coverLookupAbort = null
      // Drop any web URL that was previously handed to the native player.
      void audio.setPlaylist(await buildNativePlaylist(playQueue.value))
    }
  }

  function getCanFetchCoverFromWeb() {
    return canFetchCoverFromWeb.value
  }

  function initPlayQueueRepeat() {
    const val = localStorage.getItem('playQueueRepeat')
    if (val && ['true', 'false'].includes(val)) {
      playQueueRepeat.value = val === 'true'
    } else {
      setPlayQueueRepeat(true)
    }
  }

  function initAutoPauseOnDisconnect() {
    const val = localStorage.getItem('autoPauseOnDisconnect')
    if (val && ['true', 'false'].includes(val)) {
      autoPauseOnDisconnect.value = val === 'true'
    } else {
      setAutoPauseOnDisconnect(true)
    }
  }

  function initAutoPlayOnConnect() {
    const val = localStorage.getItem('autoPlayOnConnect')
    if (val && ['true', 'false'].includes(val)) {
      autoPlayOnConnect.value = val === 'true'
    } else {
      setAutoPlayOnConnect(false)
    }
  }

  function setAutoPauseOnDisconnect(val: boolean) {
    autoPauseOnDisconnect.value = val
    localStorage.setItem('autoPauseOnDisconnect', String(autoPauseOnDisconnect.value))
  }

  function setAutoPlayOnConnect(val: boolean) {
    autoPlayOnConnect.value = val
    localStorage.setItem('autoPlayOnConnect', String(autoPlayOnConnect.value))
  }

  function setPlayQueueRepeat(val: boolean) {
    playQueueRepeat.value = val
    localStorage.setItem('playQueueRepeat', String(playQueueRepeat.value))
    audio.setPlayQueueRepeat(val)
  }

  function getAutoPauseOnDisconnect() {
    return autoPauseOnDisconnect.value
  }

  function getAutoPlayOnConnect() {
    return autoPlayOnConnect.value
  }

  function getPlayQueueRepeat() {
    return playQueueRepeat.value
  }

  function setPinyinSearch(val: boolean) {
    pinyinSearch.value = val
    localStorage.setItem('pinyinSearch', String(pinyinSearch.value))
  }
  function getPinyinSearch() {
    return pinyinSearch.value
  }

  const selectedCategory = ref('tracks')
  const allSongs = ref<Song[]>([])
  const downloadTasks = ref<DownloadTaskSnapshot[]>([])
  const downloadHistory = ref<DownloadHistoryItem[]>([])
  const playQueue = ref<Song[]>([])
  const homeFlag = ref(false)
  const initFlag = ref(false)
  const currentPlayList = ref<number>(-1)
  const currentToBeSortedSongList = ref<number>(-1)
  const playbackRate = ref(1.0)

  function setSelectedCategory(val: string) {
    selectedCategory.value = val
  }
  function getSelectedCategory() {
    return selectedCategory.value
  }
  function setCurrentPlayList(val: number) {
    currentPlayList.value = val
  }
  function getCurrentPlayList() {
    return currentPlayList.value
  }
  function setToBeSortedSongListIndex(val: number) {
    currentToBeSortedSongList.value = val
  }
  function getToBeSortedSongListIndex() {
    return currentToBeSortedSongList.value
  }

  function setupAudioListener() {
    window.addEventListener('audioBecomingNoisy', () => {
      console.log('[Store] 收到音频输出设备断开事件，自动暂停')
      if (getAutoPauseOnDisconnect() && playData.value.isPlaying) {
        togglePlay().then()
      }
    })
    window.addEventListener('audioConnected', () => {
      console.log('[Store] 收到音频输出设备连接事件，自动播放')
      if (getAutoPlayOnConnect() && !playData.value.isPlaying) {
        togglePlay().then()
      }
    })
  }

  /**
   * Listen for WebView renderer being killed (e.g., when app is in background
   * and Android reclaims memory). When this happens, the WebView is destroyed
   * and the app will be reloaded when the user returns.
   */
  function setupWebViewRendererKilledListener() {
    window.addEventListener('webviewRendererKilled', () => {
      console.log('[Store] WebView renderer was killed by system (likely app was in background)')
      // The native WebView has been destroyed. Stop sending UI updates to avoid
      // "Application attempted to call on a destroyed WebView" errors.
      // The native side will trigger a reload when the app resumes.
      webViewMayBeDestroyed.value = true
    })
  }

  const webViewMayBeDestroyed = ref(false)

  const playData = ref({
    currentIndex: 0,
    isPlaying: false,
    mockCurrentTime: 0,
  })
  const playMode = ref<PlayMode>('sequential')
  function isValidMode(mode: any): mode is PlayMode {
    return mode === 'sequential' || mode === 'repeatOne'
  }
  function initPlayMode() {
    const mode = localStorage.getItem('playMode')
    if (isValidMode(mode)) playMode.value = mode
  }

  const isSwitchingSong = ref(false)
  let switchPromise: Promise<void> | null = null

  const likeList = ref<Playlist>({
    id: 0,
    name: '',
    description: '',
    coverUrl: '',
    songCount: 0,
    data: [],
  })
  const songLists = ref<Playlist[]>([])

  function setPlayMode(val: 'sequential' | 'repeatOne') {
    playMode.value = val
    localStorage.setItem('playMode', playMode.value)
  }
  function getPlayMode() {
    return playMode.value
  }

  function addSongList(val: Playlist) {
    songLists.value.push(val)
    saveSongLists()
  }
  function setSongListById(val: number, list: Playlist) {
    list.songCount = list.data.length
    songLists.value[val - 1] = list
    saveSongLists()
  }
  function setSongListDataById(val: number, data: Song[]) {
    songLists.value[val - 1].data = data
    songLists.value[val - 1].songCount = data.length
    saveSongLists()
  }
  function delectSongListById(val: number) {
    songLists.value.splice(val - 1, 1)
    saveSongLists()
  }
  function getSongLists() {
    return songLists.value
  }
  function saveSongLists() {
    try {
      localStorage.setItem('songLists', JSON.stringify(songLists.value))
    } catch (error) {
      // Uploaded covers are stored inline; if storage is full keep the in-memory
      // state usable instead of throwing into the caller.
      console.error('保存播放列表失败:', error)
    }
  }
  function setSongLists(list: Playlist[]) {
    songLists.value = list
    saveSongLists()
  }
  function mergeSongLists(list: Playlist[]) {
    songLists.value = [...songLists.value, ...list]
    saveSongLists()
  }
  function initSongLists() {
    const obj = localStorage.getItem('songLists')
    if (!obj) return
    try {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) songLists.value = parsed
      else if (Array.isArray(parsed.data)) songLists.value = parsed.data
    } catch (e) {
      console.error('歌单数据解析失败', e)
    }
  }

  const currentPlayListIndex = ref(0)

  function savePlayData() {
    localStorage.setItem(
      'playData',
      JSON.stringify({
        currentIndex: playData.value.currentIndex,
        isPlaying: playData.value.isPlaying,
        mockCurrentTime: playData.value.mockCurrentTime,
      })
    )
  }
  function savePlayQueue() {
    localStorage.setItem('playQueue', JSON.stringify(playQueue.value))
  }
  function saveLikeList() {
    localStorage.setItem(
      'likeList',
      JSON.stringify({
        id: 0,
        name: '',
        description: '',
        coverUrl: likeList.value.coverUrl,
        songCount: likeList.value.songCount,
        data: likeList.value.data,
      })
    )
  }
  function saveCurrentPlayListIndex() {
    localStorage.setItem('currentPlayListIndex', JSON.stringify(currentPlayListIndex.value))
  }

  const currentSong = computed(() => playQueue.value[playData.value.currentIndex] || null)

  // 播放队列更新
  let updateVersion = 0
  let coverLookupAbort: AbortController | null = null

  /** How many queue entries to look up online per sync (current song first). */
  const MAX_QUEUE_COVER_LOOKUPS = 6

  async function buildNativePlaylist(queue: Song[]) {
    const allowWeb = canFetchCoverFromWeb.value
    return Promise.all(
      queue.map(async (s) => ({
        url: getAccessibleUrl(s.uri),
        title: s.title,
        artist: s.artist || 'Unknown',
        album: s.album || '',
        // Native cannot decode albumart URIs. `resolveNativeCoverUrl` hands over
        // a real file/data/https URL: web cache first, then the stored
        // file:/data: reference, then the artwork extracted from the audio file.
        coverUrl: await resolveNativeCoverUrl(s, allowWeb),
      }))
    )
  }
  /**
   * 每首歌已经解析出的本地封面路径（含从音频文件提取的内嵌封面）。
   * 空串表示“提取过但没有封面”，避免每次 buildNativePlaylist 都重复读文件。
   * 只缓存 local/embedded 结果；web 封面由 coverCache 自己缓存，且优先级更高。
   */
  const nativeLocalCoverCache = new Map<string, string>()

  /**
   * 原生侧封面解析。Android 通知栏的 BitmapFactory 无法解码 MediaStore 的
   * `content://.../albumart/...` URI，所以这个引用永远不会原样透传。优先级：
   *
   *   1. 已命中 {@link coverCache} 的 web 封面（启用在线查询时）。
   *   2. 可直接使用的 `file:` / `data:` / `https:` 引用。
   *   3. 从音频文件提取的内嵌封面（按 song.id 缓存）。
   *
   * 全部失败返回 ''，由原生侧回退到默认图标。
   */
  async function resolveNativeCoverUrl(song: Song, allowWeb: boolean): Promise<string> {
    if (allowWeb) {
      const web = getCachedCover(song.title, song.artist || '')
      if (web) return web
    }

    const local = (song.albumArtUri || '').trim()
    if (local && !local.startsWith('content://')) return local

    if (nativeLocalCoverCache.has(song.id)) return nativeLocalCoverCache.get(song.id)!

    let path = ''
    try {
      const result = await getEmbeddedCover(song.uri, song.id)
      path = typeof result === 'string' ? result : result?.path || ''
    } catch {
      path = ''
    }
    nativeLocalCoverCache.set(song.id, path)
    return path
  }
  /**
   * Resolve covers for tracks that have no embedded artwork, nearest to the
   * current song first, then push the updated playlist to the native player.
   * This is what lets the notification show a web cover without the native
   * side doing any lookup of its own.
   */
  async function resolveQueueCovers(queue: Song[], version: number) {
    coverLookupAbort?.abort()
    coverLookupAbort = null
    if (queue.length === 0) return

    const allowWeb = canFetchCoverFromWeb.value
    const current = playData.value.currentIndex
    const order = queue
      .map((_, index) => index)
      .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))

    // Stage 1: warm the native cover cache for the current track and its
    // neighbours. Native BitmapFactory cannot decode albumart URIs, so every
    // track without a directly-usable cover has its embedded artwork extracted.
    let anyResolved = false
    const warmup = order.slice(0, MAX_QUEUE_COVER_LOOKUPS)
    await Promise.all(
      warmup.map(async (index) => {
        if (version !== updateVersion) return
        try {
          const url = await resolveNativeCoverUrl(queue[index], allowWeb)
          if (url) anyResolved = true
        } catch {
          /* ignore */
        }
      })
    )
    if (version !== updateVersion) return

    // Stage 2: online lookup for tracks that still have no local cover.
    // `undefined` means "never looked up"; a cached miss (null) must not be
    // retried, or every offline start walks the provider chain again.
    if (allowWeb) {
      const pending = order
        .filter((index) => !nativeLocalCoverCache.get(queue[index].id))
        .filter(
          (index) => lookupCoverUrl(queue[index].title, queue[index].artist || '') === undefined
        )
        .slice(0, MAX_QUEUE_COVER_LOOKUPS)

      if (pending.length > 0) {
        const controller = new AbortController()
        coverLookupAbort = controller

        let webResolved = false
        for (const index of pending) {
          if (controller.signal.aborted || version !== updateVersion) return
          try {
            const url = await fetchCoverFromWeb(
              queue[index].title,
              queue[index].artist || '',
              controller.signal
            )
            if (url) webResolved = true
          } catch {
            // Offline or provider failure — the native side falls back to the icon.
          }
        }

        if (controller.signal.aborted || version !== updateVersion) return
        if (webResolved) anyResolved = true
      }
    }

    if (!anyResolved) return

    // Stage 3: rebuild the native playlist with the covers that resolved, then
    // refresh the current track so the notification picks up the new cover.
    await audio.setPlaylist(await buildNativePlaylist(queue))
    await audio.refreshCurrentMetadata()
  }

  watch(
    playQueue,
    async (newQueue) => {
      const currentVersion = ++updateVersion

      if (!newQueue.length) {
        coverLookupAbort?.abort()
        coverLookupAbort = null
        await audio.setPlaylist([])
        return
      }

      try {
        const playlistItems = await buildNativePlaylist(newQueue)

        // 检查版本号
        if (currentVersion !== updateVersion) return

        await audio.setPlaylist(playlistItems)

        // 修正索引
        if (playData.value.currentIndex >= playlistItems.length) {
          playData.value.currentIndex = 0
          savePlayData()
        }

        // Look up missing artwork in the background; playback starts with the
        // local cover (or the default icon) and the notification updates when
        // the web result arrives.
        void resolveQueueCovers(newQueue, currentVersion)
      } catch (error) {
        // 降级（极少发生，因为现在没有异步操作）
        console.error('构建播放列表失败', error)
        if (currentVersion !== updateVersion) return
        const fallbackList = newQueue.map((s) => ({
          url: s.uri,
          title: s.title,
          artist: s.artist || 'Unknown',
          album: s.album || '',
          coverUrl: getNativeCoverUrl(s, canFetchCoverFromWeb.value),
        }))
        await audio.setPlaylist(fallbackList)
        if (playData.value.currentIndex >= fallbackList.length) {
          playData.value.currentIndex = 0
          savePlayData()
        }
      }
    },
    { deep: true, immediate: true }
  )

  watch(playMode, (newMode) => {
    audio.setRepeatMode(newMode === 'repeatOne').then((r) => console.log('repeatOne', r))
  })

  /** Throttle for writing playback progress to localStorage. */
  const TIME_PERSIST_INTERVAL_MS = 5000
  let lastTimePersistAt = 0

  function setupNativeAudioListeners() {
    audio.addEventListener(
      'songChanged',
      (data: { index: number; isPlaying?: boolean; position?: number }) => {
        playData.value.currentIndex = data.index
        // The track index changed, so the old progress is meaningless — reset it
        // before persisting to avoid "new index + previous track's position".
        playData.value.mockCurrentTime =
          Number.isFinite(data.position) && (data.position as number) >= 0
            ? (data.position as number)
            : 0
        // A load does not imply playback (restore/prepare may leave it paused).
        playData.value.isPlaying = data.isPlaying ?? true
        savePlayData()
      }
    )
    audio.addEventListener('playStateChange' as any, (data: { isPlaying: boolean }) => {
      playData.value.isPlaying = data.isPlaying
      savePlayData()
    })
    audio.addEventListener('timeupdate', () => {
      playData.value.mockCurrentTime = audio.currentTime
      // Writing localStorage on every tick is wasteful; flush at most every
      // few seconds so a killed WebView still restores near the right spot.
      const now = Date.now()
      if (now - lastTimePersistAt >= TIME_PERSIST_INTERVAL_MS) {
        lastTimePersistAt = now
        savePlayData()
      }
    })
    audio.addEventListener('error', (data) => {
      console.error('[NativeAudio] Error', data)
      toast.error('播放出错')
    })
  }

  /** Flush everything needed to resume playback; safe to call synchronously. */
  function persistPlaybackSnapshot() {
    savePlayData()
    savePlayQueue()
  }

  /**
   * Persist on the way out: Capacitor's appStateChange fires before the process
   * is backgrounded/killed, and the page events cover WebView teardown.
   */
  function setupPersistenceListeners() {
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) persistPlaybackSnapshot()
      }).catch((e) => console.warn('[Store] appStateChange listener failed', e))
    } catch (e) {
      console.warn('[Store] appStateChange listener unavailable', e)
    }
    const flush = () => persistPlaybackSnapshot()
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  /**
   * After a WebView reload the native player may still be running with its own
   * track/position. Prefer that truth over the persisted snapshot.
   */
  async function reconcilePlaybackState() {
    try {
      const state = await audio.getState()
      if (!state || state.currentIndex < 0) return
      if (state.currentIndex >= playQueue.value.length) return
      playData.value.currentIndex = state.currentIndex
      playData.value.isPlaying = state.isPlaying
      if (Number.isFinite(state.currentPosition) && state.currentPosition >= 0) {
        playData.value.mockCurrentTime = state.currentPosition
      }
      savePlayData()
    } catch (e) {
      // Web / older native build: keep the persisted values.
      console.warn('[Store] getState unavailable', e)
    }
  }

  async function playIndex(index: number, autoPlay = true) {
    await audio.playIndex(index, playQueueRepeat.value, autoPlay)
  }

  async function togglePlay() {
    if (playQueue.value.length === 0) {
      toast.warning('播放队列为空')
      return
    }

    if (playData.value.isPlaying) {
      await audio.pause()
      // playStateChange event will update isPlaying; set locally for immediate UI feedback
      playData.value.isPlaying = false
      savePlayData()
      return
    }

    // Try to resume first — if the song is already prepared (normal pause/resume),
    // this avoids reloading the track entirely.
    try {
      await audio.play()
      playData.value.isPlaying = true
      savePlayData()
      return
    } catch {
      // Song not prepared yet (first play or after error) — full load path
    }

    try {
      // Ask the native side for its position before (re)loading: after a
      // WebView reload the persisted mockCurrentTime may be stale.
      let resumeAt = playData.value.mockCurrentTime
      try {
        const state = await audio.getState()
        if (
          state &&
          state.currentIndex === playData.value.currentIndex &&
          Number.isFinite(state.currentPosition) &&
          state.currentPosition > 0
        ) {
          resumeAt = state.currentPosition
        }
      } catch {
        // getState unavailable — fall back to the persisted position.
      }
      await audio.playIndex(playData.value.currentIndex, playQueueRepeat.value, false)
      if (resumeAt > 0) {
        await audio.seek(resumeAt)
      }
      await audio.play()
      playData.value.isPlaying = true
      savePlayData()
    } catch (err) {
      console.error('[Store] togglePlay error', err)
      toast.error('播放失败')
    }
  }

  async function nextSong() {
    if (switchPromise || playQueue.value.length === 0) return
    isSwitchingSong.value = true

    switchPromise = (async () => {
      try {
        // Sequential mode plays through the queue and stops at the end; only
        // repeatOne (handled natively) wraps around.
        if (
          !playQueueRepeat.value &&
          playMode.value === 'sequential' &&
          playData.value.currentIndex + 1 >= playQueue.value.length
        ) {
          await audio.pause()
          playData.value.isPlaying = false
          savePlayData()
          return
        }
        const nextIndex = (playData.value.currentIndex + 1) % playQueue.value.length
        console.log('[Store] nextSong: playing index=', nextIndex)
        await playIndex(nextIndex)
        // currentIndex is updated by the 'songChanged' event from native — do NOT set it here
        playData.value.isPlaying = true
        savePlayData()
      } catch (err) {
        console.error('[Store] nextSong error', err)
        toast.error('切歌失败')
      } finally {
        isSwitchingSong.value = false
        switchPromise = null
      }
    })()

    await switchPromise
  }

  async function prevSong() {
    if (switchPromise || playQueue.value.length === 0) return
    isSwitchingSong.value = true

    switchPromise = (async () => {
      try {
        // Sequential mode does not wrap backwards either.
        if (
          !playQueueRepeat.value &&
          playMode.value === 'sequential' &&
          playData.value.currentIndex <= 0
        ) {
          return
        }
        const prevIndex =
          (playData.value.currentIndex - 1 + playQueue.value.length) % playQueue.value.length
        console.log('[Store] prevSong: playing index=', prevIndex)
        await playIndex(prevIndex)
        // currentIndex is updated by the 'songChanged' event from native — do NOT set it here
        playData.value.isPlaying = true
        savePlayData()
      } catch (err) {
        console.error('[Store] prevSong error', err)
        toast.error('切歌失败')
      } finally {
        isSwitchingSong.value = false
        switchPromise = null
      }
    })()

    await switchPromise
  }

  function initSettings() {
    initLanguage()
    initThemeColor()
    loadInitialDarkMode()
    initWallpaper()
    initFetchTimeOut()
    initEachSongAveTimeOut()
    initMusicClientLimitation()
    initMusicClientStatus()
    // Request media permissions on app startup so the user
    // doesn't have to grant them later when scanning for music
    requestMediaPermissions().catch(() => {})
    initBlacklist()
    initPlaybackRate()
    initAutoPauseOnDisconnect()
    initAutoPlayOnConnect()
    initAutoDelInvalidSongs()
    initAudioFocusPause().then((r) => console.log('initAudioFocusPause', r))
    initAllSongs()
    initDownloadTasks()
    initDownloadHistory()
    initSearchHistory()
    initPlayQueue()
    initPlayData()
    initCurrentPlayListIndex()
    initLikeList()
    initSongLists()
    initPlayMode()
    initPlayQueueRepeat()
  }

  async function init() {
    if (!initFlag.value) {
      initSettings()
      runCoverMigration()
      setupAudioListener()
      setupWebViewRendererKilledListener()
      // playQueue watcher (immediate: true) already syncs playlist to native
      setupNativeAudioListeners()
      setupPersistenceListeners()
      // The native player outlives a WebView reload; its state wins over the
      // snapshot we just restored from localStorage.
      await reconcilePlaybackState()
      await initCanFetchCoverFromWeb()
      await audio.setRepeatMode(playMode.value === 'repeatOne')
      await audio.setPlayQueueRepeat(playQueueRepeat.value)
      initFlag.value = true
    }
  }

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
    applyDarkMode()
    localStorage.setItem('darkMode', String(darkMode.value))
  }

  function applyDarkMode() {
    const root = document.documentElement
    // Animate colour swaps only while the theme is changing.
    root.classList.add('theme-transition')
    if (darkMode.value) root.classList.add('dark')
    else root.classList.remove('dark')
    applyThemeColor()
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
    // Keep the native bar areas in step with the themed page background.
    // Resolve the CSS token after the class swap so the value is current.
    // The plugin cannot parse an alpha channel, so read the opaque token: the
    // page tint's own `--bg-color-rgb`, which the wallpaper layer never changes.
    const bgColor = window.getComputedStyle(root).getPropertyValue('--bg-color-rgb').trim()
    SystemBar.setTheme({
      mode: darkMode.value ? 'dark' : 'light',
      color: bgColor ? `rgb(${bgColor})` : undefined,
    }).catch(() => {
      // SystemBar plugin not available on web / iOS — ignore silently
    })
  }

  function setAllSongs(songs: Song[]) {
    allSongs.value = songs
    localStorage.setItem('allSongs', JSON.stringify(songs))
  }
  function getAllSongs() {
    return allSongs.value
  }

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

  function setPlayQueue(list: Song[]) {
    playQueue.value = list
    savePlayQueue()
  }
  function getPlayQueue() {
    return playQueue.value
  }
  function addToQueue(song: Song) {
    playQueue.value.push(song)
    savePlayQueue()
  }
  function addListToQueue(list: Song[]) {
    playQueue.value = [...playQueue.value, ...list]
    savePlayQueue()
  }

  let currentIndexRequest = 0
  async function setCurrentIndex(index: number) {
    const request = ++currentIndexRequest
    try {
      // Prefer the native player's confirmation before committing the index;
      // the playlist may be mid-update, so a rejection still keeps the local
      // value (the following playIndex re-syncs it).
      await audio.setCurrentIndex(index)
    } catch (e) {
      console.warn('[Store] native setCurrentIndex rejected', e)
    }
    // A newer request (e.g. playIndex from a song tap) wins over this one.
    if (request !== currentIndexRequest) return
    playData.value.currentIndex = index
    savePlayData()
  }
  function setIsPlaying(status: boolean) {
    playData.value.isPlaying = status
    savePlayData()
  }
  function setMockCurrentTime(val: number) {
    playData.value.mockCurrentTime = val
    savePlayData()
  }
  function getPlayData() {
    return playData.value
  }

  function setIsSwitchingSong(val: boolean) {
    isSwitchingSong.value = val
  }
  function getIsSwitchingSong() {
    return isSwitchingSong.value
  }

  function setLikeListData(songs: Song[]) {
    likeList.value.data = songs
    likeList.value.songCount = songs.length
    saveLikeList()
  }
  function mergeLikeListData(songs: Song[]) {
    likeList.value.data = [...likeList.value.data, ...songs]
    likeList.value.songCount = likeList.value.data.length
    saveLikeList()
  }
  function getLikeList() {
    return likeList.value
  }

  function setCurrentPlayListIndex(val: number) {
    currentPlayListIndex.value = val
    saveCurrentPlayListIndex()
  }
  function getCurrentPlayListIndex() {
    return currentPlayListIndex.value
  }

  function setHomeFlag(val: boolean) {
    homeFlag.value = val
  }
  function getHomeFlag() {
    return homeFlag.value
  }
  function setInitFlag(val: boolean) {
    initFlag.value = val
  }
  function getInitFlag() {
    return initFlag.value
  }

  function loadInitialDarkMode() {
    const saved = localStorage.getItem('darkMode')
    if (saved === 'true') {
      darkMode.value = true
    } else if (saved === 'false') {
      darkMode.value = false
    } else {
      darkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyDarkMode()
  }

  function initAllSongs() {
    const obj = localStorage.getItem('allSongs')
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) allSongs.value = parsed
      else if (Array.isArray(parsed.data)) allSongs.value = parsed.data
    }
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
  function initSearchHistory() {
    const obj = localStorage.getItem('searchHistory')
    if (!obj) return
    try {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) searchHistory.value = parsed
      else if (Array.isArray(parsed.data)) searchHistory.value = parsed.data
    } catch (e) {
      console.error(e)
    }
  }

  function initPlayQueue() {
    const obj = localStorage.getItem('playQueue')
    if (!obj) return
    try {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) playQueue.value = parsed
      else if (Array.isArray(parsed.data)) playQueue.value = parsed.data
    } catch (e) {
      console.error('播放队列解析失败', e)
    }
  }

  function initPlayData() {
    const obj = localStorage.getItem('playData')
    console.log(`已加载上次播放数据: ${obj}`)
    if (obj) {
      try {
        const data = JSON.parse(obj)
        playData.value.currentIndex = data.currentIndex ?? 0
        playData.value.isPlaying = false // 默认不自动播放
        playData.value.mockCurrentTime = data.mockCurrentTime ?? 0
      } catch (e) {
        console.error(e)
        toast.error('播放数据解析失败')
      }
    }
  }

  function initPlaybackRate() {
    const saved = localStorage.getItem('playbackRate')
    if (saved) {
      playbackRate.value = parseFloat(saved)
    }
  }

  async function setPlaybackRate(rate: number) {
    playbackRate.value = rate
    localStorage.setItem('playbackRate', rate.toString())
    await audio.setPlaybackRate(rate)
    // MediaPlayer applies PlaybackParams even while paused — no need to toggle
  }

  function initLikeList() {
    const obj = localStorage.getItem('likeList')
    if (obj) {
      try {
        likeList.value = { ...likeList.value, ...JSON.parse(obj) }
      } catch (e) {
        console.error(e)
      }
    }
  }
  function initCurrentPlayListIndex() {
    const obj = localStorage.getItem('currentPlayListIndex')
    if (obj) {
      try {
        currentPlayListIndex.value = JSON.parse(obj) ?? 0
        if (currentPlayListIndex.value === 0) {
          currentPlayListIndex.value = JSON.parse(obj).data ?? 0
        }
      } catch (e) {
        console.error(e)
      }
    } else {
      currentPlayListIndex.value = 0
    }
  }

  return {
    isI18nReady,
    initLanguage,
    getBlacklist,
    setBlacklist,
    addToBlacklist,
    setSelectedCategory,
    getSelectedCategory,
    setCurrentPlayList,
    getCurrentPlayList,
    setPlayQueueRepeat,
    getPlayQueueRepeat,
    mergeSongLists,
    setSongLists,
    saveSongLists,
    getSongLists,
    addSongList,
    setSongListById,
    setSongListDataById,
    delectSongListById,
    getPlayMode,
    setPlayMode,
    playQueue,
    playData,
    playMode,
    currentSong,
    nextSong,
    prevSong,
    togglePlay,
    init,
    setIsSwitchingSong,
    getIsSwitchingSong,
    darkMode,
    toggleDarkMode,
    loadInitialDarkMode,
    setPinyinSearch,
    getPinyinSearch,
    setAutoPauseOnDisconnect,
    getAutoPauseOnDisconnect,
    setAutoPlayOnConnect,
    getAutoPlayOnConnect,
    setAutoDelInvalidSongs,
    getAutoDelInvalidSongs,
    syncLanguageFromI18n,
    setLanguage,
    getLanguage,
    allSongs,
    setAllSongs,
    getAllSongs,
    downloadTasks,
    downloadHistory,
    getDownloadTasks,
    getActiveDownloadTasks,
    getDownloadHistory,
    upsertDownloadTask,
    setDownloadTaskProgress,
    setDownloadTaskStatus,
    removeDownloadTask,
    appendDownloadHistory,
    clearDownloadHistory,
    setPlayQueue,
    getPlayQueue,
    addToQueue,
    addListToQueue,
    setCurrentIndex,
    setIsPlaying,
    setMockCurrentTime,
    getPlayData,
    getLikeList,
    setLikeListData,
    mergeLikeListData,
    getCurrentPlayListIndex,
    setCurrentPlayListIndex,
    homeFlag,
    setHomeFlag,
    getHomeFlag,
    initFlag,
    setInitFlag,
    getInitFlag,
    setToBeSortedSongListIndex,
    getToBeSortedSongListIndex,
    setCanFetchCoverFromWeb,
    getCanFetchCoverFromWeb,
    setAudioFocusPause,
    getAudioFocusPause,
    setPlaybackRate,
    playbackRate,
    getFirstPlayFlag,
    markFirstPlayFlag,
    getThemeColor,
    setThemeColor,
    wallpaper,
    setWallpaper,
    removeWallpaper,
    getWallpaper,
    setWallpaperTransparency,
    getWallpaperTransparency,
    setWallpaperBlur,
    getWallpaperBlur,
    setWallpaperFit,
    getWallpaperFit,
    initWallpaper,
    musicClients,
    setClients,
    getEnabledClients,
    getMusicClientStatus,
    setMusicClientStatus,
    getMusicClientLimitation,
    setMusicClientLimitation,
    getFetchTimeOut,
    setFetchTimeOut,
    getEachSongAveTimeOut,
    setEachSongAveTimeOut,

    searchKeyword,
    searchHistory,
    pushSearchHistory,
    removeSearchHistoryItem,
    clearSearchHistory,
    searchResults,
    isLoading,
    searchError,
    hasSearched,
    search,
    resetSearch,
    playIndex,
  }
})
