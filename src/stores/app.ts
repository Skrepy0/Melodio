import { Playlist, Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl } from '@/utils/functions'
import { getNextSongIndex, getPrevSongIndex } from '@/utils/control'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') === 'true')
  const allSongs = ref<Song[]>([])
  const playQueue = ref<Song[]>([])
  const homeFlag = ref(false)
  const initFlag = ref(false)

  const playData = ref({
    currentIndex: 0,
    isPlaying: false,
    mockCurrentTime: 0,
  })

  const playMode = ref<'sequential' | 'repeatOne' | 'shuffle'>('sequential')

  const isSwitchingSong = ref(false)

  const likeList = ref<Playlist>({
    id: 0,
    name: '喜欢',
    description: '我喜欢',
    coverUrl: '',
    songCount: 0,
    data: [],
  })

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
      }, 500)
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
    if (playData.value.isPlaying) {
      await audio.pause()
      playData.value.isPlaying = false
    } else {
      await loadCurrentSong() // 确保歌曲已加载
      await audio.play()
      playData.value.isPlaying = true
    }
    savePlayData()
  }

  let endedListenerRegistered = false
  function initGlobalPlayerEvents() {
    if (endedListenerRegistered) return
    audio.addEventListener('ended', () => {
      if (!isSwitchingSong.value) {
        nextSong()
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

  // ==================== 应用启动时完整初始化 ====================
  async function init() {
    if (!initFlag.value) {
      loadInitialDarkMode()
      initAllSongs()
      initPlayQueue()
      initPlayData()
      initCurrentPlayListIndex()
      initLikeList()
      // 恢复当前歌曲的音频状态
      const current = currentSong.value
      if (current) {
        const url = getAccessibleUrl(current.uri)
        if (audio.src !== url) {
          audio.src = url
        }
        if (playData.value.mockCurrentTime > 0) {
          await audio.seek(playData.value.mockCurrentTime)
        }
        if (playData.value.isPlaying) {
          await audio.play()
        } else {
          audio.pause()
        }
        audio.setSong(current)
      }
      // 注册全局 ended 事件
      initGlobalPlayerEvents()
      initFlag.value = true
    }
  }

  // ==================== 其他 setter / getter（保持原有接口） ====================
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

  // ==================== 导出所有公开 API ====================
  return {
    // 播放核心
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
    // 主题
    darkMode,
    toggleDarkMode,
    loadInitialDarkMode,
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
