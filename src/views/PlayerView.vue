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
        <img v-if="currentSong?.coverUrl" :src="currentSong.coverUrl" :alt="currentSong.name" />
        <Icon v-else icon="mdi:music" :width="120" color="var(--text-secondary)" />
      </div>
      <div class="song-info">
        <div class="song-name">{{ currentSong?.name || '未播放' }}</div>
        <div class="song-artist">{{ currentSong?.artist || '未知艺术家' }}</div>
      </div>

      <div class="progress-section">
        <div class="time-current">{{ formatTime(mockCurrentTime) }}</div>
        <div class="progress-bar-container" @click="mockSeek">
          <div class="progress-bar" ref="progressBarRef">
            <div class="progress-fill" :style="{ width: mockProgress + '%' }"></div>
            <div class="progress-handle" :style="{ left: mockProgress + '%' }"></div>
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
        <span class="drag-hint">拖动调整顺序</span>
      </div>
      <div class="queue-list" ref="queueListRef" @scroll="handleScroll">
        <div
          v-for="(song, idx) in queue"
          :key="song.id"
          class="queue-item"
          :data-index="idx"
          :class="{ 'drag-over': dragOverIndex === idx }"
        >
          <div class="drag-handle" @pointerdown="startDrag($event, idx)" style="touch-action: none">
            <Icon icon="mdi:drag-vertical" :width="20" color="var(--text-color)" />
          </div>
          <div class="queue-index">{{ getRelativeIndex(idx) }}</div>
          <div class="queue-song-info">
            <div class="queue-song-name">{{ song.name }}</div>
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
import { ref, computed, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from '@/components/button/CircleButton.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import type { Song, DropdownItem } from '@/utils/interface'

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

const queue = ref<Song[]>([
  { id: 1, name: 'Blinding Lights', artist: 'The Weeknd', coverUrl: '', duration: 200 },
  { id: 2, name: 'Shape of You', artist: 'Ed Sheeran', coverUrl: '', duration: 233 },
  { id: 3, name: 'Dance Monkey', artist: 'Tones and I', coverUrl: '', duration: 210 },
  { id: 4, name: 'Rockstar', artist: 'Post Malone', coverUrl: '', duration: 218 },
  { id: 5, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 6, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 7, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 8, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 9, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 10, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 11, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 12, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 13, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 14, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 15, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 16, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
  { id: 17, name: 'Bad Guy', artist: 'Billie Eilish', coverUrl: '', duration: 194 },
])
const currentSong = computed(() => queue.value[0] || null)

const isPlaying = ref(false)
const mockCurrentTime = ref(65)
const mockDuration = ref(200)
const mockProgress = computed(() => (mockCurrentTime.value / mockDuration.value) * 100 || 0)

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  console.log('[UI] 播放/暂停', isPlaying.value)
  // TODO: 实际播放逻辑
}
const prevSong = () => console.log('[UI] 上一首')
const nextSong = () => console.log('[UI] 下一首')
const togglePlayMode = () => {
  const modes: PlayMode[] = ['sequential', 'repeatOne', 'shuffle']
  const idx = modes.indexOf(playMode.value)
  playMode.value = modes[(idx + 1) % modes.length]
}
const shuffleQueue = () => {
  const rest = queue.value.slice(1)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  queue.value = [queue.value[0], ...rest]
}
const mockSeek = (e: MouseEvent) => {
  if (!progressBarRef.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const percent = clickX / rect.width
  mockCurrentTime.value = percent * mockDuration.value
}

const openDropdownId = ref<string | number | null>(null) // 当前打开的菜单所属歌曲ID
const menuOptions: DropdownItem[] = [
  { icon: 'mdi:play', description: '播放', value: 'play' },
  { icon: 'mdi:heart-outline', description: '喜欢', value: 'like' },
  { icon: 'mdi:delete', description: '从队列移除', value: 'remove' },
]
const onMenuItemSelect = (item: DropdownItem, song: Song) => {
  console.log('[UI] 对歌曲', song.name, '执行', item.value)
  // 根据 item.value 实现具体逻辑，例如：
  // if (item.value === 'remove') { queue.value = queue.value.filter(s => s.id !== song.id) }
  openDropdownId.value = null // 关闭菜单
}

const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
let dragItem: HTMLElement | null = null
let isDragging = false
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
  isDragging = true
  dragItem.classList.add('dragging-source')
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', stopDrag)
}

const onDragMove = (e: PointerEvent) => {
  if (!isDragging || dragStartIndex.value === null) return
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
  if (!isDragging) return
  if (e.pointerId !== pointerId) return
  if (dragItem) {
    dragItem.classList.remove('dragging-source')
    if (dragItem.hasPointerCapture?.(pointerId)) dragItem.releasePointerCapture(pointerId)
  }
  dragStartIndex.value = null
  dragOverIndex.value = null
  dragItem = null
  isDragging = false
  pointerId = null
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', stopDrag)
}

onUnmounted(() => {
  if (isDragging) stopDrag(new PointerEvent('pointerup'))
})

const getRelativeIndex = (idx: number) => (idx === 0 ? '0' : `+${idx}`)

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

const progressBarRef = ref<HTMLElement | null>(null)

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
    pointer-events: none;
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
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
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
