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
        <div class="progress-bar-container" @click="mockSeek">
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
        <button class="control-btn" @click="togglePlayMode" :title="playModeText">
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
import { ref, computed, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from '@/components/button/CircleButton.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { type Song, type DropdownItem, emptySong } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import { MediaSession } from '@pejota14/capacitor-media-session'
import toast from '@/utils/createToast'
import { audio } from '@/utils/createAudio'
import { getNextSongIndex, getPrevSongIndex } from '@/utils/control'

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

const playData = appStore.getPlayData()
const queue = ref<Song[]>(appStore.getPlayQueue())
const currentIndex = ref(playData.currentIndex)
const currentSong = computed(() => queue.value[currentIndex.value] || null)
const isPlaying = ref(playData.isPlaying)
const mockCurrentTime = ref(playData.mockCurrentTime)
const mockDuration = ref(currentSong.value?.duration / 1000)
let isSwitchingSong = false
const progressPercent = ref(computed(() => (mockCurrentTime.value / mockDuration.value) * 100 || 0))

const updateMeta = () => {
  audio.setSong(currentSong.value || emptySong)
}
const playSong = async (song: Song) => {
  const targetIdx = queue.value.findIndex((s) => s.id === song.id)
  if (targetIdx === -1) return
  if (targetIdx === currentIndex.value) {
    if (!isPlaying.value) {
      await audio.play()
      isPlaying.value = true
    }
    return
  }
  currentIndex.value = targetIdx
  isSwitchingSong = true
  setTimeout(() => {
    isSwitchingSong = false
  }, 100)
}
const loadCurrentSong = async () => {
  const song = currentSong.value
  if (!song) return
  try {
    await audio.setSrc(song.uri)
    mockDuration.value = song.duration / 1000 || 0
    await updateMeta()
    if (isPlaying.value) {
      await audio.play()
    }
  } catch (e) {
    console.error(e)
    toast.error('播放失败')
  }
}

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

audio.addEventListener('timeupdate', () => {
  if (!isDraggingProgress) {
    mockCurrentTime.value = audio.currentTime
  }
})
audio.addEventListener('ended', () => {
  if (!isSwitchingSong) {
    nextSong()
  }
})

let lastLoadedSongId: string | number | null = null

watch(currentSong, async (newSong) => {
  if (!newSong) return
  if (lastLoadedSongId === newSong.id) return
  lastLoadedSongId = newSong.id
  mockCurrentTime.value = 0
  await loadCurrentSong()
})

watch(currentIndex, () => {
  appStore.setCurrentIndex(currentIndex.value)
})

watch(isPlaying, (newValue) => {
  appStore.setIsPlaying(newValue)
  if (newValue) {
    const song = currentSong.value
    if (song && lastLoadedSongId !== song.id) {
      // 如果当前歌曲尚未加载，则由 currentSong 的 watch 负责加载，此处不重复调用
    }
    audio.updateMetadata(song || emptySong)
  } else {
    audio.pause()
    mockCurrentTime.value = audio.currentTime
  }
})

watch(mockCurrentTime, () => {
  appStore.setMockCurrentTime(mockCurrentTime.value)
})

watch(currentSong, (newValue) => {
  if (newValue) {
    updateMediaSession(newValue)
  }
})

const togglePlay = () => {
  if (isPlaying.value) {
    audio.pause()
  } else {
    audio.play().catch((e) => toast.error('播放失败:' + e))
  }
  isPlaying.value = !isPlaying.value
}

const prevSong = () => {
  if (isSwitchingSong) return
  isSwitchingSong = true

  const req = getPrevSongIndex(currentIndex.value, queue.value.length)
  if (req.meg === 'error') {
    toast.warning('当前队列里没有歌曲')
    isSwitchingSong = false
    return
  }
  currentIndex.value = req.idx
  console.log('[UI] 上一首')

  setTimeout(() => {
    isSwitchingSong = false
  }, 100)
}

const nextSong = () => {
  if (isSwitchingSong) return
  isSwitchingSong = true

  const req = getNextSongIndex(currentIndex.value, queue.value.length)
  if (req.meg === 'error') {
    toast.warning('当前队列里没有歌曲')
    isSwitchingSong = false
    return
  }
  currentIndex.value = req.idx
  console.log('[UI] 下一首')

  setTimeout(() => {
    isSwitchingSong = false
  }, 100)
}
const clearQueue = () => {
  queue.value = []
  appStore.setPlayQueue(queue.value)
  audio.pause()
  isPlaying.value = false
  currentIndex.value = 0
  mockCurrentTime.value = 0
  mockDuration.value = 0
  lastLoadedSongId = null
  openDropdownId.value = null
}
const togglePlayMode = () => {
  const modes: PlayMode[] = ['sequential', 'repeatOne', 'shuffle']
  const idx = modes.indexOf(playMode.value)
  playMode.value = modes[(idx + 1) % modes.length]
}

const shuffleQueue = () => {
  if (queue.value.length <= 1) return
  const rest = queue.value.slice(1)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  queue.value = [queue.value[0], ...rest]
  appStore.setPlayQueue(queue.value)
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
  mockCurrentTime.value = newTime
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
  const targetTime = Math.max(0, Math.min(mockCurrentTime.value, mockDuration.value))
  mockCurrentTime.value = targetTime
  await audio.seek(targetTime)
  document.removeEventListener('mousemove', onDragProgress)
  document.removeEventListener('mouseup', stopDragProgress)
  document.removeEventListener('touchmove', onDragProgress)
  document.removeEventListener('touchend', stopDragProgress)
}

const mockSeek = async (e: MouseEvent) => {
  updateProgressByEvent(e)
  const targetTime = Math.max(0, Math.min(mockCurrentTime.value, mockDuration.value))
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
  }

  if (item.value === 'like') {
    console.log('[UI] 喜欢歌曲', song.title)
    toast.success(`已添加 ${song.title} 到“我喜欢的音乐”`)
    openDropdownId.value = null
    return
  }

  if (item.value === 'remove') {
    const idx = queue.value.findIndex((s) => s.id === song.id)
    if (idx === -1) {
      openDropdownId.value = null
      return
    }

    queue.value.splice(idx, 1)
    appStore.setPlayQueue(queue.value)

    if (queue.value.length === 0) {
      audio.pause()
      isPlaying.value = false
      mockCurrentTime.value = 0
      mockDuration.value = 0
      currentIndex.value = 0
      lastLoadedSongId = null
      openDropdownId.value = null
      return
    }

    // 调整当前播放索引
    if (idx < currentIndex.value) {
      currentIndex.value--
    } else if (idx === currentIndex.value) {
      if (currentIndex.value >= queue.value.length) {
        currentIndex.value = queue.value.length - 1
      }
      lastLoadedSongId = null
    }
    // idx > currentIndex 时不变

    openDropdownId.value = null
    return
  }

  console.warn('[UI] 未处理的菜单项:', item.value)
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
        const newQueue = [...queue.value]
        const [movedItem] = newQueue.splice(dragStartIndex.value, 1)
        newQueue.splice(overIndex, 0, movedItem)
        queue.value = newQueue
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
  appStore.setPlayQueue(queue.value)
}

const getRelativeIndex = (idx: number) => {
  const diff = idx - currentIndex.value
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

defineExpose({ queue, currentSong, playMode, togglePlay, prevSong, nextSong })
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
