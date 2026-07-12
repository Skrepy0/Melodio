<template>
  <div class="player-view">
    <div class="back-button">
      <CircleButton
        :size="40"
        icon="mdi:arrow-left"
        icon-color="var(--text-color)"
        @click="$router.back()"
      />
    </div>

    <div class="rate-button-top-right">
      <button :title="t('player.speed')" class="rate-fab" @click="cyclePlaybackRate">
        <span class="rate-text">{{ currentRate }}x</span>
      </button>
    </div>

    <div :class="{ collapsed: isHeaderCollapsed }" class="player-header">
      <div class="album-cover">
        <img
          v-if="coverSrc && coverSrc !== DEFAULT_COVER"
          :alt="currentSong?.title"
          :src="coverSrc"
          @error="coverSrc = DEFAULT_COVER"
        />
        <Icon v-else :width="120" color="var(--text-secondary)" icon="mdi:music" />
      </div>
      <div class="song-info">
        <div class="song-name">{{ currentSong?.title || $t('player.unknownTitle') }}</div>
        <div class="song-artist">{{ currentSong?.artist || $t('player.unknownArtist') }}</div>
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
            ref="progressBarRef"
            class="progress-bar"
            @mousedown="startDragProgress"
            @touchstart="startDragProgress"
          >
            <div
              :style="{ width: progressPercent + '%' }"
              class="progress-fill"
              @mousedown="startDragProgress"
              @touchstart="startDragProgress"
            ></div>
            <div
              :style="{ left: progressPercent + '%' }"
              class="progress-handle"
              @mousedown="startDragProgress"
              @touchstart="startDragProgress"
            ></div>
          </div>
        </div>
        <div class="time-duration">{{ formatTime(mockDuration) }}</div>
      </div>

      <div class="controls">
        <button :title="playModeText" class="control-btn" @click="togglePlayMode">
          <Icon :icon="playModeIcon" :width="24" color="var(--text-color)" />
        </button>
        <button class="control-btn" @click="prevSong">
          <Icon :width="32" color="var(--text-color)" icon="mdi:skip-previous" />
        </button>
        <button class="control-btn play-pause" @click="togglePlay">
          <Icon
            :icon="isPlaying ? 'mdi:pause-circle' : 'mdi:play-circle'"
            :width="48"
            color="var(--primary-color, #007aff)"
          />
        </button>
        <button class="control-btn" @click="nextSong">
          <Icon :width="32" color="var(--text-color)" icon="mdi:skip-next" />
        </button>
        <button class="control-btn" @click="shuffleQueue">
          <Icon :width="24" color="var(--text-color)" icon="mdi:shuffle-variant" />
        </button>
      </div>
    </div>

    <div class="queue-container">
      <div class="queue-header">
        <span>{{ $t('player.queueHeader', { count: localQueue.length }) }}</span>
        <div class="queue-actions">
          <span class="drag-hint">{{ $t('player.dragHint') }}</span>
          <button v-if="localQueue.length > 0" class="clear-queue-btn" @click="clearQueue">
            {{ $t('player.clearQueue') }}
          </button>
        </div>
      </div>

      <TransitionGroup
        ref="queueListRef"
        class="queue-list"
        name="queue-list"
        tag="div"
        @scroll="handleScroll"
      >
        <div
          v-for="(song, idx) in localQueue"
          :key="song.id"
          :class="{
            'drag-over': dragOverIndex === idx,
            'dragging-source': dragStartIndex === idx,
            'past-song': getRelativeIndex(idx).startsWith('-'),
          }"
          :data-index="idx"
          class="queue-item"
          @click="playSong(song)"
        >
          <div class="drag-handle" style="touch-action: none" @pointerdown="startDrag($event, idx)">
            <Icon :width="20" color="var(--text-color)" icon="mdi:drag-vertical" />
          </div>
          <div class="queue-index">{{ getRelativeIndex(idx) }}</div>
          <div class="queue-song-info">
            <div class="queue-song-name">{{ song.title }}</div>
            <div class="queue-song-artist">{{ song.artist }}</div>
          </div>
          <DropdownButton
            :button-icon="'mdi:dots-vertical'"
            :dx="-40"
            :dy="-60"
            :offset-x="0"
            :offset-y="4"
            :options="menuOptions"
            :size="32"
            :visible="openDropdownId === song.id"
            placement="bottom-end"
            @select="(item) => onMenuItemSelect(item, song)"
            @click.stop
          />
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'PlayerView' })
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from '@/components/button/CircleButton.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { type DropdownItem, PlayMode, type Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import { audio } from '@/utils/createAudio'
import { useI18n } from 'vue-i18n'
import { DEFAULT_COVER, fetchCoverFromWeb, isInList } from '@/utils/functions'

const { t } = useI18n()
const appStore = useAppStore()

const isPlaying = computed(() => appStore.getPlayData().isPlaying)
const mockCurrentTime = computed(() => appStore.getPlayData().mockCurrentTime)
const mockDuration = computed(() =>
  appStore.currentSong?.duration ? appStore.currentSong.duration / 1000 : 0
)
const progressPercent = computed(() =>
  mockDuration.value > 0 ? (mockCurrentTime.value / mockDuration.value) * 100 : 0
)

const playMode = computed(() => appStore.getPlayMode())
const playModeIcon = computed(() =>
  playMode.value === 'repeatOne' ? 'mdi:repeat-once' : 'mdi:repeat'
)
const playModeText = computed(() =>
  playMode.value === 'sequential' ? t('player.playMode.sequential') : t('player.playMode.repeatOne')
)

const localQueue = ref<Song[]>(appStore.getPlayQueue())
watch(
  () => appStore.getPlayQueue(),
  (newQueue) => {
    localQueue.value = [...newQueue]
  },
  { deep: true }
)

const currentSong = computed(() => currentSongOverride.value || appStore.currentSong)

let timeUpdateHandler: (() => void) | null = null

onMounted(() => {
  timeUpdateHandler = () => {
    if (!isDraggingProgress) {
      appStore.setMockCurrentTime(audio.currentTime)
    }
  }
  audio.addEventListener('timeupdate', timeUpdateHandler)
})

onUnmounted(() => {
  if (timeUpdateHandler) {
    audio.removeEventListener('timeupdate', timeUpdateHandler)
  }
})
const RATES = [0.5, 0.65, 0.8, 1.0, 1.25, 1.5, 2.0]

const currentRate = computed(() => appStore.playbackRate)

const cyclePlaybackRate = async () => {
  const cur = currentRate.value
  let idx = RATES.indexOf(cur)
  if (idx === -1 || idx === RATES.length - 1) {
    idx = 0
  } else {
    idx++
  }
  await appStore.setPlaybackRate(RATES[idx])
}
const togglePlay = () => {
  appStore.togglePlay()
}

const togglePlayMode = () => {
  const next: PlayMode = playMode.value === 'sequential' ? 'repeatOne' : 'sequential'
  appStore.setPlayMode(next)
}

const prevSong = () => appStore.prevSong()
const nextSong = () => appStore.nextSong()

const playSong = async (song: Song) => {
  const targetIdx = localQueue.value.findIndex((s) => s.id === song.id)
  if (targetIdx === -1) return

  if (targetIdx === appStore.getPlayData().currentIndex) {
    appStore.togglePlay()
    return
  }

  try {
    await audio.playIndex(targetIdx)
    appStore.setIsPlaying(true)
    appStore.setMockCurrentTime(0)
  } catch (e) {
    console.error('播放失败', e)
    toast.error(t('player.toast.playFailed'))
  }
  appStore.togglePlay()
  setTimeout(async () => {
    appStore.togglePlay() //刷新
  }, 50)
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
  const newTime = Math.min(percent * mockDuration.value, mockDuration.value)
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
  const targetTime = Math.min(
    Math.max(appStore.getPlayData().mockCurrentTime, 0),
    mockDuration.value
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
  const targetTime = Math.min(
    Math.max(appStore.getPlayData().mockCurrentTime, 0),
    mockDuration.value
  )
  await audio.seek(targetTime)
}

const clearQueue = async () => {
  const result = await showConfirm({
    title: t('player.clearQueueConfirm.title'),
    message: t('player.clearQueueConfirm.message'),
    confirmText: t('player.clearQueueConfirm.confirm'),
    cancelText: t('player.clearQueueConfirm.cancel'),
  })
  if (result) {
    appStore.setPlayQueue([])
    audio.pause()
    appStore.setIsPlaying(false)
    appStore.setCurrentIndex(0)
    appStore.setMockCurrentTime(0)
    openDropdownId.value = null
    toast.success(t('player.toast.queueCleared'))
  }
}

const shuffleQueue = () => {
  const cur = appStore.getPlayData().currentIndex
  if (localQueue.value.length <= 1 || cur + 1 >= localQueue.value.length) return
  const head = localQueue.value.slice(0, cur + 1)
  const tail = localQueue.value.slice(cur + 1)
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tail[i], tail[j]] = [tail[j], tail[i]]
  }
  const newQueue = [...head, ...tail]
  localQueue.value = newQueue
  appStore.setPlayQueue(newQueue)
}

const openDropdownId = ref<string | number | null>(null)
const menuOptions = computed<DropdownItem[]>(() => [
  { icon: 'mdi:play', description: t('player.menu.play'), value: 'play' },
  { icon: 'mdi:heart-outline', description: t('player.menu.like'), value: 'like' },
  { icon: 'mdi:delete', description: t('player.menu.remove'), value: 'remove' },
  { icon: 'proicons:cancel', description: t('player.menu.cancel'), value: 'cancel' },
])

const onMenuItemSelect = (item: DropdownItem, song: Song) => {
  if (item.value === 'play') {
    playSong(song)
  } else if (item.value === 'like') {
    if (isInList(song.id, appStore.getLikeList().data)) {
      toast.warning(t('song.toast.alreadyLiked'))
      return
    }
    appStore.mergeLikeListData([song])
    toast.success(t('player.toast.liked', { songTitle: song.title }))
  } else if (item.value === 'remove') {
    const idx = localQueue.value.findIndex((s) => s.id === song.id)
    if (idx !== -1) {
      const newQueue = [...localQueue.value]
      newQueue.splice(idx, 1)
      appStore.setPlayQueue(newQueue)

      const curIdx = appStore.getPlayData().currentIndex
      if (idx === curIdx) {
        if (newQueue.length === 0) {
          audio.pause()
          appStore.setIsPlaying(false)
          appStore.setMockCurrentTime(0)
          appStore.setCurrentIndex(0)
        } else {
          const newIndex = Math.min(idx, newQueue.length - 1)
          appStore.setCurrentIndex(newIndex)
          audio.playIndex(newIndex)
          appStore.setIsPlaying(true)
          appStore.setMockCurrentTime(0)
        }
      } else if (idx < curIdx) {
        appStore.setCurrentIndex(curIdx - 1)
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
let wasPlaying = false
let currentPlayingSongId: string | null = null
const currentSongOverride = ref<Song | null>(null)
const dragCurrentIndex = ref<number | null>(null)

const startDrag = (e: PointerEvent, idx: number) => {
  if (e.button !== 0 && e.pointerType !== 'touch') return
  e.preventDefault()

  wasPlaying = isPlaying.value
  currentPlayingSongId = appStore.currentSong?.id ?? null
  currentSongOverride.value = appStore.currentSong
  dragCurrentIndex.value = appStore.getPlayData().currentIndex

  appStore.setIsSwitchingSong(true)
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

        if (currentPlayingSongId && movedItem.id === currentPlayingSongId) {
          dragCurrentIndex.value = overIndex
        } else if (dragCurrentIndex.value !== null) {
          const currentPos = newQueue.findIndex((s) => s.id === currentPlayingSongId)
          if (currentPos !== -1) {
            dragCurrentIndex.value = currentPos
          }
        }

        dragStartIndex.value = overIndex
        dragItem = document.querySelector(`.queue-item[data-index="${overIndex}"]`) as HTMLElement
        if (dragItem) dragItem.classList.add('dragging-source')
      }
    }
  }
}

const stopDrag = async (e: PointerEvent) => {
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

  const newIdx = currentPlayingSongId
    ? localQueue.value.findIndex((s) => s.id === currentPlayingSongId)
    : -1

  if (newIdx !== -1) {
    appStore.setCurrentIndex(newIdx)
  }

  if (wasPlaying && !appStore.getPlayData().isPlaying) {
    togglePlay()
  } else if (!wasPlaying && appStore.getPlayData().isPlaying) {
    togglePlay()
  }

  dragCurrentIndex.value = null
  currentSongOverride.value = null
  currentPlayingSongId = null
  setTimeout(() => appStore.setIsSwitchingSong(false), 1000)

  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', stopDrag)
}

const getRelativeIndex = (idx: number) => {
  const current =
    isDraggingQueue && dragCurrentIndex.value !== null
      ? dragCurrentIndex.value
      : appStore.getPlayData().currentIndex
  const diff = idx - current
  return diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`
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
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const coverSrc = ref('')
let coverAbort: AbortController | null = null

const resolveCover = async (song: Song | null) => {
  if (coverAbort) coverAbort.abort()
  coverAbort = new AbortController()
  const signal = coverAbort.signal

  if (!song) {
    coverSrc.value = DEFAULT_COVER
    return
  }
  if (song.albumArtUri && song.albumArtUri.trim() !== '') {
    coverSrc.value = song.albumArtUri
    return
  }
  // 检查设置是否允许联网获取
  if (appStore.getCanFetchCoverFromWeb?.() === false) {
    coverSrc.value = DEFAULT_COVER
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

<style lang="scss" scoped>
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
    background: var(--progress-bar);
    border-radius: 2px;
  }
  .progress-fill {
    position: absolute;
    height: 100%;
    background: var(--primary-color);
    border-radius: 2px;
  }
  .progress-handle {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: var(--primary-color);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .progress-bar:hover .progress-handle {
    opacity: 1;
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
  color: var(--danger-color);
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

  .queue-list-move,
  .queue-list-enter-active,
  .queue-list-leave-active {
    transition: transform 0.3s ease;
  }
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
  transition:
    transform 0.2s ease,
    background 0.2s,
    opacity 0.2s;
  will-change: transform;

  &:hover {
    background: var(--bg-card-hover);
  }

  &.dragging-source {
    transform: scale(1.02);
    opacity: 0.6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: grabbing;
  }

  &.drag-over {
    border-top: 2px solid var(--primary-color);
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

.past-song {
  background: var(--bg-card-dimmed, rgba(0, 0, 0, 0.02));
  opacity: 0.7;
  .queue-index,
  .queue-song-name {
    color: var(--text-disabled, #aaa);
  }
}
.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.control-btn {
  background: none;
  border: none;
  cursor: pointer;
  transition: transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    transform: scale(0.95);
  }
}
.rate-button-top-right {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 200;
}

.rate-fab {
  min-width: 48px;
  height: 40px;
  border-radius: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0 12px;

  &:hover {
    background: var(--bg-card-hover);
  }

  .rate-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--primary-color);
    font-feature-settings: 'tnum';
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
</style>
