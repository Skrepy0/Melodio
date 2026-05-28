import { Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') || false)

  const allSongs = ref<Song[]>([])
  const playQueue = ref<Song[]>([])
  function init() {
    loadInitialDarkMode()
    initAllSongs()
    initPlayQueue()
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

  return {
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
  }
})
