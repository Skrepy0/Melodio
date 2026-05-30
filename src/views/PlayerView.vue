<template>
  <div class="player-view">
    <div class="back-button">
      <CircleButton
        icon="mdi:arrow-left"
        :size="40"
        icon-color="var(--text-color)"
        @click="$router.back()"
      />
    </div>

    <div class="player-header" :class="{ collapsed: isHeaderCollapsed }">
      <div class="album-cover">
        <img
          v-if="currentSong?.albumArtUri"
          :src="currentSong.albumArtUri"
          :alt="currentSong.title"
        />
        <Icon v-else icon="mdi:music" :width="120" color="var(--text-secondary)" />
      </div>
      <div class="song-info">
        <div class="song-name">{{ currentSong?.title || '未播放' }}</div>
        <div class="song-artist">{{ currentSong?.artist || '未知艺术家' }}</div>
      </div>

      <div class="progress-section">
        <div class="time-current">{{ formatTime(mockCurrentTime) }}</div>
        <div
          class="progress-bar-container"
          @click="mockSeek"
          @mousedown="startDragProgress"
          @touchstart="startDragProgress"
        >
          <div
            class="progress-bar"
            ref="progressBarRef"
            @mousedown="startDragProgress"
            @touchstart="startDragProgress"
          >
            <div
              class="progress-fill"
              :style="{ width: progressPercent + '%' }"
              @mousedown="startDragProgress"
              @touchstart="startDragProgress"
            ></div>
            <div
              class="progress-handle"
              :style="{ left: progressPercent + '%' }"
              @mousedown="startDragProgress"
              @touchstart="startDragProgress"
            ></div>
          </div>
        </div>
        <div class="time-duration">{{ formatTime(mockDuration) }}</div>
      </div>

      <div class="controls">
        <button class="control-btn" @click="togglePlay" :title="playModeText">
          <Icon :icon="playModeIcon" :width="24" color="var(--text-color)" />
        </button>
        <button class="control-btn" @click="prevSong">
          <Icon icon="mdi:skip-previous" :width="32" color="var(--text-color)" />
        </button>
        <button class="control-btn play-pause" @click="togglePlay">
          <Icon
            :icon="isPlaying ? 'mdi:pause-circle' : 'mdi:play-circle'"
            :width="48"
            color="var(--primary-color, #007aff)"
          />
        </button>
        <button class="control-btn" @click="nextSong">
          <Icon icon="mdi:skip-next" :width="32" color="var(--text-color)" />
        </button>
        <button class="control-btn" @click="shuffleQueue">
          <Icon icon="mdi:shuffle-variant" :width="24" color="var(--text-color)" />
        </button>
      </div>
    </div>

    <div class="queue-container">
      <div class="queue-header">
        <span>播放队列 ({{ queue.length }})</span>
        <div class="queue-actions">
          <span class="drag-hint">拖动调整顺序</span>
          <button class="clear-queue-btn" @click="clearQueue" v-if="queue.length > 0">清空</button>
        </div>
      </div>
      <div class="queue-list" ref="queueListRef" @scroll="handleScroll">
        <div
          v-for="(song, idx) in queue"
          :key="song.id"
          class="queue-item"
          :data-index="idx"
          :class="{ 'drag-over': dragOverIndex === idx }"
          @click="playSong(song)"
        >
          <div class="drag-handle" @pointerdown="startDrag($event, idx)" style="touch-action: none">
            <Icon icon="mdi:drag-vertical" :width="20" color="var(--text-color)" />
          </div>
          <div class="queue-index">{{ getRelativeIndex(idx) }}</div>
          <div class="queue-song-info">
            <div class="queue-song-name">{{ song.title }}</div>
            <div class="queue-song-artist">{{ song.artist }}</div>
          </div>
          <DropdownButton
            :visible="openDropdownId === song.id"
            :button-icon="'mdi:dots-vertical'"
            :size="32"
            :options="menuOptions"
            :offset-x="0"
            :offset-y="4"
            :dx="-40"
            :dy="-60"
            placement="bottom-end"
            @select="(item) => onMenuItemSelect(item, song)"
            @click.stop
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PlayerView' })
import { ref, computed, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from '@/components/button/CircleButton.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { type Song, type DropdownItem } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import { MediaSession } from '@pejota14/capacitor-media-session'
import toast from '@/utils/createToast'
import { audio } from '@/utils/createAudio'

const appStore = useAppStore()
type PlayMode = 'sequential' | 'repeatOne' | 'shuffle'
const playMode = ref<PlayMode>('sequential')
const playModeIcon = computed(() => {
  switch (playMode.value) {
    case 'sequential':
      return 'mdi:repeat'
    case 'repeatOne':
      return 'mdi:repeat-once'
    case 'shuffle':
      return 'mdi:shuffle'
    default:
      return 'mdi:repeat'
  }
})
const playModeText = computed(() => {
  switch (playMode.value) {
    case 'sequential':
      return '顺序播放'
    case 'repeatOne':
      return '单曲循环'
    case 'shuffle':
      return '随机播放'
    default:
      return '顺序播放'
  }
})

const queue = computed(() => appStore.getPlayQueue())
const currentSong = computed(() => appStore.currentSong)
const isPlaying = computed(() => appStore.getPlayData().isPlaying)
const mockCurrentTime = computed(() => appStore.getPlayData().mockCurrentTime)
const mockDuration = computed(() => currentSong.value?.duration / 1000 || 0)
const progressPercent = computed(() => (mockCurrentTime.value / mockDuration.value) * 100 || 0)
const localQueue = ref<Song[]>(appStore.getPlayQueue())
watch(
  queue,
  (newQueue) => {
    localQueue.value = newQueue
  },
  { immediate: true }
)
audio.addEventListener('timeupdate', () => {
  if (isDraggingProgress) return
  appStore.setMockCurrentTime(audio.currentTime)
})
const playSong = async (song: Song) => {
  const targetIdx = localQueue.value.findIndex((s) => s.id === song.id)
  if (targetIdx === -1) return
  const currentIdx = appStore.getPlayData().currentIndex
  if (targetIdx === currentIdx) {
    if (!isPlaying.value) {
      appStore.togglePlay()
    }
    return
  }
  appStore.setIsSwitchingSong(true)
  appStore.setCurrentIndex(targetIdx)
  appStore.setIsPlaying(true)
  if (isPlaying.value) {
    togglePlay()
  } else {
    togglePlay()
    togglePlay()
  }
  appStore.setMockCurrentTime(0)
  await appStore.loadCurrentSong()
  setTimeout(() => {
    appStore.setIsSwitchingSong(false)
  }, 100)
  setTimeout(() => {
    togglePlay()
  }, 500)
}
const registerMediaSessionHandlers = () => {
  MediaSession.setActionHandler({ action: 'play' }, () => {
    console.log('[MediaSession] play')
    appStore.togglePlay()
  })
  MediaSession.setActionHandler({ action: 'pause' }, () => {
    console.log('[MediaSession] pause')
    appStore.togglePlay()
  })
  MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
    console.log('[MediaSession] next')
    appStore.nextSong()
  })
  MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
    console.log('[MediaSession] previous')
    appStore.prevSong()
  })
}

registerMediaSessionHandlers()
audio.addEventListener('play', () => {
  MediaSession.setPlaybackState({ playbackState: 'playing' })
})
audio.addEventListener('pause', () => {
  MediaSession.setPlaybackState({ playbackState: 'paused' })
})

const togglePlay = () => appStore.togglePlay()
const prevSong = () => {
  appStore.prevSong()
}
const nextSong = () => {
  appStore.nextSong()
}

const clearQueue = () => {
  appStore.setPlayQueue([])
  audio.pause()
  appStore.setIsPlaying(false)
  appStore.setCurrentIndex(0)
  appStore.setMockCurrentTime(0)
  openDropdownId.value = null
}

const shuffleQueue = () => {
  if (localQueue.value.length <= 1) return
  const rest = localQueue.value.slice(1)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  const newQueue = [localQueue.value[0], ...rest]
  appStore.setPlayQueue(newQueue)
}

const progressBarRef = ref<HTMLElement | null>(null)
let isDraggingProgress = false

const updateProgressByEvent = (e: MouseEvent | TouchEvent) => {
  if (!progressBarRef.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  let clickX = clientX - rect.left
  clickX = Math.max(0, Math.min(clickX, rect.width))
  const percent = clickX / rect.width
  let newTime = percent * mockDuration.value
  newTime = Math.max(0, Math.min(newTime, mockDuration.value))
  appStore.setMockCurrentTime(newTime)
}

const startDragProgress = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  isDraggingProgress = true
  updateProgressByEvent(e)
  document.addEventListener('mousemove', onDragProgress)
  document.addEventListener('mouseup', stopDragProgress)
  document.addEventListener('touchmove', onDragProgress)
  document.addEventListener('touchend', stopDragProgress)
}

const onDragProgress = (e: MouseEvent | TouchEvent) => {
  if (!isDraggingProgress) return
  e.preventDefault()
  updateProgressByEvent(e)
}

const stopDragProgress = async () => {
  if (!isDraggingProgress) return
  isDraggingProgress = false
  const targetTime = Math.max(
    0,
    Math.min(appStore.getPlayData().mockCurrentTime, mockDuration.value)
  )
  appStore.setMockCurrentTime(targetTime)
  await audio.seek(targetTime)
  document.removeEventListener('mousemove', onDragProgress)
  document.removeEventListener('mouseup', stopDragProgress)
  document.removeEventListener('touchmove', onDragProgress)
  document.removeEventListener('touchend', stopDragProgress)
}

const mockSeek = async (e: MouseEvent) => {
  updateProgressByEvent(e)
  const targetTime = Math.max(
    0,
    Math.min(appStore.getPlayData().mockCurrentTime, mockDuration.value)
  )
  await audio.seek(targetTime)
}

const openDropdownId = ref<string | number | null>(null)
const menuOptions: DropdownItem[] = [
  { icon: 'mdi:play', description: '播放', value: 'play' },
  { icon: 'mdi:heart-outline', description: '喜欢', value: 'like' },
  { icon: 'mdi:delete', description: '从队列移除', value: 'remove' },
]
const onMenuItemSelect = (item: DropdownItem, song: Song) => {
  console.log('[UI] 对歌曲', song.title, '执行', item.value)
  if (item.value === 'play') {
    playSong(song)
  } else if (item.value === 'like') {
    console.log('[UI] 喜欢歌曲', song.title)
    toast.success(`已添加 ${song.title} 到“我喜欢的音乐”`)
  } else if (item.value === 'remove') {
    const idx = localQueue.value.findIndex((s) => s.id === song.id)
    if (idx !== -1) {
      const newQueue = [...localQueue.value]
      newQueue.splice(idx, 1)
      appStore.setPlayQueue(newQueue)
      if (idx < appStore.getPlayData().currentIndex) {
        appStore.setCurrentIndex(appStore.getPlayData().currentIndex - 1)
      } else if (idx === appStore.getPlayData().currentIndex) {
        if (newQueue.length === 0) {
          audio.pause()
          appStore.setIsPlaying(false)
          appStore.setMockCurrentTime(0)
        } else {
          const newIndex = Math.min(appStore.getPlayData().currentIndex, newQueue.length - 1)
          appStore.setCurrentIndex(newIndex)
        }
      }
    }
  }
  openDropdownId.value = null
}

const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
let dragItem: HTMLElement | null = null
let isDraggingQueue = false
let pointerId: number | null = null

const startDrag = (e: PointerEvent, idx: number) => {
  if (e.button !== 0 && e.pointerType !== 'touch') return
  e.preventDefault()
  dragStartIndex.value = idx
  const target = (e.target as HTMLElement).closest('.queue-item')
  if (!target) return
  dragItem = target as HTMLElement
  dragItem.setPointerCapture(e.pointerId)
  pointerId = e.pointerId
  isDraggingQueue = true
  dragItem.classList.add('dragging-source')
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', stopDrag)
}

const onDragMove = (e: PointerEvent) => {
  if (!isDraggingQueue || dragStartIndex.value === null) return
  if (e.pointerId !== pointerId) return
  e.preventDefault()
  const elements = document.elementsFromPoint(e.clientX, e.clientY)
  const targetItem = elements.find((el) => el.classList?.contains('queue-item')) as HTMLElement
  if (targetItem && targetItem !== dragItem) {
    const overIndex = parseInt(targetItem.dataset.index || '-1')
    if (overIndex !== -1 && overIndex !== dragOverIndex.value) {
      dragOverIndex.value = overIndex
      if (dragStartIndex.value !== overIndex) {
        const newQueue = [...localQueue.value]
        const [movedItem] = newQueue.splice(dragStartIndex.value, 1)
        newQueue.splice(overIndex, 0, movedItem)
        localQueue.value = newQueue
        appStore.setPlayQueue(newQueue)
        const currentSongId = currentSong.value?.id
        if (currentSongId && movedItem.id === currentSongId) {
          appStore.setCurrentIndex(overIndex)
        } else if (currentSongId) {
          const newCurrentIdx = newQueue.findIndex((s) => s.id === currentSongId)
          if (newCurrentIdx !== -1 && newCurrentIdx !== appStore.getPlayData().currentIndex) {
            appStore.setCurrentIndex(newCurrentIdx)
          }
        }
        dragStartIndex.value = overIndex
        dragItem = document.querySelector(`.queue-item[data-index="${overIndex}"]`) as HTMLElement
        if (dragItem) dragItem.classList.add('dragging-source')
      }
    }
  }
}

const stopDrag = (e: PointerEvent) => {
  if (!isDraggingQueue) return
  if (e.pointerId !== pointerId) return
  if (dragItem) {
    dragItem.classList.remove('dragging-source')
    if (dragItem.hasPointerCapture?.(pointerId)) dragItem.releasePointerCapture(pointerId)
  }
  dragStartIndex.value = null
  dragOverIndex.value = null
  dragItem = null
  isDraggingQueue = false
  pointerId = null
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', stopDrag)
}

const getRelativeIndex = (idx: number) => {
  const diff = idx - appStore.getPlayData().currentIndex
  if (diff === 0) return '0'
  return diff > 0 ? `+${diff}` : `${diff}`
}

const queueListRef = ref<HTMLElement | null>(null)
const isHeaderCollapsed = ref(false)
const COLLAPSE_THRESHOLD = 50
let scrollTimer: ReturnType<typeof setTimeout> | null = null

const handleScroll = () => {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    if (!queueListRef.value) return
    const scrollTop = queueListRef.value.scrollTop
    if (scrollTop > COLLAPSE_THRESHOLD && !isHeaderCollapsed.value) {
      isHeaderCollapsed.value = true
    } else if (scrollTop <= 5 && isHeaderCollapsed.value) {
      isHeaderCollapsed.value = false
    }
  }, 50)
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
onUnmounted(() => {
  if (isDraggingQueue) stopDrag(new PointerEvent('pointerup'))
  MediaSession.setActionHandler({ action: 'play' }, null)
  MediaSession.setActionHandler({ action: 'pause' }, null)
  MediaSession.setActionHandler({ action: 'nexttrack' }, null)
  MediaSession.setActionHandler({ action: 'previoustrack' }, null)
})

defineExpose({ queue: localQueue, currentSong, playMode, togglePlay, prevSong, nextSong })
</script>

<style scoped lang="scss">
.player-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

.back-button {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 200;
}

.player-header {
  background: var(--bg-header);
  padding: 20px;
  transition: all 0.3s ease;
  flex-shrink: 0;
  overflow: hidden;

  &.collapsed {
    padding: 10px 20px;
    .album-cover img,
    .album-cover svg {
      width: 60px;
      height: 60px;
    }
    .song-name {
      font-size: 14px;
    }
    .song-artist {
      font-size: 12px;
    }
    .progress-section {
      margin: 8px 0;
    }
    .control-btn.play-pause svg {
      width: 32px;
      height: 32px;
    }
  }
}

.album-cover {
  text-align: center;
  margin-bottom: 16px;
  img,
  svg {
    width: 180px;
    height: 180px;
    border-radius: 12px;
    object-fit: cover;
    transition: all 0.3s ease;
  }
}

.song-info {
  text-align: center;
  margin-bottom: 20px;
  .song-name {
    font-size: 20px;
    font-weight: bold;
    color: var(--text-color);
  }
  .song-artist {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  .time-current,
  .time-duration {
    font-size: 12px;
    color: var(--text-secondary);
    font-feature-settings: 'tnum';
  }
  .progress-bar-container {
    flex: 1;
    cursor: pointer;
  }
  .progress-bar {
    position: relative;
    height: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
  }
  .progress-fill {
    position: absolute;
    height: 100%;
    background: var(--primary-color, #007aff);
    border-radius: 2px;
  }
  .progress-handle {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: var(--primary-color, #007aff);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .progress-bar:hover .progress-handle {
    opacity: 1;
  }
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  .control-btn {
    background: none;
    border: none;
    cursor: pointer;
    transition: transform 0.1s;
    &:active {
      transform: scale(0.95);
    }
  }
}

.queue-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-color);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.queue-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drag-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.clear-queue-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--danger-color, #ff4d4f);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 77, 79, 0.1);
  }
}

.queue-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 4px;
  background: var(--bg-card, transparent);
  border-radius: 8px;
  user-select: none;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-card-hover, rgba(0, 0, 0, 0.02));
  }

  &.dragging-source {
    opacity: 0.5;
    background: var(--primary-color-light, rgba(0, 122, 255, 0.1));
  }
  &.drag-over {
    border-top: 2px solid var(--primary-color, #007aff);
  }

  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    touch-action: none;
    &:active {
      cursor: grabbing;
    }
  }

  .queue-index {
    width: 40px;
    font-size: 13px;
    font-family: monospace;
    color: var(--text-color);
    text-align: center;
  }

  .queue-song-info {
    flex: 1;
    min-width: 0;
    .queue-song-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .queue-song-artist {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.dark {
  .queue-item {
    background: var(--bg-card, #1e1e1e);
    &:hover {
      background: var(--bg-card-hover, #2c2c2c);
    }
  }
  .progress-bar {
    background: rgba(255, 255, 255, 0.2);
  }
}
</style>
