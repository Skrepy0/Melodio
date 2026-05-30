<script setup lang="ts">
import router from '@/router'
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import PlayList from '@/components/PlayList.vue'
import NowPlayingBar from '@/components/NowPlayingBar.vue'

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
const isLoading = ref(false) // 可扩展加载状态

const goBack = () => {
  router.back()
}

const showFullPlayer = () => {
  router.push('/player-view')
}

const handleBatchDelete = (ids: any) => {
  console.log('删除歌曲 IDs:', ids)
  // 调用 API 删除，并更新本地列表
}

const playSong = (song: Song) => {
  console.log('播放歌曲:', song)
  // 实际播放逻辑可由父组件或 store 处理
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
