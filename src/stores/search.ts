import { OnlineSong } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { parseSearchError } from '@/utils/functions'

import { MusicSigner } from './native'

export const useSearchStore = defineStore('search', () => {
  // 搜索
  const searchKeyword = ref<string>('')

  const searchResults = ref<OnlineSong[]>([])

  const searchHistory = ref<string[]>(JSON.parse(localStorage.getItem('searchHistory') || '[]'))

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

  const pushSearchHistory = (keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) return
    const next = [normalized, ...searchHistory.value.filter((item) => item !== normalized)].slice(
      0,
      20
    )
    searchHistory.value = next
    localStorage.setItem('searchHistory', JSON.stringify(next))
  }

  const removeSearchHistoryItem = (keyword: string) => {
    const next = searchHistory.value.filter((item) => item !== keyword)
    searchHistory.value = next
    localStorage.setItem('searchHistory', JSON.stringify(next))
  }

  const clearSearchHistory = () => {
    searchHistory.value = []
    localStorage.setItem('searchHistory', JSON.stringify([]))
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
    pushSearchHistory(keyword)

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

  function initSearchHistory() {
    const obj = localStorage.getItem('searchHistory')
    if (!obj) return
    try {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) searchHistory.value = parsed
      else if (Array.isArray(parsed.data)) searchHistory.value = parsed.data
    } catch (e) {
      console.error(e)
    }
  }
  return {
    searchKeyword,
    searchResults,
    searchHistory,
    isLoading,
    searchError,
    hasSearched,
    addUniqueSongs,
    pushSearchHistory,
    removeSearchHistoryItem,
    clearSearchHistory,
    cleanupSearch,
    search,
    resetSearch,
    initSearchHistory,
  }
})
