<script setup lang="ts">
import router from '@/router'
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import PlayList from '@/components/PlayList.vue'
import toast from '@/utils/createToast'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import { showConfirm } from '@/utils/createConfirm'
const appStore = useAppStore()
const title = ref<string>('全部歌曲')
const songsList = ref<Song[]>([])
if (appStore.getCurrentPlayListIndex() === 0) {
  const likeList = appStore.getLikeList()
  songsList.value = likeList.data
  title.value = likeList.name
} else {
  // todo
}
const saveSongList = () => {
  const index = appStore.getCurrentPlayListIndex()
  if (index === 0) {
    appStore.setLikeListData(songsList.value)
  } else {
    //TODO
  }
}
const isLoading = ref(false) // 可扩展加载状态

const goBack = () => {
  router.back()
}

const showFullPlayer = () => {
  router.push('/player-view')
}

const handleBatchDelete = async (ids: string[]) => {
  const result = await showConfirm({
    title: '提示',
    message: `确定要将这${ids.length}首歌移出此歌曲列表吗？`,
    confirmText: '确定',
    cancelText: '取消',
  })
  if (!result) return
  const list: Song[] = []
  songsList.value.forEach((item) => {
    if (!ids.includes(item.id)) list.push(item)
  })
  songsList.value = list
  saveSongList()
  toast.success(`已移除${ids.length}首歌曲`)
}

const playSong = async (song: Song) => {
  if (songsList.value.length === 0) return
  let index: number = -1
  for (let i = 0; i < songsList.value.length; i++) {
    if (song.id === songsList.value[i].id) {
      index = i
      break
    }
  }
  if (index === -1) {
    toast.error('未找到此歌曲')
    return
  }
  appStore.setIsSwitchingSong(true)
  appStore.setPlayQueue(songsList.value)
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)
  let flag = false
  if (appStore.getPlayData().isPlaying) {
    flag = true
  }
  appStore.togglePlay()
  appStore.setIsPlaying(true)
  await appStore.loadCurrentSong()
  setTimeout(() => {
    appStore.setIsSwitchingSong(false)
  }, 100)
  if (flag) {
    setTimeout(() => {
      appStore.togglePlay()
    }, 500)
  }
}
</script>

<template>
  <ion-page>
    <div class="song-list-page">
      <!-- 头部 -->
      <div class="song-list-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">{{ title }}</div>
      </div>

      <!-- 内容区域 -->
      <div class="content-body">
        <!-- 加载状态（可选） -->
        <div v-if="isLoading" class="loading-state">
          <Icon icon="mdi:loading" :width="32" class="loading-icon" />
          <span>加载中...</span>
        </div>

        <!-- 歌曲列表 -->
        <PlayList
          v-else
          :songs="songsList"
          @batch-delete="handleBatchDelete"
          @song-click="playSong"
        />

        <!-- 空状态 -->
        <div v-if="!isLoading && songsList.length === 0" class="empty-state">
          <Icon icon="mdi:music-off" :width="48" color="var(--text-secondary)" />
          <p>暂无歌曲，请添加或扫描</p>
        </div>
      </div>

      <!-- 底部播放栏（可选） -->
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

/* 自定义头部 */
.song-list-header {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  background-color: var(--bg-header);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
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
    background-color: rgba(0, 0, 0, 0.05);
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

/* 内容区域 */
.content-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px; /* 为底部播放栏预留空间 */
}

/* 加载 & 空状态 */
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

/* 暗色模式适配 */
.dark .song-list-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}
.dark .loading-state,
.dark .empty-state {
  color: rgba(255, 255, 255, 0.6);
}
</style>
