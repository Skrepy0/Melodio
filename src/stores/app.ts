import { Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { playData } from '@/utils/interface'
import { audio } from '@/utils/createAudio'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') || false)
  const allSongs = ref<Song[]>([])
  const playQueue = ref<Song[]>([])
  const initFlag = ref(false)
  function setInitFlag(val: boolean) {
    initFlag.value = val
  }
  function getInitFlag() {
    return initFlag.value
  }
  function init() {
    if (!initFlag.value) {
      loadInitialDarkMode()
      initAllSongs()
      initPlayQueue()
      initPlayData()
      const playData = getPlayData()
      const currentSong = getPlayQueue()[playData.currentIndex]
      const playUri = currentSong?.uri || ''
      if (playUri !== audio.src) {
        audio.setSrc(playUri)
      }
      audio.seek(playData.mockCurrentTime)
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

  const playData = ref<playData>({
    currentIndex: 0,
    isPlaying: false,
    mockCurrentTime: 0,
  })
  function savePlayData() {
    localStorage.setItem('playData', JSON.stringify(playData))
  }
  function initPlayData() {
    const obj = localStorage.getItem('playData') || '{}'
    const data = JSON.parse(obj)
    if (data.isPlaying) {
      playData.value = data
    }
  }
  function setPlayData(obj: playData) {
    if (playData.value === obj) return
    playData.value = obj
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
    playData.value.mockCurrentTime = val
    savePlayData()
  }
  function getPlayData() {
    return playData.value
  }
  return {
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
  }
})
