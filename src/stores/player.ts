import { useSettingsStore } from './settings'

import { Playlist, PlayMode, Song } from '@/utils/interface'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { audio, getEmbeddedCover } from '@/utils/createAudio'
import {
  fetchCoverFromWeb,
  getAccessibleUrl,
  getCachedCover,
  getNativeCoverUrl,
} from '@/utils/functions'
import { lookupCoverUrl } from '@/utils/coverCache'
import toast from '@/utils/createToast'

import { App } from '@capacitor/app'

export const usePlayerStore = defineStore('player', () => {
  const settings = useSettingsStore()

  const { getAutoPauseOnDisconnect, getAutoPlayOnConnect } = settings

  const playQueueRepeat = ref(true)

  const canFetchCoverFromWeb = ref(true)

  const blacklist = ref<Song[]>([])

  const firstPlayFlag = ref(false)

  function getFirstPlayFlag() {
    return firstPlayFlag.value
  }

  function markFirstPlayFlag() {
    firstPlayFlag.value = true
  }

  function initBlacklist() {
    const obj = localStorage.getItem('blacklist')
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) blacklist.value = parsed
      else if (Array.isArray(parsed.data)) blacklist.value = parsed.data
    }
  }

  function getBlacklist() {
    return blacklist.value
  }

  function setBlacklist(val: Song[]) {
    blacklist.value = val
    saveBlacklist()
  }

  function saveBlacklist() {
    localStorage.setItem('blacklist', JSON.stringify(blacklist.value))
  }

  function addToBlacklist(val: Song) {
    blacklist.value.push(val)
    saveBlacklist()
  }

  async function initCanFetchCoverFromWeb() {
    const storage = localStorage.getItem('canFetchCoverFromWeb') || ''
    if (['true', 'false'].includes(storage)) {
      canFetchCoverFromWeb.value = storage === 'true'
    }
  }

  async function setCanFetchCoverFromWeb(val: boolean) {
    canFetchCoverFromWeb.value = val
    localStorage.setItem('canFetchCoverFromWeb', String(canFetchCoverFromWeb.value))
    if (playQueue.value.length === 0) return
    if (val) {
      // Pick up web artwork for the current queue now that it is allowed.
      void resolveQueueCovers(playQueue.value, updateVersion)
    } else {
      coverLookupAbort?.abort()
      coverLookupAbort = null
      // Drop any web URL that was previously handed to the native player.
      void audio.setPlaylist(await buildNativePlaylist(playQueue.value))
    }
  }

  function getCanFetchCoverFromWeb() {
    return canFetchCoverFromWeb.value
  }

  function initPlayQueueRepeat() {
    const val = localStorage.getItem('playQueueRepeat')
    if (val && ['true', 'false'].includes(val)) {
      playQueueRepeat.value = val === 'true'
    } else {
      setPlayQueueRepeat(true)
    }
  }

  function setPlayQueueRepeat(val: boolean) {
    playQueueRepeat.value = val
    localStorage.setItem('playQueueRepeat', String(playQueueRepeat.value))
    audio.setPlayQueueRepeat(val)
  }

  function getPlayQueueRepeat() {
    return playQueueRepeat.value
  }

  const selectedCategory = ref('tracks')

  const allSongs = ref<Song[]>([])

  const playQueue = ref<Song[]>([])

  const homeFlag = ref(false)

  const initFlag = ref(false)

  const currentPlayList = ref<number>(-1)

  const currentToBeSortedSongList = ref<number>(-1)

  const playbackRate = ref(1.0)

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

  function setupAudioListener() {
    window.addEventListener('audioBecomingNoisy', () => {
      console.log('[Store] 收到音频输出设备断开事件，自动暂停')
      if (getAutoPauseOnDisconnect() && playData.value.isPlaying) {
        togglePlay().then()
      }
    })
    window.addEventListener('audioConnected', () => {
      console.log('[Store] 收到音频输出设备连接事件，自动播放')
      if (getAutoPlayOnConnect() && !playData.value.isPlaying) {
        togglePlay().then()
      }
    })
  }

  /**
   * Listen for WebView renderer being killed (e.g., when app is in background
   * and Android reclaims memory). When this happens, the WebView is destroyed
   * and the app will be reloaded when the user returns.
   */
  function setupWebViewRendererKilledListener() {
    window.addEventListener('webviewRendererKilled', () => {
      console.log('[Store] WebView renderer was killed by system (likely app was in background)')
      // The native WebView has been destroyed. Stop sending UI updates to avoid
      // "Application attempted to call on a destroyed WebView" errors.
      // The native side will trigger a reload when the app resumes.
      webViewMayBeDestroyed.value = true
    })
  }

  const webViewMayBeDestroyed = ref(false)

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

  let switchPromise: Promise<void> | null = null

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
    try {
      localStorage.setItem('songLists', JSON.stringify(songLists.value))
    } catch (error) {
      // Uploaded covers are stored inline; if storage is full keep the in-memory
      // state usable instead of throwing into the caller.
      console.error('保存播放列表失败:', error)
    }
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
    if (!obj) return
    try {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) songLists.value = parsed
      else if (Array.isArray(parsed.data)) songLists.value = parsed.data
    } catch (e) {
      console.error('歌单数据解析失败', e)
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
    localStorage.setItem('playQueue', JSON.stringify(playQueue.value))
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
    localStorage.setItem('currentPlayListIndex', JSON.stringify(currentPlayListIndex.value))
  }

  const currentSong = computed(() => playQueue.value[playData.value.currentIndex] || null)

  // 播放队列更新
  let updateVersion = 0

  let coverLookupAbort: AbortController | null = null

  /** How many queue entries to look up online per sync (current song first). */
  const MAX_QUEUE_COVER_LOOKUPS = 6

  async function buildNativePlaylist(queue: Song[]) {
    const allowWeb = canFetchCoverFromWeb.value
    return Promise.all(
      queue.map(async (s) => ({
        url: getAccessibleUrl(s.uri),
        title: s.title,
        artist: s.artist || 'Unknown',
        album: s.album || '',
        lyric: s.lyric,
        duration: s.duration,
        // Native cannot decode albumart URIs. `resolveNativeCoverUrl` hands over
        // a real file/data/https URL: web cache first, then the stored
        // file:/data: reference, then the artwork extracted from the audio file.
        coverUrl: await resolveNativeCoverUrl(s, allowWeb),
      }))
    )
  }

  /**
   * 每首歌已经解析出的本地封面路径（含从音频文件提取的内嵌封面）。
   * 空串表示“提取过但没有封面”，避免每次 buildNativePlaylist 都重复读文件。
   * 只缓存 local/embedded 结果；web 封面由 coverCache 自己缓存，且优先级更高。
   */
  const nativeLocalCoverCache = new Map<string, string>()

  /**
   * 原生侧封面解析。Android 通知栏的 BitmapFactory 无法解码 MediaStore 的
   * `content://.../albumart/...` URI，所以这个引用永远不会原样透传。优先级：
   *
   *   1. 已命中 {@link coverCache} 的 web 封面（启用在线查询时）。
   *   2. 可直接使用的 `file:` / `data:` / `https:` 引用。
   *   3. 从音频文件提取的内嵌封面（按 song.id 缓存）。
   *
   * 全部失败返回 ''，由原生侧回退到默认图标。
   */
  async function resolveNativeCoverUrl(song: Song, allowWeb: boolean): Promise<string> {
    if (allowWeb) {
      const web = getCachedCover(song.title, song.artist || '')
      if (web) return web
    }

    const local = (song.albumArtUri || '').trim()
    if (local && !local.startsWith('content://')) return local

    if (nativeLocalCoverCache.has(song.id)) return nativeLocalCoverCache.get(song.id)!

    let path = ''
    try {
      const result = await getEmbeddedCover(song.uri, song.id)
      path = typeof result === 'string' ? result : result?.path || ''
    } catch {
      path = ''
    }
    nativeLocalCoverCache.set(song.id, path)
    return path
  }

  /**
   * Resolve covers for tracks that have no embedded artwork, nearest to the
   * current song first, then push the updated playlist to the native player.
   * This is what lets the notification show a web cover without the native
   * side doing any lookup of its own.
   */
  async function resolveQueueCovers(queue: Song[], version: number) {
    coverLookupAbort?.abort()
    coverLookupAbort = null
    if (queue.length === 0) return

    const allowWeb = canFetchCoverFromWeb.value
    const current = playData.value.currentIndex
    const order = queue
      .map((_, index) => index)
      .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))

    // Stage 1: warm the native cover cache for the current track and its
    // neighbours. Native BitmapFactory cannot decode albumart URIs, so every
    // track without a directly-usable cover has its embedded artwork extracted.
    let anyResolved = false
    const warmup = order.slice(0, MAX_QUEUE_COVER_LOOKUPS)
    await Promise.all(
      warmup.map(async (index) => {
        if (version !== updateVersion) return
        try {
          const url = await resolveNativeCoverUrl(queue[index], allowWeb)
          if (url) anyResolved = true
        } catch {
          /* ignore */
        }
      })
    )
    if (version !== updateVersion) return

    // Stage 2: online lookup for tracks that still have no local cover.
    // `undefined` means "never looked up"; a cached miss (null) must not be
    // retried, or every offline start walks the provider chain again.
    if (allowWeb) {
      const pending = order
        .filter((index) => !nativeLocalCoverCache.get(queue[index].id))
        .filter(
          (index) => lookupCoverUrl(queue[index].title, queue[index].artist || '') === undefined
        )
        .slice(0, MAX_QUEUE_COVER_LOOKUPS)

      if (pending.length > 0) {
        const controller = new AbortController()
        coverLookupAbort = controller

        let webResolved = false
        for (const index of pending) {
          if (controller.signal.aborted || version !== updateVersion) return
          try {
            const url = await fetchCoverFromWeb(
              queue[index].title,
              queue[index].artist || '',
              controller.signal
            )
            if (url) webResolved = true
          } catch {
            // Offline or provider failure — the native side falls back to the icon.
          }
        }

        if (controller.signal.aborted || version !== updateVersion) return
        if (webResolved) anyResolved = true
      }
    }

    if (!anyResolved) return

    // Stage 3: rebuild the native playlist with the covers that resolved, then
    // refresh the current track so the notification picks up the new cover.
    await audio.setPlaylist(await buildNativePlaylist(queue))
    await audio.refreshCurrentMetadata()
  }

  watch(
    playQueue,
    async (newQueue) => {
      const currentVersion = ++updateVersion

      if (!newQueue.length) {
        coverLookupAbort?.abort()
        coverLookupAbort = null
        await audio.setPlaylist([])
        return
      }

      try {
        const playlistItems = await buildNativePlaylist(newQueue)

        // 检查版本号
        if (currentVersion !== updateVersion) return

        await audio.setPlaylist(playlistItems)

        // 修正索引
        if (playData.value.currentIndex >= playlistItems.length) {
          playData.value.currentIndex = 0
          savePlayData()
        }

        // Look up missing artwork in the background; playback starts with the
        // local cover (or the default icon) and the notification updates when
        // the web result arrives.
        void resolveQueueCovers(newQueue, currentVersion)
      } catch (error) {
        // 降级（极少发生，因为现在没有异步操作）
        console.error('构建播放列表失败', error)
        if (currentVersion !== updateVersion) return
        const fallbackList = newQueue.map((s) => ({
          url: s.uri,
          title: s.title,
          artist: s.artist || 'Unknown',
          album: s.album || '',
          lyric: s.lyric,
          duration: s.duration,
          coverUrl: getNativeCoverUrl(s, canFetchCoverFromWeb.value),
        }))
        await audio.setPlaylist(fallbackList)
        if (playData.value.currentIndex >= fallbackList.length) {
          playData.value.currentIndex = 0
          savePlayData()
        }
      }
    },
    { deep: true, immediate: true }
  )

  watch(playMode, (newMode) => {
    audio.setRepeatMode(newMode === 'repeatOne').then((r) => console.log('repeatOne', r))
  })

  /** Throttle for writing playback progress to localStorage. */
  const TIME_PERSIST_INTERVAL_MS = 5000

  let lastTimePersistAt = 0

  function setupNativeAudioListeners() {
    audio.addEventListener(
      'songChanged',
      (data: { index: number; isPlaying?: boolean; position?: number }) => {
        playData.value.currentIndex = data.index
        // The track index changed, so the old progress is meaningless — reset it
        // before persisting to avoid "new index + previous track's position".
        playData.value.mockCurrentTime =
          Number.isFinite(data.position) && (data.position as number) >= 0
            ? (data.position as number)
            : 0
        // A load does not imply playback (restore/prepare may leave it paused).
        playData.value.isPlaying = data.isPlaying ?? true
        savePlayData()
      }
    )
    audio.addEventListener('playStateChange' as any, (data: { isPlaying: boolean }) => {
      playData.value.isPlaying = data.isPlaying
      savePlayData()
    })
    audio.addEventListener('timeupdate', () => {
      playData.value.mockCurrentTime = audio.currentTime
      // Writing localStorage on every tick is wasteful; flush at most every
      // few seconds so a killed WebView still restores near the right spot.
      const now = Date.now()
      if (now - lastTimePersistAt >= TIME_PERSIST_INTERVAL_MS) {
        lastTimePersistAt = now
        savePlayData()
      }
    })
    audio.addEventListener('error', (data) => {
      console.error('[NativeAudio] Error', data)
      toast.error('播放出错')
    })
  }

  /** Flush everything needed to resume playback; safe to call synchronously. */
  function persistPlaybackSnapshot() {
    savePlayData()
    savePlayQueue()
  }

  /**
   * Persist on the way out: Capacitor's appStateChange fires before the process
   * is backgrounded/killed, and the page events cover WebView teardown.
   */
  function setupPersistenceListeners() {
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) persistPlaybackSnapshot()
      }).catch((e) => console.warn('[Store] appStateChange listener failed', e))
    } catch (e) {
      console.warn('[Store] appStateChange listener unavailable', e)
    }
    const flush = () => persistPlaybackSnapshot()
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  /**
   * After a WebView reload the native player may still be running with its own
   * track/position. Prefer that truth over the persisted snapshot.
   */
  async function reconcilePlaybackState() {
    try {
      const state = await audio.getState()
      if (!state || state.currentIndex < 0) return
      if (state.currentIndex >= playQueue.value.length) return
      playData.value.currentIndex = state.currentIndex
      playData.value.isPlaying = state.isPlaying
      if (Number.isFinite(state.currentPosition) && state.currentPosition >= 0) {
        playData.value.mockCurrentTime = state.currentPosition
      }
      savePlayData()
    } catch (e) {
      // Web / older native build: keep the persisted values.
      console.warn('[Store] getState unavailable', e)
    }
  }

  async function playIndex(index: number, autoPlay = true) {
    await audio.playIndex(index, playQueueRepeat.value, autoPlay)
  }

  async function togglePlay() {
    if (playQueue.value.length === 0) {
      toast.warning('播放队列为空')
      return
    }

    if (playData.value.isPlaying) {
      await audio.pause()
      // playStateChange event will update isPlaying; set locally for immediate UI feedback
      playData.value.isPlaying = false
      savePlayData()
      return
    }

    // Try to resume first — if the song is already prepared (normal pause/resume),
    // this avoids reloading the track entirely.
    try {
      await audio.play()
      playData.value.isPlaying = true
      savePlayData()
      return
    } catch {
      // Song not prepared yet (first play or after error) — full load path
    }

    try {
      // Ask the native side for its position before (re)loading: after a
      // WebView reload the persisted mockCurrentTime may be stale.
      let resumeAt = playData.value.mockCurrentTime
      try {
        const state = await audio.getState()
        if (
          state &&
          state.currentIndex === playData.value.currentIndex &&
          Number.isFinite(state.currentPosition) &&
          state.currentPosition > 0
        ) {
          resumeAt = state.currentPosition
        }
      } catch {
        // getState unavailable — fall back to the persisted position.
      }
      await audio.playIndex(playData.value.currentIndex, playQueueRepeat.value, false)
      if (resumeAt > 0) {
        await audio.seek(resumeAt)
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
    if (switchPromise || playQueue.value.length === 0) return
    isSwitchingSong.value = true

    switchPromise = (async () => {
      try {
        // Sequential mode plays through the queue and stops at the end; only
        // repeatOne (handled natively) wraps around.
        if (
          !playQueueRepeat.value &&
          playMode.value === 'sequential' &&
          playData.value.currentIndex + 1 >= playQueue.value.length
        ) {
          await audio.pause()
          playData.value.isPlaying = false
          savePlayData()
          return
        }
        const nextIndex = (playData.value.currentIndex + 1) % playQueue.value.length
        console.log('[Store] nextSong: playing index=', nextIndex)
        await playIndex(nextIndex)
        // currentIndex is updated by the 'songChanged' event from native — do NOT set it here
        playData.value.isPlaying = true
        savePlayData()
      } catch (err) {
        console.error('[Store] nextSong error', err)
        toast.error('切歌失败')
      } finally {
        isSwitchingSong.value = false
        switchPromise = null
      }
    })()

    await switchPromise
  }

  async function prevSong() {
    if (switchPromise || playQueue.value.length === 0) return
    isSwitchingSong.value = true

    switchPromise = (async () => {
      try {
        // Sequential mode does not wrap backwards either.
        if (
          !playQueueRepeat.value &&
          playMode.value === 'sequential' &&
          playData.value.currentIndex <= 0
        ) {
          return
        }
        const prevIndex =
          (playData.value.currentIndex - 1 + playQueue.value.length) % playQueue.value.length
        console.log('[Store] prevSong: playing index=', prevIndex)
        await playIndex(prevIndex)
        // currentIndex is updated by the 'songChanged' event from native — do NOT set it here
        playData.value.isPlaying = true
        savePlayData()
      } catch (err) {
        console.error('[Store] prevSong error', err)
        toast.error('切歌失败')
      } finally {
        isSwitchingSong.value = false
        switchPromise = null
      }
    })()

    await switchPromise
  }

  function setAllSongs(songs: Song[]) {
    allSongs.value = songs
    localStorage.setItem('allSongs', JSON.stringify(songs))
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

  let currentIndexRequest = 0

  async function setCurrentIndex(index: number) {
    const request = ++currentIndexRequest
    try {
      // Prefer the native player's confirmation before committing the index;
      // the playlist may be mid-update, so a rejection still keeps the local
      // value (the following playIndex re-syncs it).
      await audio.setCurrentIndex(index)
    } catch (e) {
      console.warn('[Store] native setCurrentIndex rejected', e)
    }
    // A newer request (e.g. playIndex from a song tap) wins over this one.
    if (request !== currentIndexRequest) return
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

  function initAllSongs() {
    const obj = localStorage.getItem('allSongs')
    if (obj) {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) allSongs.value = parsed
      else if (Array.isArray(parsed.data)) allSongs.value = parsed.data
    }
  }

  function initPlayQueue() {
    const obj = localStorage.getItem('playQueue')
    if (!obj) return
    try {
      const parsed = JSON.parse(obj)
      if (Array.isArray(parsed)) playQueue.value = parsed
      else if (Array.isArray(parsed.data)) playQueue.value = parsed.data
    } catch (e) {
      console.error('播放队列解析失败', e)
    }
  }

  function initPlayData() {
    const obj = localStorage.getItem('playData')
    console.log(`已加载上次播放数据: ${obj}`)
    if (obj) {
      try {
        const data = JSON.parse(obj)
        playData.value.currentIndex = data.currentIndex ?? 0
        playData.value.isPlaying = false // 默认不自动播放
        playData.value.mockCurrentTime = data.mockCurrentTime ?? 0
      } catch (e) {
        console.error(e)
        toast.error('播放数据解析失败')
      }
    }
  }

  function initPlaybackRate() {
    const saved = localStorage.getItem('playbackRate')
    if (saved) {
      playbackRate.value = parseFloat(saved)
    }
  }

  async function setPlaybackRate(rate: number) {
    playbackRate.value = rate
    localStorage.setItem('playbackRate', rate.toString())
    await audio.setPlaybackRate(rate)
    // MediaPlayer applies PlaybackParams even while paused — no need to toggle
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
        currentPlayListIndex.value = JSON.parse(obj) ?? 0
        if (currentPlayListIndex.value === 0) {
          currentPlayListIndex.value = JSON.parse(obj).data ?? 0
        }
      } catch (e) {
        console.error(e)
      }
    } else {
      currentPlayListIndex.value = 0
    }
  }
  return {
    playQueueRepeat,
    canFetchCoverFromWeb,
    blacklist,
    firstPlayFlag,
    getFirstPlayFlag,
    markFirstPlayFlag,
    initBlacklist,
    getBlacklist,
    setBlacklist,
    saveBlacklist,
    addToBlacklist,
    initCanFetchCoverFromWeb,
    setCanFetchCoverFromWeb,
    getCanFetchCoverFromWeb,
    initPlayQueueRepeat,
    setPlayQueueRepeat,
    getPlayQueueRepeat,
    selectedCategory,
    allSongs,
    playQueue,
    homeFlag,
    initFlag,
    currentPlayList,
    currentToBeSortedSongList,
    playbackRate,
    setSelectedCategory,
    getSelectedCategory,
    setCurrentPlayList,
    getCurrentPlayList,
    setToBeSortedSongListIndex,
    getToBeSortedSongListIndex,
    setupAudioListener,
    setupWebViewRendererKilledListener,
    webViewMayBeDestroyed,
    playData,
    playMode,
    isValidMode,
    initPlayMode,
    isSwitchingSong,
    likeList,
    songLists,
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
    currentPlayListIndex,
    savePlayData,
    savePlayQueue,
    saveLikeList,
    saveCurrentPlayListIndex,
    currentSong,
    MAX_QUEUE_COVER_LOOKUPS,
    buildNativePlaylist,
    nativeLocalCoverCache,
    resolveNativeCoverUrl,
    resolveQueueCovers,
    TIME_PERSIST_INTERVAL_MS,
    setupNativeAudioListeners,
    persistPlaybackSnapshot,
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
  }
})
