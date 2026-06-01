<script setup lang="ts">
import router from '@/router'
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { Playlist, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import PlayList from '@/components/PlayList.vue'
import toast from '@/utils/createToast'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import { showConfirm } from '@/utils/createConfirm'
import { useI18n } from 'vue-i18n'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl } from '@/utils/functions'

const { t } = useI18n()
const appStore = useAppStore()

const songsList = ref<Song[]>([])

const title = ref<string>(t('songList.defaultTitle'))

if (appStore.getCurrentPlayListIndex() === 0) {
  const likeList = appStore.getLikeList()
  songsList.value = likeList.data
  title.value = likeList.name
} else {
  const list: Playlist = appStore.getSongLists()[appStore.getCurrentPlayListIndex() - 1]
  songsList.value = list.data
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

const isLoading = ref(false)

const goBack = () => {
  router.back()
}

const showFullPlayer = () => {
  router.push('/player-view')
}

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

  const currentIndex = appStore.getPlayData().currentIndex
  const currentQueue = appStore.getPlayQueue()
  if (
    index === currentIndex &&
    currentQueue.length > 0 &&
    currentQueue[currentIndex]?.id === song.id
  ) {
    appStore.togglePlay()
    return
  }
  appStore.setPlayQueue(songsList.value)
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)
  try {
    await audio.setPlaylist(
      songsList.value.map((s) => ({
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
    appStore.setIsSwitchingSong(true)
    setTimeout(() => {
      appStore.setIsSwitchingSong(false)
    }, 100)
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
        <div class="header-title">{{ title }}</div>
      </div>

      <div class="content-body">
        <div v-if="isLoading" class="loading-state">
          <Icon icon="mdi:loading" :width="32" class="loading-icon" />
          <span>{{ $t('songList.loading') }}</span>
        </div>

        <PlayList
          v-else
          :songs="songsList"
          @batch-delete="handleBatchDelete"
          @song-click="playSong"
          @delete-song="removeSongFromPlaylist"
        />

        <div v-if="!isLoading && songsList.length === 0" class="empty-state">
          <Icon icon="mdi:music-off" :width="48" color="var(--text-secondary)" />
          <p>{{ $t('songList.empty') }}</p>
        </div>
      </div>

      <NowPlayingBar auto-play @expand="showFullPlayer" />
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.song-list-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

.song-list-header {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);
  gap: 16px;
  flex-shrink: 0;
}

.header-back {
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
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>
