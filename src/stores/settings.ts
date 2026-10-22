import {
  configureNativeLyrics,
  DEFAULT_LYRICS_RETRY_COUNT,
  normalizeLyricsRetryCount,
} from '@/utils/lyrics'

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { audio } from '@/utils/createAudio'

import { i18n } from '@/i18n'

const SUPPORTED_LOCALES = ['zh-CN', 'en-US']

function getSystemLanguage(): string {
  const browserLang = navigator.language
  if (SUPPORTED_LOCALES.includes(browserLang)) return browserLang
  const prefix = browserLang.split('-')[0]
  if (prefix === 'zh') return 'zh-CN'
  return 'en-US'
}

export const useSettingsStore = defineStore('settings', () => {
  const lyricsRetryCount = ref(
    normalizeLyricsRetryCount(
      Number(localStorage.getItem('lyricsRetryCount') ?? DEFAULT_LYRICS_RETRY_COUNT)
    )
  )

  const searchLyricsOnline = ref(localStorage.getItem('searchLyricsOnline') !== 'false')

  const showLyrics = ref(localStorage.getItem('showLyrics') !== 'false')

  watch(
    [showLyrics, searchLyricsOnline, lyricsRetryCount],
    ([enabled, online, retryCount]) => {
      void configureNativeLyrics({ enabled, online, retryCount }).catch((error) =>
        console.warn('Native lyrics settings failed', error)
      )
    },
    { immediate: true }
  )

  const pinyinSearch = ref(localStorage.getItem('pinyinSearch') === 'true')

  const autoPauseOnDisconnect = ref(true)

  const autoPlayOnConnect = ref(false)

  const autoDelInvalidSongs = ref(true)

  const currentLanguage = ref('zh-CN')

  const isI18nReady = ref(false)

  const audioFocusPause = ref(true)

  const fetchTimeOut = ref<number>(30)

  const eachSongAveTimeOut = ref<number>(10)

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

  function getAutoPauseOnDisconnect() {
    return autoPauseOnDisconnect.value
  }

  function getAutoPlayOnConnect() {
    return autoPlayOnConnect.value
  }

  function initLyricsRetryCount() {
    lyricsRetryCount.value = normalizeLyricsRetryCount(
      Number(localStorage.getItem('lyricsRetryCount') ?? DEFAULT_LYRICS_RETRY_COUNT)
    )
  }

  function getLyricsRetryCount() {
    return lyricsRetryCount.value
  }

  function setLyricsRetryCount(value: number) {
    lyricsRetryCount.value = normalizeLyricsRetryCount(value)
    localStorage.setItem('lyricsRetryCount', String(lyricsRetryCount.value))
  }

  function initSearchLyricsOnline() {
    searchLyricsOnline.value = localStorage.getItem('searchLyricsOnline') !== 'false'
  }

  function getSearchLyricsOnline() {
    return searchLyricsOnline.value
  }

  function setSearchLyricsOnline(val: boolean) {
    searchLyricsOnline.value = val
    localStorage.setItem('searchLyricsOnline', String(val))
  }

  function initShowLyrics() {
    showLyrics.value = localStorage.getItem('showLyrics') !== 'false'
  }

  function getShowLyrics() {
    return showLyrics.value
  }

  function setShowLyrics(val: boolean) {
    showLyrics.value = val
    localStorage.setItem('showLyrics', String(val))
  }

  function setPinyinSearch(val: boolean) {
    pinyinSearch.value = val
    localStorage.setItem('pinyinSearch', String(pinyinSearch.value))
  }

  function getPinyinSearch() {
    return pinyinSearch.value
  }
  return {
    lyricsRetryCount,
    searchLyricsOnline,
    showLyrics,
    pinyinSearch,
    autoPauseOnDisconnect,
    autoPlayOnConnect,
    autoDelInvalidSongs,
    currentLanguage,
    isI18nReady,
    audioFocusPause,
    fetchTimeOut,
    eachSongAveTimeOut,
    initEachSongAveTimeOut,
    getEachSongAveTimeOut,
    setEachSongAveTimeOut,
    initFetchTimeOut,
    getFetchTimeOut,
    setFetchTimeOut,
    initLanguage,
    getLanguage,
    setLanguage,
    syncLanguageFromI18n,
    initAutoDelInvalidSongs,
    setAutoDelInvalidSongs,
    getAutoDelInvalidSongs,
    initAudioFocusPause,
    setAudioFocusPause,
    getAudioFocusPause,
    initAutoPauseOnDisconnect,
    initAutoPlayOnConnect,
    setAutoPauseOnDisconnect,
    setAutoPlayOnConnect,
    getAutoPauseOnDisconnect,
    getAutoPlayOnConnect,
    initLyricsRetryCount,
    getLyricsRetryCount,
    setLyricsRetryCount,
    initSearchLyricsOnline,
    getSearchLyricsOnline,
    setSearchLyricsOnline,
    initShowLyrics,
    getShowLyrics,
    setShowLyrics,
    setPinyinSearch,
    getPinyinSearch,
  }
})
