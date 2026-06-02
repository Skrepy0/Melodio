import { Playlist, PlayMode, Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl, resolveCoverUrl } from '@/utils/functions'
import toast from '@/utils/createToast'
import { i18n } from '@/i18n'
import type { SongItem } from '@/plugins/native-audio/definitions'

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

  function initCanFetchCoverFromWeb() {
    const storage = localStorage.getItem('canFetchCoverFromWeb') || ''
    if (['true', 'false'].includes(storage)) {
      canFetchCoverFromWeb.value = storage === 'true'
    }
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
    localStorage.setItem('songLists', JSON.stringify({ data: songLists.value }))
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
      if (Array.isArray(parsed.data)) songLists.value = parsed.data
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
    localStorage.setItem('playQueue', JSON.stringify({ data: playQueue.value }))
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
    localStorage.setItem(
      'currentPlayListIndex',
      JSON.stringify({ data: currentPlayListIndex.value })
    )
  }

  const currentSong = computed(() => playQueue.value[playData.value.currentIndex] || null)

  const songsForPlugin = ref<SongItem[]>([])

  watch(
    playQueue,
    async (newQueue) => {
      const list = await Promise.all(
        newQueue.map(async (s) => ({
          url: getAccessibleUrl(s.uri),
          title: s.title,
          artist: s.artist || 'Unknown',
          album: s.album || '',
          coverUrl: canFetchCoverFromWeb.value ? await resolveCoverUrl(s) : s.albumArtUri,
        }))
      )
      songsForPlugin.value = list
      await audio.setPlaylist(list)
    },
    { deep: true, immediate: true }
  )
  watch(
    playQueue,
    async () => {
      await audio.setPlaylist(songsForPlugin.value)
      if (playData.value.currentIndex >= playQueue.value.length) {
        playData.value.currentIndex = 0
        savePlayData()
      }
    },
    { deep: true }
  )
  watch(playMode, (newMode) => {
    audio.setRepeatMode(newMode === 'repeatOne')
  })
  watch(
    () => audio.paused,
    (newPaused) => {
      playData.value.isPlaying = !newPaused
    }
  )

  function setupNativeAudioListeners() {
    audio.addEventListener('songChanged', (data: { index: number }) => {
      playData.value.currentIndex = data.index
      playData.value.isPlaying = true
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
      playData.value.isPlaying = false
      savePlayData()
      return
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
    if (isSwitchingSong.value || playQueue.value.length === 0) return
    isSwitchingSong.value = true
    const nextIndex = (playData.value.currentIndex + 1) % playQueue.value.length
    console.log('[Store] nextSong: playing index=', nextIndex)
    await audio.playIndex(nextIndex)
    playData.value.currentIndex = nextIndex
    playData.value.isPlaying = true
    savePlayData()
    setTimeout(() => {
      isSwitchingSong.value = false
    }, 100)
  }

  async function prevSong() {
    if (isSwitchingSong.value || playQueue.value.length === 0) return
    isSwitchingSong.value = true
    const prevIndex =
      (playData.value.currentIndex - 1 + playQueue.value.length) % playQueue.value.length
    console.log('[Store] prevSong: playing index=', prevIndex)
    await audio.playIndex(prevIndex)
    playData.value.currentIndex = prevIndex
    playData.value.isPlaying = true
    savePlayData()
    setTimeout(() => {
      isSwitchingSong.value = false
    }, 100)
  }

  async function init() {
    if (!initFlag.value) {
      initLanguage()
      loadInitialDarkMode()
      initAutoPauseOnDisconnect()
      initAutoDelInvalidSongs()
      initCanFetchCoverFromWeb()
      initAllSongs()
      initPlayQueue()
      initPlayData()
      initCurrentPlayListIndex()
      initLikeList()
      initSongLists()
      initPlayMode()
      setupAudioBecomingNoisyListener()
      await audio.setPlaylist(songsForPlugin.value)
      setupNativeAudioListeners()
      await audio.setRepeatMode(playMode.value === 'repeatOne')
      initFlag.value = true
    }
  }

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
    if (darkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('darkMode', String(darkMode.value))
  }

  function setAllSongs(songs: Song[]) {
    allSongs.value = songs
    localStorage.setItem('allSongs', JSON.stringify({ data: songs }))
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
    audio.setCurrentIndex(index)
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
      document.documentElement.classList.add('dark')
    } else if (saved === 'false') {
      darkMode.value = false
      document.documentElement.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      darkMode.value = prefersDark
      if (prefersDark) document.documentElement.classList.add('dark')
    }
  }

  function initAllSongs() {
    const obj = localStorage.getItem('allSongs')
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed.data)) allSongs.value = parsed.data
    }
  }
  function initPlayQueue() {
    const obj = localStorage.getItem('playQueue')
    if (obj) {
      try {
        playQueue.value = JSON.parse(obj).data || []
      } catch (e) {
        console.error(e)
      }
    }
  }
  function initPlayData() {
    const obj = localStorage.getItem('playData')
    if (obj) {
      try {
        const data = JSON.parse(obj)
        playData.value.currentIndex = data.currentIndex ?? 0
        playData.value.isPlaying = false // 默认不自动播放
        playData.value.mockCurrentTime = data.mockCurrentTime ?? 0
      } catch (e) {
        console.error(e)
      }
    }
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
        currentPlayListIndex.value = JSON.parse(obj).data ?? 0
      } catch (e) {
        console.error(e)
      }
    } else {
      currentPlayListIndex.value = 0
    }
  }
  async function loadCurrentSong() {}

  return {
    isI18nReady,
    initLanguage,
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
    loadCurrentSong,
    setToBeSortedSongListIndex,
    getToBeSortedSongListIndex,
    setCanFetchCoverFromWeb,
    getCanFetchCoverFromWeb,
  }
})
