import { Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { playData } from '@/utils/interface'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl } from '@/utils/functions'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') || false)
  const allSongs = ref<Song[]>([])
  const playQueue = ref<Song[]>([])
  const homeFlag = ref(false)
  function getHomeFlag() {
    return homeFlag.value
  }
  function setHomeFlag(val: boolean) {
    homeFlag.value = val
  }
  const initFlag = ref(false)
  function setInitFlag(val: boolean) {
    initFlag.value = val
  }
  function getInitFlag() {
    return initFlag.value
  }
  async function init() {
    if (!initFlag.value) {
      loadInitialDarkMode()
      initAllSongs()
      initPlayQueue()
      initPlayData()
      const playData = getPlayData()
      const currentSong = getPlayQueue()[playData.currentIndex]
      const playUri = currentSong?.uri || ''
      if (playUri !== audio.src) {
        await audio.setSrc(getAccessibleUrl(playUri))
      }
      if (playData.isPlaying) {
        setIsPlaying(false)
      }
      audio.setSong(currentSong)
      initFlag.value = true
    }
  }
  function toggleDarkMode() {
    darkMode.value = !darkMode.value
    if (darkMode.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(darkMode.value))
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
  function setAllSongs(songs: Song[]) {
    if (allSongs.value === songs) return
    allSongs.value = songs
    saveAllSongs()
  }
  function getAllSongs() {
    return allSongs.value
  }
  function saveAllSongs() {
    localStorage.setItem(
      'allSongs',
      JSON.stringify({
        data: allSongs.value,
      })
    )
  }
  function initAllSongs() {
    const obj = localStorage.getItem('allSongs')
    if (obj && JSON.parse(obj).data) {
      allSongs.value = JSON.parse(obj).data
    }
  }
  function initPlayQueue() {
    const obj = localStorage.getItem('playQueue')
    if (obj && JSON.parse(obj).data) {
      playQueue.value = JSON.parse(obj).data
    }
  }
  function savePlayQueue() {
    localStorage.setItem('playQueue', JSON.stringify({ data: playQueue.value }))
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

  const playData = ref<playData>({
    currentIndex: 0,
    isPlaying: false,
    mockCurrentTime: 0,
  })
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
  function initPlayData() {
    const obj = localStorage.getItem('playData')
    if (obj) {
      try {
        const data = JSON.parse(obj)
        playData.value.currentIndex = data.currentIndex ?? 0
        playData.value.isPlaying = data.isPlaying ?? false
        playData.value.mockCurrentTime = data.mockCurrentTime ?? 0
      } catch (e) {
        console.error('解析 playData 失败', e)
      }
    }
  }
  function setPlayData(obj: playData) {
    playData.value.currentIndex = obj.currentIndex
    playData.value.isPlaying = obj.isPlaying
    playData.value.mockCurrentTime = obj.mockCurrentTime
    savePlayData()
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
    console.log('修改时间:' + val)
    playData.value.mockCurrentTime = val
    savePlayData()
  }
  function getPlayData() {
    return playData.value
  }
  return {
    homeFlag,
    setHomeFlag,
    getHomeFlag,
    initFlag,
    setInitFlag,
    getInitFlag,
    darkMode,
    init,
    toggleDarkMode,
    loadInitialDarkMode,

    allSongs,
    setAllSongs,
    getAllSongs,
    initAllSongs,
    saveAllSongs,

    playQueue,
    setPlayQueue,
    getPlayQueue,
    savePlayQueue,
    addToQueue,

    playData,
    initPlayData,
    savePlayData,
    setPlayData,

    setMockCurrentTime,
    setIsPlaying,
    setCurrentIndex,
    getPlayData,
    addListToQueue,
  }
})
