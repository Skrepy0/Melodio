<template>
  <div class="now-playing-bar" v-if="song">
    <div class="progress-line">
      <div class="progress-fill-line" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <div class="bar-content">
      <div class="song-info" @click="onExpand">
        <div class="cover">
          <img v-if="song.albumArtUri" :src="song.albumArtUri" :alt="song.title" />
          <Icon v-else icon="mdi:music" :width="40" />
        </div>
        <div class="details">
          <div class="name">{{ song.title }}</div>
          <div class="artist">{{ song.artist }}</div>
        </div>
      </div>

      <div class="player-controls">
        <div class="time-info">
          <span>{{ formatTime(currentTime) }}</span>
          <span>/</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
        <div class="action-buttons">
          <button class="play-pause-btn" @click="togglePlay">
            <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" :width="28" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { emptySong, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import { audio } from '@/utils/createAudio'
import { MediaSession } from '@pejota14/capacitor-media-session'
import toast from '@/utils/createToast'
import { getNextSongIndex, getPrevSongIndex } from '@/utils/control'
const appStore = useAppStore()
const playData = appStore.getPlayData()
const song = ref(appStore.getPlayQueue()[playData.currentIndex] || emptySong)
const emit = defineEmits<{
  (e: 'expand'): void
}>()
const registerMediaSessionHandlers = () => {
  MediaSession.setActionHandler({ action: 'play' }, () => {
    console.log('[MediaSession] play')
    audio.play()
    isPlaying.value = true
  })
  MediaSession.setActionHandler({ action: 'pause' }, () => {
    console.log('[MediaSession] pause')
    audio.pause()
    isPlaying.value = false
  })
  MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
    console.log('[MediaSession] next')
    nextSong()
  })
  MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
    console.log('[MediaSession] previous')
    prevSong()
  })
}
const updateMediaSession = (song: Song) => {
  if (!song) return
  MediaSession.setPlaybackState({ playbackState: isPlaying.value ? 'playing' : 'paused' })
}

registerMediaSessionHandlers()

audio.addEventListener('play', () => {
  MediaSession.setPlaybackState({ playbackState: 'playing' })
})
audio.addEventListener('pause', () => {
  MediaSession.setPlaybackState({ playbackState: 'paused' })
})
const isPlaying = ref(playData.isPlaying)
const currentTime = ref(playData.mockCurrentTime)
onMounted(() => {
  if (appStore.getHomeFlag()) return
  appStore.setHomeFlag(true)
  isPlaying.value = false
})
const duration = ref(song.value.duration / 1000)
const progressPercent = ref(computed(() => (currentTime.value / duration.value) * 100 || 0))
audio.addEventListener('timeupdate', () => {
  currentTime.value = audio.currentTime
})
const play = async () => {
  isPlaying.value = true
  audio.play().catch((e) => {
    console.error(e)
    toast.error('播放失败:' + e)
  })
  audio.setSong(song.value || emptySong)
}
const updateSongStatus = async () => {
  currentTime.value = 0
  const playData = appStore.getPlayData()
  song.value = appStore.getPlayQueue()[playData.currentIndex] || null
  if (!song.value) return
  try {
    await audio.setSrc(song.value.uri)
    duration.value = song.value.duration / 1000 || 0
    if (isPlaying.value) {
      await audio.play()
    }
  } catch (e) {
    console.error(e)
    toast.error('播放失败')
  }
}
const nextSong = () => {
  const currentIndex = appStore.getPlayData().currentIndex
  const req = getNextSongIndex(currentIndex, appStore.getPlayQueue().length)
  if (req.meg === 'error') {
    toast.warning('当前队列里没有歌曲')
  } else {
    if (currentIndex === req.idx) return
    appStore.setCurrentIndex(req.idx)
    updateSongStatus()
  }
}
const prevSong = () => {
  const currentIndex = appStore.getPlayData().currentIndex
  const req = getPrevSongIndex(currentIndex, appStore.getPlayQueue().length)
  if (req.meg === 'error') {
    toast.warning('当前队列里没有歌曲')
  } else {
    if (currentIndex === req.idx) return
    appStore.setCurrentIndex(req.idx)
    updateSongStatus()
  }
}
const pause = () => {
  audio.pause()
  isPlaying.value = false
}

const togglePlay = () => {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const onExpand = () => {
  emit('expand')
}

watch(song, (newSong) => {
  duration.value = newSong.duration / 1000

  if (newSong) updateMediaSession(newSong)
})
watch(isPlaying, () => {
  appStore.setIsPlaying(isPlaying.value)
})
watch(currentTime, () => {
  appStore.setMockCurrentTime(currentTime.value)
})
onUnmounted(() => {
  MediaSession.setActionHandler({ action: 'play' }, null)
  MediaSession.setActionHandler({ action: 'pause' }, null)
  MediaSession.setActionHandler({ action: 'nexttrack' }, null)
  MediaSession.setActionHandler({ action: 'previoustrack' }, null)
})
</script>

<style scoped lang="scss">
.now-playing-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-header, #f8f9fa);
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bg-header-rgb, 248, 249, 250), 0.95);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  z-index: 100;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
}

/* 顶部进度条 */
.progress-line {
  height: 2px;
  background-color: rgba(0, 0, 0, 0.1);
  width: 100%;
  overflow: hidden;
}

.progress-fill-line {
  height: 100%;
  background-color: var(--primary-color, #007aff);
  width: 0%;
  transition: width 0.1s linear;
}

/* 主要内容区域 */
.bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
}

.song-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--bg-placeholder, #e0e0e0);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.details {
  flex: 1;
  min-width: 0;
  .name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-color, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist {
    font-size: 12px;
    color: var(--text-secondary, #666);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-info {
  display: flex;
  gap: 4px;
  font-size: 12px;
  font-feature-settings: 'tnum';
  color: var(--text-secondary, #666);
}

.action-buttons {
  flex-shrink: 0;
  .play-pause-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-color, #333);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    transition: transform 0.1s;

    &:active {
      transform: scale(0.96);
    }
  }
}

// 暗色模式
.dark {
  .now-playing-bar {
    background-color: rgba(var(--bg-header-rgb, 30, 30, 35), 0.95);
  }
  .progress-line {
    background-color: rgba(255, 255, 255, 0.2);
  }
}

// 移动端优化
@media (max-width: 640px) {
  .bar-content {
    padding: 8px 12px;
    gap: 12px;
  }
  .cover {
    width: 40px;
    height: 40px;
  }
  .details .name {
    font-size: 13px;
  }
  .details .artist {
    font-size: 11px;
  }
  .time-info {
    font-size: 10px;
  }
}
</style>
