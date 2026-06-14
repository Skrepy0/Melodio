<script setup lang="ts">
import router from '@/router'
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { DropdownItem, Playlist, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import PlayList from '@/components/PlayList.vue'
import toast from '@/utils/createToast'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import { showConfirm } from '@/utils/createConfirm'
import { useI18n } from 'vue-i18n'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl } from '@/utils/functions'
import SearchBox from '@/components/SearchBox.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import CircleButton from '@/components/button/CircleButton.vue'
import { useSongSearch } from '@/utils/search'
import { showPrompt } from '@/utils/createPrompt'

const { t } = useI18n()
const appStore = useAppStore()

const songsList = ref<Song[]>([])
const showSongsList = ref<Song[]>([])
const keyword = ref('')
const title = ref<string>(t('songList.defaultTitle'))
const isLoading = ref(false)

const isSearchMode = ref(false)

const operations = computed<DropdownItem[]>(() => [
  { icon: 'material-symbols:sort', description: t('songList.operations.sort'), value: 'sort' },
  { icon: 'mdi:pencil', description: t('songList.operations.edit_name'), value: 'edit_name' },
  { icon: 'mdi:delete', description: t('songList.operations.delete_all'), value: 'delete_all' },
])

const synchroShowSongsList = () => {
  showSongsList.value = songsList.value
}

if (appStore.getCurrentPlayListIndex() === 0) {
  const likeList = appStore.getLikeList()
  songsList.value = likeList.data
  synchroShowSongsList()
  title.value = t('playList.like.title')
} else {
  const list: Playlist = appStore.getSongLists()[appStore.getCurrentPlayListIndex() - 1]
  songsList.value = list.data
  synchroShowSongsList()
  title.value = list.name
}

const saveSongList = () => {
  const index = appStore.getCurrentPlayListIndex()
  if (index === 0) {
    appStore.setLikeListData(songsList.value)
  } else {
    appStore.setSongListDataById(index, songsList.value)
  }
}

const goBack = () => router.back()
const showFullPlayer = () => router.push('/player-view')

const handleBatchDelete = async (ids: string[]) => {
  const result = await showConfirm({
    title: t('songList.confirm.title'),
    message: t('songList.confirm.message', { count: ids.length }),
    confirmText: t('songList.confirm.confirm'),
    cancelText: t('songList.confirm.cancel'),
  })
  if (!result) return
  const list: Song[] = []
  songsList.value.forEach((item) => {
    if (!ids.includes(item.id)) list.push(item)
  })
  songsList.value = list
  synchroShowSongsList()
  saveSongList()
  toast.success(t('songList.toast.removeSuccess', { count: ids.length }))
}

const removeSongFromPlaylist = async (song: Song) => {
  const result = await showConfirm({
    title: t('songList.confirm.title'),
    message: t('songList.confirm.message', { count: 1 }),
    confirmText: t('songList.confirm.confirm'),
    cancelText: t('songList.confirm.cancel'),
  })
  if (!result) return
  const newList = songsList.value.filter((item) => item.id !== song.id)
  songsList.value = newList
  synchroShowSongsList()
  saveSongList()
  toast.success(t('songList.toast.removeSuccess', { count: 1 }))
}

const playSong = async (song: Song) => {
  if (songsList.value.length === 0) return
  const index = songsList.value.findIndex((s) => s.id === song.id)
  if (index === -1) {
    toast.error(t('songList.toast.songNotFound'))
    return
  }
  const playData = appStore.getPlayData()
  const currentIndex = playData.currentIndex
  const currentQueue = appStore.getPlayQueue()
  if (
    index === currentIndex &&
    currentQueue.length > 0 &&
    currentQueue[currentIndex]?.id === song.id // 同一首歌
  ) {
    appStore.togglePlay()
    return // 暂停播放
  }
  // 不是同一首
  if (playData.isPlaying) {
    appStore.togglePlay() // 先暂停
  }
  // 设置队列信息
  appStore.setIsSwitchingSong(true)
  appStore.setPlayQueue(songsList.value)
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)
  try {
    const queue = appStore.getPlayQueue()
    await audio.setPlaylist(
      queue.map((s) => ({
        url: getAccessibleUrl(s.uri),
        title: s.title,
        artist: s.artist || 'Unknown',
        album: s.album || '',
        coverUrl: s.albumArtUri || '',
      }))
    )
    await audio.playIndex(index)
    appStore.setIsPlaying(true)
  } catch (error) {
    console.error('播放失败:', error)
    toast.error(t('common.playFailed'))
  } finally {
    appStore.togglePlay()
    setTimeout(() => {
      appStore.setIsSwitchingSong(false)
      appStore.togglePlay()
    }, 200)
  }
}

const onSelectOperation = async (item: DropdownItem) => {
  console.log('选中:', item.description, item.value)
  if (item.value === 'edit_name') {
    const index = appStore.getCurrentPlayListIndex()
    if (index === 0) {
      toast.warning(t('playlist.warning.defaultPlaylist'))
      return
    }
    const name = await showPrompt({
      title: t('playlist.editPrompt.title'),
      message: t('playlist.editPrompt.message'),
      placeholder: '',
      defaultValue: title.value,
      confirmContent: t('common.confirm'),
      cancelContent: t('common.cancel'),
    })
    if (name) {
      if (name === title.value) {
        toast.warning(t('playlist.warning.sameName'))
      } else {
        const newList = appStore.getSongLists()[index - 1]
        newList.name = name
        appStore.setSongListById(newList.id, newList)
        toast.success(t('playlist.success.renamed'))
        title.value = name
      }
    }
  } else if (item.value === 'delete_all') {
    const result = await showConfirm({
      title: t('songList.deleteAllSongs.title'),
      message: t('songList.deleteAllSongs.message', { name: title.value }),
      confirmText: t('songList.deleteAllSongs.confirm'),
      cancelText: t('songList.deleteAllSongs.cancel'),
    })
    if (result) {
      if (songsList.value.length !== 0) {
        const index = appStore.getCurrentPlayListIndex()
        songsList.value = []
        synchroShowSongsList()
        if (index === 0) {
          appStore.setLikeListData(songsList.value)
        } else {
          appStore.setSongListDataById(index, songsList.value)
        }
        toast.success(t('songList.deleteAllSongs.result.success'))
      } else {
        toast.warning(t('songList.deleteAllSongs.result.emptyList'))
      }
    }
  } else if (item.value === 'sort') {
    appStore.setToBeSortedSongListIndex(appStore.getCurrentPlayListIndex())
    router.push('/sort-song')
  }
}

const enterSearchMode = () => {
  isSearchMode.value = true
  keyword.value = ''
}

const exitSearchMode = () => {
  isSearchMode.value = false
  keyword.value = ''
  synchroShowSongsList()
}

const onSearch = () => {
  if (!isSearchMode.value) return
  if (keyword.value.trim() === '') {
    synchroShowSongsList()
  } else {
    const result = useSongSearch(keyword, songsList, appStore.getPinyinSearch())
    showSongsList.value = result.value
  }
}
</script>

<template>
  <ion-page>
    <div class="song-list-page">
      <div class="song-list-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>

        <Transition name="fade" mode="out-in">
          <div v-if="!isSearchMode" class="normal-mode" key="normal">
            <div class="header-title">{{ title }}</div>
            <div class="button-container">
              <CircleButton icon="mdi:magnify" :size="36" @click="enterSearchMode" />
              <DropdownButton
                button-icon="mingcute:more-2-line"
                :size="36"
                :options="operations"
                @select="onSelectOperation"
                :dx="-100"
              />
            </div>
          </div>

          <div v-else class="search-mode" key="search">
            <div class="search-wrapper">
              <SearchBox
                v-model="keyword"
                autofocus
                @search="onSearch"
                size="medium"
                :clearable="true"
                :placeholder="$t('home.searchPlaceholder')"
                class="search-input-field"
              />
              <CircleButton
                icon="mdi:close"
                :size="36"
                bg-color="transparent"
                icon-color="var(--text-color)"
                @click="exitSearchMode"
              />
            </div>
          </div>
        </Transition>
      </div>

      <div class="content-body">
        <div v-if="isLoading" class="loading-state">
          <Icon icon="mdi:loading" :width="32" class="loading-icon" />
          <span>{{ $t('songList.loading') }}</span>
        </div>
        <div v-if="!isLoading && songsList.length === 0" class="empty-state">
          <Icon icon="mdi:music-off" :width="48" color="var(--text-secondary)" />
          <p>{{ $t('songList.empty') }}</p>
        </div>
        <div
          v-if="!isLoading && songsList.length !== 0 && showSongsList.length === 0"
          class="empty-state"
        >
          <Icon icon="mdi:music-off" :width="48" color="var(--text-secondary)" />
          <p>{{ $t('songList.notFound') }}</p>
        </div>
        <PlayList
          v-else
          :songs="showSongsList"
          @batch-delete="handleBatchDelete"
          @song-click="playSong"
          @delete-song="removeSongFromPlaylist"
        />
      </div>

      <NowPlayingBar auto-play @expand="showFullPlayer" />
    </div>
  </ion-page>
</template>

<style scoped lang="scss">
.song-list-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

.song-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 60px;
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);
  flex-shrink: 0;
}

.header-back {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
  &:hover {
    background-color: var(--header-back-hover);
  }
}

.header-title {
  flex: 1;
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.button-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 12px;
}

.search-input-field {
  flex: 1;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--text-secondary);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.header-title,
.button-container,
.search-wrapper {
  transition: all 0.25s ease;
}
.normal-mode {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fade-leave-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fade-enter-active {
  transition: all 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}
.fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
