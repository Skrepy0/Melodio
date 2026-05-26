<template>
  <div class="now-playing-bar" v-if="song">
    <div class="progress-line">
      <div class="progress-fill-line" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <div class="bar-content">
      <div class="song-info" @click="onExpand">
        <div class="cover">
          <img v-if="song.coverUrl" :src="song.coverUrl" :alt="song.name" />
          <Icon v-else icon="mdi:music" :width="40" />
        </div>
        <div class="details">
          <div class="name">{{ song.name }}</div>
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { NowPlayingSong } from '@/utils/interface.ts'

interface Props {
  song: NowPlayingSong | null
  autoPlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoPlay: false,
})

const emit = defineEmits<{
  (e: 'play', song: NowPlayingSong): void
  (e: 'pause', song: NowPlayingSong): void
  (e: 'expand'): void
}>()

let audio: HTMLAudioElement | null = null
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const progressPercent = ref(0)

const initAudio = () => {
  if (!props.song?.audioUrl) return
  if (audio) {
    audio.pause()
    audio.src = ''
  }
  audio = new Audio(props.song.audioUrl)
  audio.addEventListener('loadedmetadata', () => {
    duration.value = audio?.duration || 0
  })
  audio.addEventListener('timeupdate', () => {
    if (audio) {
      currentTime.value = audio.currentTime
      progressPercent.value = (currentTime.value / duration.value) * 100 || 0
    }
  })
  audio.addEventListener('ended', () => {
    isPlaying.value = false
    emit('pause', props.song!)
  })
  if (props.autoPlay) {
    play()
  }
}

const play = async () => {
  if (!audio && props.song?.audioUrl) initAudio()
  if (audio) {
    await audio.play()
    isPlaying.value = true
    emit('play', props.song!)
  }
}

const pause = () => {
  if (audio) {
    audio.pause()
    isPlaying.value = false
    emit('pause', props.song!)
  }
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

watch(
  () => props.song,
  (newSong, oldSong) => {
    if (newSong?.audioUrl !== oldSong?.audioUrl) {
      initAudio()
      if (props.autoPlay && newSong) {
        play()
      } else {
        isPlaying.value = false
        currentTime.value = 0
        progressPercent.value = 0
      }
    }
  },
  { deep: true }
)

onMounted(() => {
  if (props.song?.audioUrl) {
    initAudio()
    if (props.autoPlay) play()
  }
})

onUnmounted(() => {
  if (audio) {
    audio.pause()
    audio.src = ''
    audio = null
  }
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
