<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { DropdownItem, OnlineSong, Song } from '@/utils/interface'
import { useDropdownManager } from '@/composables/useDropdownManager'
import OnlineSongItemSelectable from '@/components/song/OnlineSongItemSelectable.vue'
import SearchBox from '@/components/SearchBox.vue'
import toast from '@/utils/createToast'
import { MusicSigner, useAppStore } from '@/stores/app'
import { downloadMultipleSongs, downloadMusic, isSongDownloading } from '@/utils/musicDownloader'
import { useI18n } from 'vue-i18n'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import {
  getAccessibleUrl,
  getNativeCoverUrl,
  getSongFromOnlineSong,
  isInList,
} from '@/utils/functions'
import { audio } from '@/utils/createAudio'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
import { showSongInfo } from '@/utils/createInfo'
import router from '@/router'

const { t } = useI18n()
const appStore = useAppStore()

const keyword = ref(appStore.searchKeyword)
const searchHistory = computed(() => appStore.searchHistory.slice(0, 9))
const searchResults = computed(() => appStore.searchResults)
const isLoading = computed(() => appStore.isLoading)
const searchError = computed(() => appStore.searchError)
const hasSearched = computed(() => appStore.hasSearched)
const showHistory = ref(true)

const isSelectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const { openDropdownId, handleDropdownToggle } = useDropdownManager()

const isDownloadingBatch = ref(false) // 批量下载中

const operations = ref<DropdownItem[]>([
  { icon: 'line-md:play-filled', description: t('song.menu.play'), value: 'play' },
  {
    icon: 'material-symbols:download',
    description: t('search.song_operations.download'),
    value: 'download',
  },
  {
    icon: 'mdi:playlist-plus',
    description: t('song.menu.addToPlaylist'),
    value: 'addToPlaylist',
  },
  { icon: 'mdi:heart-outline', description: t('song.menu.like'), value: 'like' },
  // { icon: 'mi:next', description: t('song.menu.playNext'), value: 'next' },
  // { icon: 'mdi:queue', description: t('song.menu.addToQueue'), value: 'queue' },
  { icon: 'bx:detail', description: t('search.song_operations.detail'), value: 'detail' },
])

const goBack = () => router.back()

const onHistoryClick = (value: string) => {
  keyword.value = value
  showHistory.value = false
}

const onSearch = async () => {
  if (isLoading.value) return
  showHistory.value = false
  await appStore.search(
    keyword.value,
    appStore.getEnabledClients(),
    appStore.getMusicClientLimitation(),
    appStore.getEachSongAveTimeOut(),
    appStore.getFetchTimeOut(),
    t
  )
}

const onMenuItemClicked = async (item: DropdownItem) => {
  const song = searchResults.value.find((s) => s.identifier === openDropdownId.value)
  if (!song) {
    toast.error(t('search.toast.songNotFound'))
    return
  }

  if (item.value === 'download') {
    if (isSongDownloading(song)) return

    const url = song.download_url?.trim()
    if (!url) {
      toast.warning(t('search.toast.noDownloadUrl'))
      return
    }

    if (song.download_url_status && !song.download_url_status.ok) {
      const reason = song.download_url_status.reason?.join(', ') || t('search.toast.unknownReason')
      toast.error(t('search.toast.invalidDownloadUrl', { reason }))
      return
    }

    try {
      await downloadMusic(song)
      toast.success(t('search.toast.downloadSuccess', { name: song.name }))
    } catch (error: any) {
      console.error(`下载失败: ${song.name}`, error)
      toast.error(
        t('search.toast.downloadFailed', {
          name: song.name,
          reason: error.message || t('search.toast.unknownReason'),
        })
      )
    }
  } else if (item.value === 'play') {
    await onItemClick(song)
  } else if (item.value === 'detail') {
    await showSongInfo(song)
  } else if (item.value === 'queue') {
    addToQueue([song])
  } else if (item.value === 'addToPlaylist') {
    await addToSongList([song])
  } else if (item.value === 'like') {
    const targetSong: Song = getSongFromOnlineSong(song)
    if (isInList(targetSong.id, appStore.getLikeList().data)) {
      toast.warning(t('song.toast.alreadyLiked'))
      return
    }
    appStore.mergeLikeListData([targetSong])
    toast.success(t('song.toast.liked'))
  } else if (item.value === 'next') {
    const targetSong: Song = getSongFromOnlineSong(song)
    const queue = [...appStore.getPlayQueue()]
    const currentIndex = appStore.getPlayData().currentIndex
    if (queue.length === 0 || currentIndex < 0) {
      queue.push(targetSong)
    } else {
      queue.splice(currentIndex + 1, 0, targetSong)
    }
    appStore.setPlayQueue(queue)
    toast.success(t('song.toast.next', { name: targetSong.title }))
  }
}

const addToQueue = (songs: OnlineSong[]) => {
  const queue = [...appStore.getPlayQueue()]
  const newSongs: Song[] = []
  songs.forEach((o_song) => {
    const song = getSongFromOnlineSong(o_song)
    if (song.id && !isInList(song.id, queue)) {
      newSongs.push(song)
    }
  })
  if (newSongs.length > 0) {
    appStore.addListToQueue(newSongs)
    toast.success(t('playList.toast.addedToQueue', { count: newSongs.length }))
  } else {
    toast.warning(t('playList.toast.alreadyInQueue'))
  }
}

const addSelectedToQueue = () => {
  const selectedSongs = searchResults.value.filter(
    (song) => selectedIds.value.has(song.identifier) && song.download_url?.trim()
  )
  addToQueue(selectedSongs)
  exitSelectMode()
}

const addToSongList = async (songs: OnlineSong[], onlySelected = false) => {
  const selected = await showPlaylistSelector(
    [appStore.getLikeList(), ...appStore.getSongLists()],
    t('playlistSelector.title'),
    t('playList.like.title'),
    t('playList.like.description')
  )
  if (selected) {
    // Batch actions pass a pre-filtered list; row actions pass a single song
    // that is not part of the selection, so filtering by selectedIds would
    // silently add nothing.
    const candidates = onlySelected
      ? songs.filter((song) => selectedIds.value.has(song.identifier))
      : songs
    if (selected.id === 0) {
      const likeList = appStore.getLikeList().data
      const newSongs: Song[] = []
      candidates.forEach((o_song) => {
        const song = getSongFromOnlineSong(o_song)
        if (song.id && !isInList(song.id, likeList)) {
          newSongs.push(song)
        }
      })
      if (newSongs.length > 0) {
        appStore.mergeLikeListData(newSongs)
        toast.success(
          t('playList.toast.addedToPlaylist', {
            count: newSongs.length,
            name: selected.id === 0 ? t('playList.like.title') : selected.name,
          })
        )
      } else {
        toast.warning(t('playList.toast.alreadyInLike'))
      }
    } else {
      const list: Song[] = []
      candidates.forEach((o_song) => {
        const song = getSongFromOnlineSong(o_song)
        if (song.id && !isInList(song.id, selected.data)) {
          list.push(song)
        }
      })
      if (list.length > 0) {
        appStore.setSongListDataById(selected.id, [...selected.data, ...list])
        toast.success(
          t('playList.toast.addedToPlaylist', { count: list.length, name: selected.name })
        )
      } else {
        toast.warning(t('playList.toast.alreadyInPlaylist'))
      }
    }
  }
}

const addSelectedToSongList = async () => {
  const selectedSongs = searchResults.value.filter(
    (song) => selectedIds.value.has(song.identifier) && song.download_url?.trim()
  )
  await addToSongList(selectedSongs, true)
  exitSelectMode()
}

const enterSelectMode = (songId?: string) => {
  if (isSelectMode.value) return
  isSelectMode.value = true
  if (songId !== undefined) {
    selectedIds.value = new Set([...selectedIds.value, songId])
  }
  nextTick(() => {
    const el = document.querySelector('.song-list')
    if (el) {
      ;(el as HTMLElement).style.transform = 'translateZ(0)'
      requestAnimationFrame(() => {
        ;(el as HTMLElement).style.transform = ''
      })
    }
  })
}

const exitSelectMode = () => {
  isSelectMode.value = false
  selectedIds.value = new Set()
  openDropdownId.value = null
}

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    const next = new Set(selectedIds.value)
    next.delete(id)
    selectedIds.value = next
    if (next.size === 0) {
      exitSelectMode()
    }
  } else {
    selectedIds.value = new Set([...selectedIds.value, id])
  }
}

const selectAll = () => {
  selectedIds.value = new Set(searchResults.value.map((s) => s.identifier))
}

const clearSelection = () => {
  selectedIds.value = new Set()
  exitSelectMode()
}

const onItemClick = async (song: OnlineSong) => {
  const queue = [...appStore.getPlayQueue()]
  const targetSong: Song = getSongFromOnlineSong(song)
  let index = -1
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].id === targetSong.id) {
      index = i
      break
    }
  }
  if (index === -1) {
    queue.push(targetSong)
    appStore.setPlayQueue(queue)
    index = queue.length - 1
  }
  const currentIndex = appStore.getPlayData().currentIndex
  if (index === currentIndex && queue.length > 0 && queue[currentIndex]?.id === targetSong.id) {
    await appStore.togglePlay()
    return
  }
  if (appStore.getIsSwitchingSong()) return
  appStore.setIsSwitchingSong(true)
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)
  try {
    await audio.setPlaylist(
      queue.map((s) => ({
        url: getAccessibleUrl(s.uri),
        title: s.title,
        artist: s.artist || 'Unknown',
        album: s.album || '',
        coverUrl: getNativeCoverUrl(s, appStore.getCanFetchCoverFromWeb()),
      }))
    )
    await appStore.playIndex(index)
  } catch (e) {
    console.error('播放失败', e)
    toast.error(t('common.playFailed'))
  } finally {
    appStore.setIsSwitchingSong(false)
  }
}

const downloadSelectedMusics = async () => {
  if (isDownloadingBatch.value) return

  const selectedSongs = searchResults.value.filter(
    (song) => selectedIds.value.has(song.identifier) && song.download_url?.trim()
  )

  if (selectedSongs.length === 0) {
    toast.warning(t('search.toast.noDownloadable'))
    return
  }

  isDownloadingBatch.value = true
  try {
    const { succeeded, failed, invalidSongsCount } = await downloadMultipleSongs(selectedSongs)

    if (failed === 0 && invalidSongsCount === 0) {
      toast.success(t('search.toast.batchAllDone', { count: succeeded }))
    } else {
      toast.warning(
        t('search.toast.batchPartial', {
          succeeded,
          failed,
          invalid: invalidSongsCount,
        })
      )
    }
  } catch (error) {
    toast.error(t('search.toast.batchError'))
    console.error(error)
  } finally {
    isDownloadingBatch.value = false
  }
}

const toPlayView = () => {
  router.push('/player-view')
}
watch(keyword, (newVal) => {
  appStore.searchKeyword = newVal
  if (isLoading.value) {
    MusicSigner.cancelSearch()
    appStore.resetSearch()
  }
})

// Consume the request so returning from the player does not search again.
// Watching the route also supports Ionic's cached pages.
watch(
  () => router.currentRoute.value,
  async (route) => {
    const query = route.query.keyword
    if (route.path !== '/search' || typeof query !== 'string' || !query.trim()) return
    if (isLoading.value) {
      MusicSigner.cancelSearch()
      appStore.resetSearch()
    }
    keyword.value = query.trim()
    await nextTick()
    const remainingQuery = { ...route.query }
    delete remainingQuery.keyword
    await router.replace({ path: route.path, query: remainingQuery, hash: route.hash })
    await onSearch()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  // ignore
})
</script>

<template>
  <ion-page>
    <div class="search-page">
      <div class="search-header">
        <button :aria-label="$t('common.back')" class="header-back" type="button" @click="goBack">
          <Icon :width="24" icon="mdi:chevron-left" />
        </button>
        <SearchBox
          v-model="keyword"
          :clearable="true"
          :placeholder="$t('search.searchPlaceholder')"
          :real-time-search="false"
          :show-button="true"
          autofocus
          size="small"
          @search="onSearch"
        />
      </div>

      <div v-if="showHistory && searchHistory.length > 0" class="history-panel">
        <div class="history-header">
          <span class="history-title">{{ $t('search.history.title') }}</span>
          <button class="history-clear" @click="appStore.clearSearchHistory()">
            {{ $t('search.history.clear') }}
          </button>
        </div>
        <div class="history-list">
          <div v-for="item in searchHistory" :key="item" class="history-item">
            <button class="history-main" type="button" @click="onHistoryClick(item)">
              <Icon icon="mdi:history" width="15" />
              <span>{{ item }}</span>
            </button>
            <button
              :aria-label="$t('search.historyRemove')"
              class="history-remove"
              type="button"
              @click.stop="appStore.removeSearchHistoryItem(item)"
            >
              <Icon icon="mdi:close" width="14" />
            </button>
          </div>
        </div>
      </div>

      <div class="song-list">
        <!-- 错误状态（优先显示） -->
        <div v-if="searchError" class="status-placeholder error">
          <Icon :width="32" icon="mdi:alert-circle-outline" />
          <span class="status-text" style="white-space: pre-wrap">{{ searchError }}</span>
        </div>

        <!-- 无结果（搜索完成且结果为空） -->
        <div
          v-else-if="hasSearched && searchResults.length === 0 && !isLoading"
          class="status-placeholder"
        >
          <Icon :width="32" icon="mdi:music-off" />
          <span class="status-text">{{ $t('search.noResults') }}</span>
        </div>

        <!-- 初始提示（未搜索） -->
        <div v-else-if="!hasSearched && searchResults.length === 0" class="status-placeholder">
          <Icon :width="32" icon="mdi:music-search" />
          <span class="status-text">{{ $t('search.initialHint') }}</span>
        </div>

        <!-- 有结果 或 正在加载（列表 + 底部加载指示） -->
        <template v-else>
          <!-- 歌曲列表 -->
          <OnlineSongItemSelectable
            v-for="song in searchResults"
            :key="song.identifier"
            :dropdown-open="openDropdownId === song.identifier"
            :on-delete="() => {}"
            :onMenuItemSelect="onMenuItemClicked"
            :operations="operations"
            :selectable="isSelectMode"
            :selected="selectedIds.has(song.identifier)"
            :song="song"
            @click="onItemClick(song)"
            @long-press="enterSelectMode"
            @toggle-select="toggleSelect(song.identifier)"
            @update:dropdown-open="(open) => handleDropdownToggle(song.identifier, open)"
          />

          <!-- 加载指示器（置于列表底部） -->
          <div v-if="isLoading" class="loading-indicator">
            <Icon :width="20" icon="eos-icons:loading" />
            <span class="loading-text">{{ $t('search.loading') }}</span>
          </div>
        </template>
      </div>

      <Transition name="slide-up">
        <div v-if="isSelectMode" class="bottom-actions">
          <div class="actions-container">
            <button :disabled="searchResults.length === 0" class="action-btn" @click="selectAll">
              <Icon :width="20" icon="mdi:select-all" />
              <span>{{ $t('search.operations.selectAll') }}</span>
            </button>
            <button class="action-btn" @click="clearSelection">
              <Icon :width="20" icon="mdi:select-off" />
              <span>{{ $t('search.operations.clear') }}</span>
            </button>
            <button
              :disabled="isDownloadingBatch || selectedIds.size === 0"
              class="action-btn"
              @click="downloadSelectedMusics"
            >
              <Icon :width="20" icon="material-symbols:download" />
              <span>{{
                isDownloadingBatch ? $t('common.downloading') : $t('search.operations.download')
              }}</span>
            </button>
            <button class="action-btn" @click="addSelectedToQueue">
              <Icon :width="20" icon="ic:baseline-queue" />
              <span>{{ $t('playList.addToQueue') }}</span>
            </button>
            <button class="action-btn" @click="addSelectedToSongList">
              <Icon :width="20" icon="mdi:heart-outline" />
              <span>{{ $t('playList.addToPlaylist') }}</span>
            </button>
            <button class="action-btn" @click="exitSelectMode">
              <Icon :width="20" icon="mdi:close" />
              <span>{{ $t('search.operations.cancel') }}</span>
            </button>
          </div>
        </div>
      </Transition>
      <NowPlayingBar auto-play @expand="toPlayView" />
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.search-page {
  position: relative;
  height: 100%;
  overflow-y: auto;
  background-color: var(--bg-color);
  padding-bottom: calc(96px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  @include custom-scrollbar(3px);
}

.search-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: calc(var(--space-2) + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))
    var(--space-3) var(--space-2);

  .header-back {
    @include header-back;
    background: transparent;
    border: none;
    padding: 0;
  }

  :deep(.search-box) {
    flex: 1;
    min-width: 0;
  }
}

.history-panel {
  padding: var(--space-2) var(--space-4) var(--space-4);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0 var(--space-3);
}

.history-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
}

.history-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 36px;
  padding: 0 var(--space-1);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  cursor: pointer;

  &:hover {
    color: var(--text-color);
  }
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.history-item {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--chip-bg);
  color: var(--text-color);
  overflow: hidden;
}

.history-main {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 4px 0 14px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;

  span {
    max-width: 180px;
    @include text-ellipsis;
  }
}

.history-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 2px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;

  &:hover {
    color: var(--text-color);
    background: var(--bg-secondary);
  }
}

.song-list {
  display: flex;
  flex-direction: column;
}

.status-placeholder {
  @include empty-state;

  .status-text {
    line-height: var(--line-height-normal);
    max-width: 320px;
  }

  &.error {
    color: var(--danger-color);

    :deep(svg) {
      color: var(--danger-color);
    }
  }
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bottom-actions-bg);
  border-top: 1px solid var(--bottom-actions-border);
  z-index: 200;
  padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  animation: sheetIn var(--duration-normal) var(--ease-out-expo);
}

.actions-container {
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  padding: var(--space-2) var(--space-3);
  gap: var(--space-1);
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.action-btn {
  flex: 1 0 auto;
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-color);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;

  &:hover {
    background: var(--setting-hover-bg);
  }

  &:active {
    background: var(--hairline);
  }

  &:disabled {
    color: var(--text-disabled);
    pointer-events: none;
  }
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  color: var(--text-tertiary);

  .loading-text {
    font-size: var(--font-size-sm);
  }
}
</style>
