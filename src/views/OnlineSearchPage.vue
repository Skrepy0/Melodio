<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { nextTick, ref, watch } from 'vue'
import { DropdownItem, OnlineSong, Song } from '@/utils/interface'
import { useDropdownManager } from '@/composables/useDropdownManager'
import OnlineSongItemSelectable from '@/components/song/OnlineSongItemSelectable.vue'
import SearchBox from '@/components/SearchBox.vue'
import PageTitle from '@/components/PageTitle.vue'
import router from '@/router'
import toast from '@/utils/createToast'
import { MusicSigner, useAppStore } from '@/stores/app'
import { downloadMultipleSongs, downloadMusic } from '@/utils/musicDownloader'
import { useI18n } from 'vue-i18n'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import { getAccessibleUrl, getSongFromOnlineSong, isInList } from '@/utils/functions'
import { audio } from '@/utils/createAudio'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'

const { t } = useI18n()
const appStore = useAppStore()

const keyword = ref('')
const searchResults = ref<OnlineSong[]>([])
const isLoading = ref(false)
const searchError = ref<string | null>(null)
const hasSearched = ref(false)

const isSelectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const { openDropdownId, handleDropdownToggle } = useDropdownManager()

const downloadingIds = ref<Set<string>>(new Set()) // 单曲下载中
const isDownloadingBatch = ref(false) // 批量下载中

const operations = ref<DropdownItem[]>([
  { icon: 'line-md:play-filled', description: 'Play', value: 'play' },
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
  { icon: 'mi:next', description: t('song.menu.playNext'), value: 'next' },
  { icon: 'mdi:queue', description: t('song.menu.addToQueue'), value: 'queue' },
  { icon: 'bx:detail', description: t('search.song_operations.detail'), value: 'detail' },
])

const goBack = () => router.back()

const onSearch = async (query: string) => {
  if (isLoading.value) return

  if (!query.trim()) {
    searchResults.value = []
    hasSearched.value = false
    searchError.value = null
    isLoading.value = false
    return
  }

  isLoading.value = true
  searchError.value = null
  hasSearched.value = true

  try {
    const response = await MusicSigner.search({
      keyword: keyword.value,
      clients: appStore.getEnabledClients(),
      limit: appStore.getMusicClientLimitation(),
      eachSongTimeOut: appStore.getEachSongAveTimeOut(),
      totalTimeOut: appStore.getFetchTimeOut(),
    })
    if (!response) {
      searchError.value = '搜索失败，请稍后重试'
      searchResults.value = []
    } else {
      searchResults.value = response.items
      if (response.total === 0) {
        //todo
      }
    }
  } catch (e) {
    searchError.value = `网络异常，请检查网络连接\n${e}`
    console.error(e)
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}

const onMenuItemSelect = async (item: DropdownItem) => {
  const song = searchResults.value.find((s) => s.identifier === openDropdownId.value)
  if (!song) {
    toast.error('歌曲信息不存在')
    return
  }

  if (item.value === 'download') {
    if (downloadingIds.value.has(song.identifier)) return

    const url = song.download_url?.trim()
    if (!url) {
      toast.warning('该歌曲没有可用的下载链接')
      return
    }

    if (song.download_url_status && !song.download_url_status.ok) {
      const reason = song.download_url_status.reason?.join(', ') || '未知原因'
      toast.error(`下载链接无效: ${reason}`)
      return
    }

    downloadingIds.value.add(song.identifier)

    try {
      await downloadMusic(song)
      toast.success(`《${song.name}》下载成功！`)
    } catch (error: any) {
      console.error(`下载失败: ${song.name}`, error)
      toast.error(`《${song.name}》下载失败: ${error.message || '未知错误'}`)
    } finally {
      downloadingIds.value.delete(song.identifier)
    }
  } else if (item.value === 'play') {
    await onItemClick(song)
  } else if (item.value === 'detail') {
    //todo
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
  }
}
const addToQueue = (songs: OnlineSong[]) => {
  const queue = appStore.getPlayQueue()
  const newSongs: Song[] = []
  songs.forEach((o_song) => {
    const song = getSongFromOnlineSong(o_song)
    if (selectedIds.value.has(song.id) && !isInList(song.id, queue)) {
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
const addToSongList = async (songs: OnlineSong[]) => {
  const selected = await showPlaylistSelector(
    [appStore.getLikeList(), ...appStore.getSongLists()],
    t('playlistSelector.title'),
    t('playList.like.title'),
    t('playList.like.description')
  )
  if (selected) {
    if (selected.id === 0) {
      const likeList = appStore.getLikeList().data
      const newSongs: Song[] = []
      songs.forEach((o_song) => {
        const song = getSongFromOnlineSong(o_song)
        if (selectedIds.value.has(song.id) && !isInList(song.id, likeList)) {
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
      songs.forEach((o_song) => {
        const song = getSongFromOnlineSong(o_song)
        if (selectedIds.value.has(song.id) && !isInList(song.id, selected.data)) {
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
  await addToSongList(selectedSongs)
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
        coverUrl: s.albumArtUri,
      }))
    )
    await audio.playIndex(index)
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
    toast.warning('没有可下载的歌曲，请检查是否选中或歌曲是否有效')
    return
  }

  isDownloadingBatch.value = true
  try {
    const { succeeded, failed, invalidSongsCount, results } =
      await downloadMultipleSongs(selectedSongs)

    if (failed === 0 && invalidSongsCount === 0) {
      toast.success(`全部 ${succeeded} 首歌曲下载完成！`)
    } else {
      toast.warning(
        `下载完成：成功 ${succeeded} 首，失败 ${failed} 首，${invalidSongsCount} 首无效`
      )
    }

    console.log('下载结果详情:', results)
  } catch (error) {
    toast.error('下载过程中发生错误，请稍后重试')
    console.error(error)
  } finally {
    isDownloadingBatch.value = false
  }
}

watch(keyword, (newVal) => {
  if (!newVal.trim() && hasSearched.value) {
    //todo
  }
})
</script>

<template>
  <ion-page>
    <div class="search-page">
      <div class="header">
        <PageTitle :go-back="goBack" :title="$t('search.title')" />
        <Transition appear name="fade-slide">
          <div class="search-wrapper">
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
        </Transition>
      </div>

      <div class="song-list">
        <div v-if="isLoading" class="status-placeholder">
          <Icon color="var(--primary-color)" height="36" icon="eos-icons:loading" width="36" />
          <span class="status-text">{{ $t('search.loading') }}</span>
        </div>

        <div v-else-if="searchError" class="status-placeholder error">
          <Icon color="#ff6b6b" height="36" icon="mdi:alert-circle-outline" width="36" />
          <span class="status-text">{{ searchError }}</span>
        </div>

        <div v-else-if="hasSearched && searchResults.length === 0" class="status-placeholder">
          <Icon color="var(--text-secondary)" height="36" icon="mdi:music-off" width="36" />
          <span class="status-text">{{ $t('search.noResults') }}</span>
        </div>

        <template v-else>
          <OnlineSongItemSelectable
            v-for="song in searchResults"
            :key="song.identifier"
            :dropdown-open="openDropdownId === song.identifier"
            :on-delete="() => {}"
            :onMenuItemSelect="onMenuItemSelect"
            :operations="operations"
            :selectable="isSelectMode"
            :selected="selectedIds.has(song.identifier)"
            :song="song"
            @click="onItemClick(song)"
            @long-press="enterSelectMode"
            @toggle-select="toggleSelect(song.identifier)"
            @update:dropdown-open="(open) => handleDropdownToggle(song.identifier, open)"
          />
          <div v-if="!hasSearched && searchResults.length === 0" class="status-placeholder">
            <Icon color="var(--text-secondary)" height="36" icon="mdi:music-search" width="36" />
            <span class="status-text">{{ $t('search.initialHint') }}</span>
          </div>
        </template>
      </div>

      <Transition name="slide-up">
        <div v-if="isSelectMode" class="bottom-actions">
          <div class="actions-container">
            <button :disabled="searchResults.length === 0" class="action-btn" @click="selectAll">
              <Icon :width="20" color="var(--primary-color)" icon="mdi:select-all" />
              <span>{{ $t('search.operations.selectAll') }}</span>
            </button>
            <button class="action-btn" @click="clearSelection">
              <Icon :width="20" color="var(--primary-color)" icon="mdi:select-off" />
              <span>{{ $t('search.operations.clear') }}</span>
            </button>
            <button
              :disabled="isDownloadingBatch || selectedIds.size === 0"
              class="action-btn"
              @click="downloadSelectedMusics"
            >
              <Icon :width="20" color="var(--primary-color)" icon="material-symbols:download" />
              <span>{{ isDownloadingBatch ? '下载中...' : $t('search.operations.download') }}</span>
            </button>
            <button class="action-btn" @click="addSelectedToQueue">
              <Icon :width="20" color="var(--primary-color)" icon="ic:baseline-queue" />
              <span>{{ $t('playList.addToQueue') }}</span>
            </button>
            <button class="action-btn" @click="addSelectedToSongList">
              <Icon :width="20" color="var(--primary-color)" icon="mdi:heart-outline" />
              <span>{{ $t('playList.addToPlaylist') }}</span>
            </button>
            <button class="action-btn" @click="exitSelectMode">
              <Icon :width="20" color="var(--primary-color)" icon="mdi:close" />
              <span>{{ $t('search.operations.cancel') }}</span>
            </button>
          </div>
        </div>
      </Transition>
      <NowPlayingBar auto-play @expand="() => router.push('/player-view')" />
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.search-page {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 80px;
}

.header {
  background: transparent;
  border-bottom: none;
}

.search-wrapper {
  margin-top: 4px;
  :deep(.search-box) {
    input {
      padding: 6px 14px;
      border-radius: 20px;
      transition:
        border-color 0.2s,
        background 0.2s;
    }
    .search-btn {
      border-radius: 20px;
      padding: 0 16px;
    }
  }
}

.fade-slide-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  min-height: 200px;
}

.status-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary, #8b949e);
  gap: 12px;
  text-align: center;

  &.error {
    color: #ff6b6b;
  }

  .status-text {
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
    max-width: 300px;
  }
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bottom-actions-bg, #ffffff);
  border-top: 1px solid var(--bottom-actions-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 -2px 10px var(--bottom-actions-shadow, rgba(0, 0, 0, 0.1));
  z-index: 200;
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bottom-actions-bg-rgb, 255, 255, 255), 0.9);
}

.actions-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  white-space: nowrap;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
    &:hover {
      background: var(--scrollbar-thumb-hover);
    }
  }
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-color);
  cursor: pointer;
  transition: opacity 0.2s;
  padding: 8px;

  &:hover {
    opacity: 0.7;
  }

  &.danger {
    color: var(--danger-color, #ff4444);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
