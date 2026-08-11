import {
  ClientKey,
  MusicClientStatus,
  OnlineSong,
  Playlist,
  PlayMode,
  Song,
} from '@/utils/interface'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl, parseSearchError } from '@/utils/functions'
import toast from '@/utils/createToast'
import { i18n } from '@/i18n'
import { registerPlugin } from '@capacitor/core'
import type { SystemBarPlugin } from '@/plugins/system-bar/definitions'
import { mixColors } from '@/utils/color'
import { musicClients, USER_AGENT } from '@/config'
import { MusicSignerPlugin } from '@/plugins/music-signer/definitions'
import { requestMediaPermissions } from '@/utils/permission'
import { DownloaderPlugin } from '@/plugins/downloader/definitions'

const SystemBar = registerPlugin<SystemBarPlugin>('SystemBar')
export const MusicSigner = registerPlugin<MusicSignerPlugin>('MusicSigner')
export const Downloader = registerPlugin<DownloaderPlugin>('Downloader')
const SUPPORTED_LOCALES = ['zh-CN', 'en-US']
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
  const autoPauseOnDisconnect = ref(true)
  const autoDelInvalidSongs = ref(true)
  const currentLanguage = ref('zh-CN')
  const isI18nReady = ref(false)
  const canFetchCoverFromWeb = ref(true)
  const audioFocusPause = ref(true)
  const blacklist = ref<Song[]>([])
  const firstPlayFlag = ref(false)
  const themeColor = ref<string>('#007aff')
  const musicClientStatus = ref<MusicClientStatus>()
  const musicClientLimitation = ref<number>(5)
  const fetchTimeOut = ref<number>(30)
  const eachSongAveTimeOut = ref<number>(10)
  // 搜索
  const searchKeyword = ref<string>('')
  const searchResults = ref<OnlineSong[]>([])
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
    document.documentElement.style.setProperty('--primary-color', color)
    document.documentElement.style.setProperty(
      '--primary-color-dark',
      mixColors(color, '#fff', 0.14)
    )
    document.documentElement.style.setProperty('--primary-color-rgb', color)
  }
  function getThemeColor() {
    return themeColor.value
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
    await audio.setCanFetchCoverFromWeb(canFetchCoverFromWeb.value)
  }

  function setCanFetchCoverFromWeb(val: boolean) {
    canFetchCoverFromWeb.value = val
    localStorage.setItem('canFetchCoverFromWeb', String(canFetchCoverFromWeb.value))
  }

  function getCanFetchCoverFromWeb() {
    return canFetchCoverFromWeb.value
  }

  function initAutoPauseOnDisconnect() {
    const val = localStorage.getItem('autoPauseOnDisconnect')
    if (val && ['true', 'false'].includes(val)) {
      autoPauseOnDisconnect.value = val === 'true'
    } else {
      setAutoPauseOnDisconnect(true)
    }
  }

  function setAutoPauseOnDisconnect(val: boolean) {
    autoPauseOnDisconnect.value = val
    localStorage.setItem('autoPauseOnDisconnect', String(autoPauseOnDisconnect.value))
  }

  function getAutoPauseOnDisconnect() {
    return autoPauseOnDisconnect.value
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

  function setupAudioBecomingNoisyListener() {
    window.addEventListener('audioBecomingNoisy', () => {
      console.log('[Store] 收到音频输出设备断开事件，自动暂停')
      if (getAutoPauseOnDisconnect() && playData.value.isPlaying) {
        togglePlay()
      }
    })
  }

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
    localStorage.setItem('songLists', JSON.stringify(songLists.value))
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
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) songLists.value = parsed
      else if (Array.isArray(parsed.data)) songLists.value = parsed.data
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

  watch(
    playQueue,
    async (newQueue) => {
      const currentVersion = ++updateVersion

      if (!newQueue.length) {
        await audio.setPlaylist([])
        playData.value.currentIndex = 0
        savePlayData()
        return
      }

      try {
        // 直接同步构建播放列表，不进行任何异步获取
        const playlistItems = newQueue.map((s) => ({
          url: getAccessibleUrl(s.uri), // 同步函数
          title: s.title,
          artist: s.artist || 'Unknown',
          album: s.album || '',
          coverUrl: s.albumArtUri || '', // 直接使用原封面
        }))

        // 检查版本号
        if (currentVersion !== updateVersion) return

        await audio.setPlaylist(playlistItems)

        // 修正索引
        if (playData.value.currentIndex >= playlistItems.length) {
          playData.value.currentIndex = 0
          savePlayData()
        }
      } catch (error) {
        // 降级（极少发生，因为现在没有异步操作）
        console.error('构建播放列表失败', error)
        if (currentVersion !== updateVersion) return
        const fallbackList = newQueue.map((s) => ({
          url: s.uri,
          title: s.title,
          artist: s.artist || 'Unknown',
          album: s.album || '',
          coverUrl: s.albumArtUri || '',
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

  watch(canFetchCoverFromWeb, async (newVal) => {
    await audio.setCanFetchCoverFromWeb(newVal)
  })

  function setupNativeAudioListeners() {
    audio.addEventListener('songChanged', (data: { index: number }) => {
      playData.value.currentIndex = data.index
      playData.value.isPlaying = true
      savePlayData()
    })
    audio.addEventListener('playStateChange' as any, (data: { isPlaying: boolean }) => {
      playData.value.isPlaying = data.isPlaying
      savePlayData()
    })
    audio.addEventListener('timeupdate', () => {
      playData.value.mockCurrentTime = audio.currentTime
    })
    audio.addEventListener('error', (data) => {
      console.error('[NativeAudio] Error', data)
      toast.error('播放出错')
    })
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
      await audio.playIndex(playData.value.currentIndex, false)
      const savedTime = playData.value.mockCurrentTime
      if (savedTime > 0) {
        await audio.seek(savedTime)
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
        const nextIndex = (playData.value.currentIndex + 1) % playQueue.value.length
        console.log('[Store] nextSong: playing index=', nextIndex)
        await audio.playIndex(nextIndex)
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
        const prevIndex =
          (playData.value.currentIndex - 1 + playQueue.value.length) % playQueue.value.length
        console.log('[Store] prevSong: playing index=', prevIndex)
        await audio.playIndex(prevIndex)
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

  async function init() {
    if (!initFlag.value) {
      initLanguage()
      initThemeColor()
      loadInitialDarkMode()
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
      initAutoDelInvalidSongs()
      initAudioFocusPause().then((r) => console.log('initAudioFocusPause', r))
      initAllSongs()
      initPlayQueue()
      initPlayData()
      initCurrentPlayListIndex()
      initLikeList()
      initSongLists()
      initPlayMode()
      setupAudioBecomingNoisyListener()
      // playQueue watcher (immediate: true) already syncs playlist to native
      setupNativeAudioListeners()
      await initCanFetchCoverFromWeb()
      await audio.setUserAgent(USER_AGENT)
      await audio.setRepeatMode(playMode.value === 'repeatOne')
      initFlag.value = true
    }
  }

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
    applyDarkMode()
    localStorage.setItem('darkMode', String(darkMode.value))
  }

  function applyDarkMode() {
    if (darkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    SystemBar.setTheme({ mode: darkMode.value ? 'dark' : 'light' }).catch(() => {
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

  function setCurrentIndex(index: number) {
    playData.value.currentIndex = index
    audio.setCurrentIndex(index).then((r) => console.log(r))
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
  function initPlayQueue() {
    const obj = localStorage.getItem('playQueue')
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) playQueue.value = parsed
      else if (Array.isArray(parsed.data)) playQueue.value = parsed.data
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
    setAutoDelInvalidSongs,
    getAutoDelInvalidSongs,
    syncLanguageFromI18n,
    setLanguage,
    getLanguage,
    allSongs,
    setAllSongs,
    getAllSongs,
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
    searchResults,
    isLoading,
    searchError,
    hasSearched,
    search,
    resetSearch,
  }
})
