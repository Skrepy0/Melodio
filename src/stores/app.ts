import { usePlayerStore } from './player'
import { useThemeStore } from './theme'
import { useMusicClientStore } from './musicClient'
import { useSettingsStore } from './settings'
import { useDownloadsStore } from './downloads'
import { useSearchStore } from './search'

import { defineStore, storeToRefs } from 'pinia'

import { audio } from '@/utils/createAudio'

import { musicClients } from '@/config'

import { requestMediaPermissions } from '@/utils/permission'

import { runCoverMigration } from '@/utils/coverMigration'

export { MusicSigner, Downloader } from './native'
export type { WallpaperFit } from './theme'
export const useAppStore = defineStore('app', () => {
  const playerStore = usePlayerStore()
  const {
    playQueueRepeat,
    allSongs,
    playQueue,
    homeFlag,
    initFlag,
    playbackRate,
    playData,
    playMode,
    currentSong,
  } = storeToRefs(playerStore)
  const {
    getFirstPlayFlag,
    markFirstPlayFlag,
    initBlacklist,
    getBlacklist,
    setBlacklist,
    addToBlacklist,
    initCanFetchCoverFromWeb,
    setCanFetchCoverFromWeb,
    getCanFetchCoverFromWeb,
    initPlayQueueRepeat,
    setPlayQueueRepeat,
    getPlayQueueRepeat,
    setSelectedCategory,
    getSelectedCategory,
    setCurrentPlayList,
    getCurrentPlayList,
    setToBeSortedSongListIndex,
    getToBeSortedSongListIndex,
    setupAudioListener,
    setupWebViewRendererKilledListener,
    initPlayMode,
    setPlayMode,
    getPlayMode,
    addSongList,
    setSongListById,
    setSongListDataById,
    delectSongListById,
    getSongLists,
    saveSongLists,
    setSongLists,
    mergeSongLists,
    initSongLists,
    setupNativeAudioListeners,
    setupPersistenceListeners,
    reconcilePlaybackState,
    playIndex,
    togglePlay,
    nextSong,
    prevSong,
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
    setIsSwitchingSong,
    getIsSwitchingSong,
    setLikeListData,
    mergeLikeListData,
    getLikeList,
    setCurrentPlayListIndex,
    getCurrentPlayListIndex,
    setHomeFlag,
    getHomeFlag,
    setInitFlag,
    getInitFlag,
    initAllSongs,
    initPlayQueue,
    initPlayData,
    initPlaybackRate,
    setPlaybackRate,
    initLikeList,
    initCurrentPlayListIndex,
  } = playerStore

  const themeStore = useThemeStore()
  const { darkMode, wallpaper } = storeToRefs(themeStore)
  const {
    initThemeColor,
    setThemeColor,
    getThemeColor,
    setWallpaper,
    removeWallpaper,
    getWallpaper,
    initWallpaper,
    setWallpaperTransparency,
    getWallpaperTransparency,
    setWallpaperBlur,
    getWallpaperBlur,
    setWallpaperFit,
    getWallpaperFit,
    toggleDarkMode,
    loadInitialDarkMode,
  } = themeStore

  const musicClientStore = useMusicClientStore()

  const {
    initMusicClientLimitation,
    getMusicClientLimitation,
    setMusicClientLimitation,
    initMusicClientStatus,
    getMusicClientStatus,
    setMusicClientStatus,
    setClients,
    getEnabledClients,
  } = musicClientStore

  const settingsStore = useSettingsStore()
  const { isI18nReady } = storeToRefs(settingsStore)
  const {
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
  } = settingsStore

  const downloadsStore = useDownloadsStore()
  const { downloadTasks, downloadHistory } = storeToRefs(downloadsStore)
  const {
    getDownloadTasks,
    getActiveDownloadTasks,
    getDownloadHistory,
    upsertDownloadTask,
    setDownloadTaskProgress,
    setDownloadTaskStatus,
    removeDownloadTask,
    appendDownloadHistory,
    clearDownloadHistory,
    initDownloadTasks,
    initDownloadHistory,
  } = downloadsStore

  const searchStore = useSearchStore()
  const { searchKeyword, searchResults, searchHistory, isLoading, searchError, hasSearched } =
    storeToRefs(searchStore)
  const {
    pushSearchHistory,
    removeSearchHistoryItem,
    clearSearchHistory,
    search,
    resetSearch,
    initSearchHistory,
  } = searchStore

  function initSettings() {
    initLyricsRetryCount()
    initShowLyrics()
    initSearchLyricsOnline()
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
