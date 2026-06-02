<template>
  <div class="now-playing-bar" v-if="currentSong">
    <div class="progress-line">
      <div class="progress-fill-line" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <div class="bar-content">
      <div class="song-info" @click="onExpand">
        <div class="cover">
          <img
            v-if="coverSrc && coverSrc !== DEFAULT_COVER"
            :src="coverSrc"
            :alt="currentSong.title"
            @error="coverSrc = DEFAULT_COVER"
          />
          <Icon v-else icon="mdi:music" :width="40" />
        </div>
        <div class="details">
          <div class="name">{{ currentSong.title }}</div>
          <div class="artist">{{ currentSong.artist }}</div>
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
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
import { audio } from '@/utils/createAudio'
import { fetchCoverFromWeb, DEFAULT_COVER } from '@/utils/functions'

const appStore = useAppStore()

const currentSong = computed(() => appStore.currentSong)
const isPlaying = computed(() => appStore.getPlayData().isPlaying)
const currentTime = ref(appStore.getPlayData().mockCurrentTime)
const duration = computed(() =>
  currentSong.value?.duration ? currentSong.value.duration / 1000 : 0
)
const progressPercent = computed(() =>
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
)

const emit = defineEmits<{
  (e: 'expand'): void
}>()

const onExpand = () => {
  emit('expand')
}

let timeUpdateHandler: (() => void) | null = null

onMounted(() => {
  timeUpdateHandler = () => {
    currentTime.value = audio.currentTime
  }
  audio.addEventListener('timeupdate', timeUpdateHandler)
})

onUnmounted(() => {
  if (timeUpdateHandler) {
    audio.removeEventListener('timeupdate', timeUpdateHandler)
  }
})

const togglePlay = () => {
  appStore.togglePlay().catch(() => {})
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const coverSrc = ref('')
let coverAbort: AbortController | null = null

const resolveCover = async (song: any) => {
  if (coverAbort) coverAbort.abort()
  coverAbort = new AbortController()
  const signal = coverAbort.signal

  if (!song) {
    coverSrc.value = DEFAULT_COVER
    return
  }
  if ((song.albumArtUri && song.albumArtUri.trim() !== '') || !appStore.getCanFetchCoverFromWeb()) {
    coverSrc.value = song.albumArtUri
    return
  }
  try {
    const url = await fetchCoverFromWeb(song.title, song.artist || '')
    if (!signal.aborted) {
      coverSrc.value = url || DEFAULT_COVER
    }
  } catch {
    if (!signal.aborted) {
      coverSrc.value = DEFAULT_COVER
    }
  }
}

watch(currentSong, (s) => resolveCover(s), { immediate: true })

onUnmounted(() => {
  coverAbort?.abort()
})
</script>

<style scoped lang="scss">
.now-playing-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-header);
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bg-header-rgb), 0.95);
  border-top: 1px solid var(--bottom-actions-border);
  z-index: 100;
  box-shadow: var(--shadow-bottom);
}

.progress-line {
  height: 2px;
  background-color: var(--progress-track);
  width: 100%;
  overflow: hidden;
}

.progress-fill-line {
  height: 100%;
  background-color: var(--primary-color);
  width: 0%;
  transition: width 0.1s linear;
}

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
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist {
    font-size: 12px;
    color: var(--text-secondary);
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
  color: var(--text-secondary);
}

.action-buttons {
  flex-shrink: 0;
  .play-pause-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-color);
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

/* 响应式样式保持不变 */
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
