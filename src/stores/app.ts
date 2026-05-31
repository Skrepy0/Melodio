import { Playlist, PlayMode, Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { audio } from '@/utils/createAudio'
import { checkPlayableUrl, getAccessibleUrl } from '@/utils/functions'
import { getNextSongIndex, getPrevSongIndex } from '@/utils/control'
import toast from '@/utils/createToast'
import { i18n } from '@/i18n'
const SUPPORTED_LOCALES = ['zh-CN', 'en-US']
function getSystemLanguage(): string {
  const browserLang = navigator.language
  if (SUPPORTED_LOCALES.includes(browserLang)) {
    return browserLang
  }
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
    if (isValidMode(mode)) {
      playMode.value = mode
    }
  }
  const isSwitchingSong = ref(false)

  const likeList = ref<Playlist>({
    id: 0,
    name: '喜欢',
    description: '我喜欢',
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
    localStorage.setItem(
      'songLists',
      JSON.stringify({
        data: songLists.value,
      })
    )
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
      if (Array.isArray(parsed.data)) {
        songLists.value = parsed.data
      }
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
        name: '喜欢',
        description: '我喜欢',
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

  async function loadCurrentSong() {
    const song = currentSong.value
    if (!song) return
    try {
      setMockCurrentTime(0)
      audio.setSong(song)
      const accessibleUrl = getAccessibleUrl(song.uri)
      if (audio.src !== accessibleUrl) {
        audio.src = accessibleUrl
      }
      if (playData.value.isPlaying) {
        await audio.play()
      }
    } catch (e) {
      console.error('加载歌曲失败:', e)
    }
  }

  async function nextSong() {
    if (isSwitchingSong.value) return
    isSwitchingSong.value = true
    const queueLen = playQueue.value.length
    const req = getNextSongIndex(playData.value.currentIndex, queueLen)
    if (req.meg === 'error') {
      isSwitchingSong.value = false
      return
    }
    playData.value.currentIndex = req.idx
    await loadCurrentSong()
    let flag = false
    if (playData.value.isPlaying) {
      flag = true
      togglePlay()
    }
    savePlayData()
    setTimeout(() => {
      isSwitchingSong.value = false
    }, 100)
    if (flag) {
      setTimeout(() => {
        togglePlay()
      }, 350)
    }
  }

  async function prevSong() {
    if (isSwitchingSong.value) return
    isSwitchingSong.value = true
    const queueLen = playQueue.value.length
    const req = getPrevSongIndex(playData.value.currentIndex, queueLen)
    if (req.meg === 'error') {
      isSwitchingSong.value = false
      return
    }
    playData.value.currentIndex = req.idx
    await loadCurrentSong()
    let flag = false
    if (playData.value.isPlaying) {
      flag = true
      togglePlay()
    }
    savePlayData()
    setTimeout(() => {
      isSwitchingSong.value = false
    }, 100)
    if (flag) {
      setTimeout(() => {
        togglePlay()
      }, 500)
    }
  }

  async function togglePlay() {
    let currentSong = playQueue.value[playData.value.currentIndex]
    if (!currentSong) {
      toast.warning('播放队列为空')
      return
    }

    const url = getAccessibleUrl(currentSong.uri)
    const isValid = await checkPlayableUrl(url).catch(() => false)

    if (!isValid) {
      const invalidSongId = currentSong.id

      if (autoDelInvalidSongs.value) {
        const newLikeData = likeList.value.data.filter((s) => s.id !== invalidSongId)
        setLikeListData(newLikeData)

        const newSongLists = songLists.value.map((list) => ({
          ...list,
          data: list.data.filter((s) => s.id !== invalidSongId),
        }))
        setSongLists(newSongLists)

        const newQueue = playQueue.value.filter((s) => s.id !== invalidSongId)
        setPlayQueue(newQueue)

        if (newQueue.length === 0) {
          setCurrentIndex(0)
          setIsPlaying(false)
          await audio.pause()
          toast.warning('当前歌曲已失效，队列已清空')
          return
        } else {
          let newIndex = playData.value.currentIndex
          const removedIdx = playQueue.value.findIndex((s) => s.id === invalidSongId)
          if (removedIdx <= newIndex && newIndex > 0) newIndex--
          if (newIndex >= newQueue.length) newIndex = newQueue.length - 1
          setCurrentIndex(newIndex)
          currentSong = newQueue[newIndex]
          toast.warning('歌曲已失效，已自动跳过，正在播放下一首')
        }
      } else {
        const newQueue = playQueue.value.filter((s) => s.id !== invalidSongId)
        setPlayQueue(newQueue)

        if (newQueue.length === 0) {
          setCurrentIndex(0)
          setIsPlaying(false)
          await audio.pause()
          toast.warning('当前歌曲已失效，队列已清空')
          return
        } else {
          nextSong()
          toast.warning('歌曲已失效，已从队列中移除，正在播放下一首')
          togglePlay()
          setTimeout(() => {
            togglePlay()
          }, 100)
        }
      }
    }

    try {
      if (playData.value.isPlaying) {
        await audio.pause()
        playData.value.isPlaying = false
      } else {
        if (audio.src !== url) {
          await loadCurrentSong()
        } else {
          await audio.play()
        }
        playData.value.isPlaying = true
      }
      savePlayData()
    } catch (err) {
      console.error('播放控制失败', err)
      toast.error('播放失败，请检查网络或文件权限')
    }
  }

  let endedListenerRegistered = false
  function initGlobalPlayerEvents() {
    if (endedListenerRegistered) return
    audio.addEventListener('ended', () => {
      if (!isSwitchingSong.value) {
        if (playMode.value === 'repeatOne') {
          togglePlay()
          setTimeout(() => {
            togglePlay()
          }, 100)
        } else {
          if (!playData.value.isPlaying) {
            togglePlay()
          }
          nextSong()
        }
      }
    })
    endedListenerRegistered = true
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
      if (Array.isArray(parsed.data)) {
        allSongs.value = parsed.data
      }
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
        playData.value.isPlaying = false //默认关闭
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
        const data = JSON.parse(obj)
        likeList.value = { ...likeList.value, ...data }
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

  async function init() {
    if (!initFlag.value) {
      initLanguage()
      loadInitialDarkMode()
      initAutoPauseOnDisconnect()
      initAutoDelInvalidSongs()
      initAllSongs()
      initPlayQueue()
      initPlayData()
      initCurrentPlayListIndex()
      initLikeList()
      initSongLists()
      initPlayMode()
      const current = currentSong.value
      initGlobalPlayerEvents()
      setupAudioBecomingNoisyListener()
      initFlag.value = true
      if (current) {
        audio.setSong(current)
        //const time = playData.value.mockCurrentTime
        const url = getAccessibleUrl(current.uri)
        if (audio.src !== url) {
          audio.src = url
        }

        // if (time !== 0) {
        //   setTimeout( () => {
        //     togglePlay()
        //     setTimeout(() => {
        //       togglePlay()
        //     }, 100)
        //     setMockCurrentTime(time)
        //     audio.seek(time)
        //   }, 500)
        // }
      }
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
    audio.updateMediaSessionMetadata(playQueue.value[index])
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
    loadCurrentSong,
    initGlobalPlayerEvents,
    init,
    // 切换锁
    setIsSwitchingSong,
    getIsSwitchingSong,
    // 设置
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
    // 歌曲库
    allSongs,
    setAllSongs,
    getAllSongs,
    // 播放队列操作
    setPlayQueue,
    getPlayQueue,
    addToQueue,
    addListToQueue,
    // 播放数据操作（兼容旧接口）
    setCurrentIndex,
    setIsPlaying,
    setMockCurrentTime,
    getPlayData,
    // 喜欢列表
    getLikeList,
    setLikeListData,
    mergeLikeListData,
    // 播放列表索引
    getCurrentPlayListIndex,
    setCurrentPlayListIndex,
    // 标志位
    homeFlag,
    setHomeFlag,
    getHomeFlag,
    initFlag,
    setInitFlag,
    getInitFlag,
  }
})
