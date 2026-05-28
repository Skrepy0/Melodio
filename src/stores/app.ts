import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') || false)

  function init() {
    loadInitialDarkMode()
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

  return {
    darkMode,
    init,
    toggleDarkMode,
    loadInitialDarkMode,
  }
})
