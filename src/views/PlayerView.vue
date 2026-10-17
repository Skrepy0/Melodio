<script lang="ts" setup>
defineOptions({ name: 'PlayerView' })
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { useCoverColor } from '@/composables/useCoverColor'
import { type DropdownItem, PlayMode, type Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import { audio } from '@/utils/createAudio'
import { useI18n } from 'vue-i18n'
import {
  DEFAULT_COVER,
  fetchCoverFromWeb,
  getCoverSrc,
  isInList,
  isSafeCoverSource,
} from '@/utils/functions'
import router from '@/router'

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
    // An emptied queue cannot scroll, so the header must come back on its own.
    if (newQueue.length === 0) {
      lastScrollTop = 0
      setProgress(0)
    }
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
  // Wait a frame so the header has its real height before it is measured.
  requestAnimationFrame(() => {
    measureCollapse()
    lastScrollTop = getQueueList()?.scrollTop ?? 0
  })
  window.addEventListener('resize', measureCollapse)
})

onUnmounted(() => {
  if (timeUpdateHandler) {
    audio.removeEventListener('timeupdate', timeUpdateHandler)
  }
  window.removeEventListener('resize', measureCollapse)
  stopAutoScroll()
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

  if (appStore.getIsSwitchingSong()) return

  appStore.setIsSwitchingSong(true)
  try {
    await audio.playIndex(targetIdx)
    // songChanged event from native updates currentIndex and isPlaying
    appStore.setMockCurrentTime(0)
  } catch (e) {
    console.error('播放失败', e)
    toast.error(t('player.toast.playFailed'))
  } finally {
    appStore.setIsSwitchingSong(false)
  }
}

const progressBarRef = ref<HTMLElement | null>(null)
let isDraggingProgress = false

const updateProgressByClientX = (clientX: number) => {
  if (!progressBarRef.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  let clickX = clientX - rect.left
  clickX = Math.max(0, Math.min(clickX, rect.width))
  const percent = rect.width > 0 ? clickX / rect.width : 0
  const newTime = Math.min(percent * mockDuration.value, mockDuration.value)
  appStore.setMockCurrentTime(newTime)
}

const startDragProgress = (e: PointerEvent) => {
  e.preventDefault()
  isDraggingProgress = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  updateProgressByClientX(e.clientX)
  document.addEventListener('pointermove', onDragProgress)
  document.addEventListener('pointerup', stopDragProgress)
  document.addEventListener('pointercancel', stopDragProgress)
}

const onDragProgress = (e: PointerEvent) => {
  if (!isDraggingProgress) return
  e.preventDefault()
  updateProgressByClientX(e.clientX)
}

const removeProgressListeners = () => {
  document.removeEventListener('pointermove', onDragProgress)
  document.removeEventListener('pointerup', stopDragProgress)
  document.removeEventListener('pointercancel', stopDragProgress)
}

const stopDragProgress = async () => {
  removeProgressListeners()
  if (!isDraggingProgress) return
  isDraggingProgress = false
  const targetTime = Math.min(
    Math.max(appStore.getPlayData().mockCurrentTime, 0),
    mockDuration.value
  )
  appStore.setMockCurrentTime(targetTime)
  await audio.seek(targetTime)
}

const seekBy = async (delta: number) => {
  const targetTime = Math.min(
    Math.max(appStore.getPlayData().mockCurrentTime + delta, 0),
    mockDuration.value
  )
  appStore.setMockCurrentTime(targetTime)
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
let autoScrollSpeed = 0
let autoScrollFrame: number | null = null
let scrollContainer: HTMLElement | null = null

// How close to the list's edge the finger must be before the queue scrolls on
// its own. It has to stay well under half the list's height: the queue is often
// only ~240px tall, so a generous band would auto-scroll from anywhere inside
// it and the list would fight the reorder instead of following it.
const AUTO_SCROLL_BAND = 56
const AUTO_SCROLL_MAX_SPEED = 8

const stopAutoScroll = () => {
  if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame)
  autoScrollFrame = null
  autoScrollSpeed = 0
}

const runAutoScroll = () => {
  autoScrollFrame = null
  const container = scrollContainer
  if (!container || autoScrollSpeed === 0) return
  const before = container.scrollTop
  container.scrollTop += autoScrollSpeed
  // Stop at the ends instead of looping a frame loop that writes the same
  // scrollTop forever.
  if (container.scrollTop === before) {
    stopAutoScroll()
    return
  }
  autoScrollFrame = requestAnimationFrame(runAutoScroll)
}
const currentSongOverride = ref<Song | null>(null)
const dragCurrentIndex = ref<number | null>(null)

const startDrag = (e: PointerEvent, idx: number) => {
  if (e.button !== 0 && e.pointerType !== 'touch') return
  e.preventDefault()

  // 清理之前的自动滚动
  stopAutoScroll()

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
  document.addEventListener('pointercancel', stopDrag)

  scrollContainer = document.querySelector('.queue-list') as HTMLElement | null
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
          if (currentPos !== -1) dragCurrentIndex.value = currentPos
        }

        dragStartIndex.value = overIndex
        dragItem = document.querySelector(`.queue-item[data-index="${overIndex}"]`) as HTMLElement
        if (dragItem) dragItem.classList.add('dragging-source')
      }
    }
  }
  if (scrollContainer) {
    const rect = scrollContainer.getBoundingClientRect()
    const distToTop = e.clientY - rect.top
    const distToBottom = rect.bottom - e.clientY
    let speed = 0

    if (distToTop < AUTO_SCROLL_BAND) {
      const strength = 1 - Math.max(0, distToTop) / AUTO_SCROLL_BAND
      speed = -Math.max(1, Math.round(AUTO_SCROLL_MAX_SPEED * strength))
    } else if (distToBottom < AUTO_SCROLL_BAND) {
      const strength = 1 - Math.max(0, distToBottom) / AUTO_SCROLL_BAND
      speed = Math.max(1, Math.round(AUTO_SCROLL_MAX_SPEED * strength))
    }

    if (speed === 0) {
      stopAutoScroll()
    } else if (speed !== autoScrollSpeed || autoScrollFrame === null) {
      autoScrollSpeed = speed
      if (autoScrollFrame === null) autoScrollFrame = requestAnimationFrame(runAutoScroll)
    }
  }
}

const stopDrag = async (e: PointerEvent) => {
  if (!isDraggingQueue) return
  if (e.pointerId !== pointerId) return
  // 停止自动滚动
  stopAutoScroll()

  dragStartIndex.value = null
  dragOverIndex.value = null
  if (dragItem) {
    dragItem.classList.remove('dragging-source')
    if (dragItem.hasPointerCapture?.(pointerId)) dragItem.releasePointerCapture(pointerId)
  }
  // Every row passed over was marked as the drag source; the list is re-rendered
  // in place while dragging, so those marks outlive the one on dragItem.
  document
    .querySelectorAll('.queue-item.dragging-source')
    .forEach((el) => el.classList.remove('dragging-source'))
  dragItem = null
  isDraggingQueue = false
  pointerId = null
  scrollContainer = null
  // The collapse handler ignored scrollTop while dragging. Resync so the next
  // scroll gesture starts from a zero delta instead of jumping by the drag's
  // auto-scroll distance. The header itself is deliberately left where it was:
  // auto-scrolling to reach a row is not the user browsing the queue.
  lastScrollTop = getQueueList()?.scrollTop ?? 0

  const newIdx = currentPlayingSongId
    ? localQueue.value.findIndex((s) => s.id === currentPlayingSongId)
    : -1

  if (newIdx !== -1) appStore.setCurrentIndex(newIdx)

  if (wasPlaying && !appStore.getPlayData().isPlaying) {
    togglePlay()
  } else if (!wasPlaying && appStore.getPlayData().isPlaying) {
    togglePlay()
  }

  dragCurrentIndex.value = null
  currentSongOverride.value = null
  currentPlayingSongId = null
  appStore.setIsSwitchingSong(false)

  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)
}

const getRelativeIndex = (idx: number) => {
  const current =
    isDraggingQueue && dragCurrentIndex.value !== null
      ? dragCurrentIndex.value
      : appStore.getPlayData().currentIndex
  const diff = idx - current
  return diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`
}

const rootEl = ref<HTMLElement | null>(null)

// A template ref on TransitionGroup resolves to the component instance, not to
// the div it renders, so scrollTop has to be read from the DOM. Reading it off
// the ref silently yields undefined and the resync below would zero out the
// drag's scroll distance.
const getQueueList = () => rootEl.value?.querySelector<HTMLElement>('.queue-list') ?? null

// How far the header shrinks between its full and simplified states. Measured
// from the real layout so the compensation below matches the CSS exactly.
const collapseDistance = ref(0)
// Scroll progress, 0 at rest and 1 when the header is fully simplified. Kept
// out of the reactive graph: it is written straight to the element.
let progress = 0
let lastScrollTop = 0

const setProgress = (next: number) => {
  progress = next
  rootEl.value?.style.setProperty('--p', next.toFixed(4))
}

const measureCollapse = () => {
  const root = rootEl.value
  const header = root?.querySelector<HTMLElement>('.player-header')
  if (!root || !header) return
  root.style.setProperty('--p', '0')
  const full = header.getBoundingClientRect().height
  root.style.setProperty('--p', '1')
  const collapsed = header.getBoundingClientRect().height
  root.style.setProperty('--p', progress.toFixed(4))
  collapseDistance.value = Math.max(1, full - collapsed)
}

// The queue's box grows upward as the header yields. Without a correction the
// rows would travel twice as fast as the finger (once from the scroll, once
// from the box growing under them) and short queues would run out of scroll
// before the header finished. Taking the growth back out of scrollTop keeps
// the row under the finger still and makes progress track the gesture
// one-to-one. The corrected value is written back to lastScrollTop, so the
// scroll event it fires reads as a zero delta instead of feeding back.
const onQueueScroll = (e: Event) => {
  const list = e.currentTarget as HTMLElement
  const top = list.scrollTop
  const delta = top - lastScrollTop
  lastScrollTop = top
  // While a row is being dragged the auto-scroll owns scrollTop. Taking the
  // header's growth back out here would cancel that auto-scroll every frame and
  // resize the list under the finger, so the reorder drag must be left alone.
  // stopDrag resyncs lastScrollTop so the next gesture starts from zero delta.
  if (isDraggingQueue || delta === 0 || collapseDistance.value <= 0) return

  const next = Math.min(1, Math.max(0, progress + delta / collapseDistance.value))
  if (next === progress) return
  const step = next - progress
  setProgress(next)
  list.scrollTop = top - collapseDistance.value * step
  lastScrollTop = list.scrollTop
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const coverSrc = ref('')
let coverAbort: AbortController | null = null
let triedWebFallback = false

const fetchWebCover = async (song: Song) => {
  coverAbort?.abort()
  coverAbort = new AbortController()
  const signal = coverAbort.signal
  try {
    const url = await fetchCoverFromWeb(song.title, song.artist || '', signal)
    if (!signal.aborted) coverSrc.value = url || DEFAULT_COVER
  } catch {
    if (!signal.aborted) coverSrc.value = DEFAULT_COVER
  }
}

const resolveCover = (song: Song | null) => {
  coverAbort?.abort()
  coverAbort = null
  triedWebFallback = false
  // Drop the previous track's artwork so it cannot flash while resolving.
  coverSrc.value = DEFAULT_COVER

  if (!song) {
    return
  }
  const local = isSafeCoverSource(song.albumArtUri) ? getCoverSrc(song.albumArtUri || '') : ''
  if (local) {
    // The embedded URI may be stale (missing MediaStore album art); the error
    // handler retries online.
    coverSrc.value = local
    return
  }
  // 检查设置是否允许联网获取
  if (appStore.getCanFetchCoverFromWeb?.() === false) {
    coverSrc.value = DEFAULT_COVER
    return
  }
  triedWebFallback = true
  void fetchWebCover(song)
}

/** A broken local cover retries online once before falling back to the icon. */
const onCoverError = () => {
  const song = currentSong.value
  if (!song || triedWebFallback || appStore.getCanFetchCoverFromWeb?.() === false) {
    coverSrc.value = DEFAULT_COVER
    return
  }
  triedWebFallback = true
  coverSrc.value = DEFAULT_COVER
  void fetchWebCover(song)
}

watch(currentSong, (s) => resolveCover(s), { immediate: true })

// The player's background is drawn from the artwork, so the screen changes
// colour with the music. Null while a cover is unavailable (falls back to the
// theme accent).
const { rgb: coverRgb } = useCoverColor(coverSrc)

onUnmounted(() => {
  coverAbort?.abort()
})
</script>

<template>
  <div
    ref="rootEl"
    class="player-view"
    :style="{
      '--wash-rgb': coverRgb ? coverRgb.join(', ') : 'var(--primary-color-rgb)',
    }"
  >
    <!-- The wash is the only colour the player draws itself: a soft field
         sampled from the current cover, fading into the page ground. -->
    <div class="wash" aria-hidden="true"></div>

    <div class="top-bar">
      <button :aria-label="t('common.back')" class="bar-btn" type="button" @click="router.back()">
        <Icon :width="24" icon="mdi:chevron-down" />
      </button>
      <span class="top-context">{{ $t('player.nowPlaying') }}</span>
      <button
        :aria-label="t('player.a11y.rate')"
        :class="{ active: currentRate !== 1 }"
        :title="t('player.speed')"
        class="rate-btn"
        type="button"
        @click="cyclePlaybackRate"
      >
        {{ currentRate }}×
      </button>
    </div>

    <div class="player-header">
      <div class="album-cover">
        <img
          v-if="coverSrc && coverSrc !== DEFAULT_COVER"
          :alt="currentSong?.title"
          :src="coverSrc"
          @error="onCoverError"
        />
        <Icon v-else :width="64" class="cover-placeholder" icon="mdi:music-note" />
      </div>

      <div class="song-info">
        <div class="song-name">{{ currentSong?.title || $t('player.unknownTitle') }}</div>
        <div class="song-artist">{{ currentSong?.artist || $t('player.unknownArtist') }}</div>
      </div>

      <div class="progress-section">
        <div class="time-row">
          <span class="time tabular">{{ formatTime(mockCurrentTime) }}</span>
          <span class="time tabular">{{ formatTime(mockDuration) }}</span>
        </div>
        <div
          :aria-label="t('player.a11y.seek')"
          :aria-valuemax="Math.round(mockDuration)"
          :aria-valuemin="0"
          :aria-valuenow="Math.round(mockCurrentTime)"
          class="progress-bar-container"
          role="slider"
          tabindex="0"
          @keydown.left.prevent="seekBy(-5)"
          @keydown.right.prevent="seekBy(5)"
          @pointerdown="startDragProgress"
        >
          <div ref="progressBarRef" class="progress-bar">
            <div :style="{ width: progressPercent + '%' }" class="progress-fill"></div>
          </div>
        </div>
      </div>

      <div class="controls">
        <button
          :aria-label="t('player.a11y.playMode')"
          :title="playModeText"
          :class="{ active: playMode === 'repeatOne' }"
          class="control-btn small"
          type="button"
          @click="togglePlayMode"
        >
          <Icon :icon="playModeIcon" :width="22" />
        </button>
        <button
          :aria-label="t('player.a11y.previous')"
          class="control-btn"
          type="button"
          @click="prevSong"
        >
          <Icon :width="34" icon="mdi:skip-previous" />
        </button>
        <button
          :aria-label="t('player.a11y.playPause')"
          class="play-pause"
          type="button"
          @click="togglePlay"
        >
          <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" :width="30" />
        </button>
        <button
          :aria-label="t('player.a11y.next')"
          class="control-btn"
          type="button"
          @click="nextSong"
        >
          <Icon :width="34" icon="mdi:skip-next" />
        </button>
        <button
          :aria-label="t('player.a11y.shuffle')"
          class="control-btn small"
          type="button"
          @click="shuffleQueue"
        >
          <Icon :width="22" icon="mdi:shuffle-variant" />
        </button>
      </div>
    </div>

    <div class="queue-container">
      <div class="queue-header">
        <span class="queue-title">{{
          $t('player.queueHeader', { count: localQueue.length })
        }}</span>
        <div class="queue-actions">
          <button v-if="localQueue.length > 0" class="clear-queue-btn" @click="clearQueue">
            {{ $t('player.clearQueue') }}
          </button>
        </div>
      </div>

      <TransitionGroup
        class="queue-list"
        name="queue-list"
        tag="div"
        @scroll.passive="onQueueScroll"
      >
        <div
          v-for="(song, idx) in localQueue"
          :key="song.id"
          :class="{
            'drag-over': dragOverIndex === idx,
            'dragging-source': dragStartIndex === idx,
            'past-song': getRelativeIndex(idx).startsWith('-'),
            current: getRelativeIndex(idx) === '0',
          }"
          :data-index="idx"
          class="queue-item"
          @click="playSong(song)"
        >
          <div class="drag-handle" style="touch-action: none" @pointerdown="startDrag($event, idx)">
            <Icon :width="18" icon="mdi:drag-vertical" />
          </div>
          <div class="queue-index tabular">{{ getRelativeIndex(idx) }}</div>
          <div class="queue-song-info">
            <div class="queue-song-name">{{ song.title }}</div>
            <div class="queue-song-artist">{{ song.artist }}</div>
          </div>
          <DropdownButton
            :button-icon="'mdi:dots-vertical'"
            :dx="-40"
            :dy="-60"
            :label="t('common.more')"
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

<style lang="scss" scoped>
// The player is the one screen where the interface takes its colour from the
// music: a wash sampled from the artwork sits behind everything, and the rest
// of the page is neutral so the cover and the wash are the only saturated
// things on screen.
.player-view {
  // Scroll progress of the queue, 0 at rest and 1 when the header is fully
  // simplified. Set inline from the scroll handler; every collapsing value
  // below is a function of it, so the header and the queue move together.
  --p: 0;
  --cover-size: min(72vw, 300px);

  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
  position: relative;
  isolation: isolate;
  padding-top: env(safe-area-inset-top, 0px);
}

.wash {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  // Only the tint: the ground comes from `.player-view` itself, so a wallpaper
  // is not tinted twice by two stacked translucent layers.
  background: radial-gradient(
    120% 70% at 50% 0%,
    rgba(var(--wash-rgb), var(--wash-strength)) 0%,
    rgba(var(--wash-rgb), calc(var(--wash-strength) * 0.45)) 42%,
    transparent 78%
  );
  transition: background var(--duration-slower) ease;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 var(--space-3);
  flex-shrink: 0;
}

.bar-btn {
  @include icon-button(40px);
  color: var(--text-color);

  &:hover {
    color: var(--text-color);
  }
}

.top-context {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.rate-btn {
  min-width: 48px;
  height: 36px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--chip-bg);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease;

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-color);
  }

  // A rate other than 1× is a state the listener chose, so it takes the accent.
  &.active {
    background: var(--primary-color-light);
    color: var(--primary-color);
  }
}

// Scrolling the queue gives the list room by taking it from the header: the
// cover shrinks away, the type steps down, the transport tightens. Everything
// is a function of --p, so the queue grows exactly as fast as the header
// yields and nothing under the finger ever jumps.
.player-header {
  padding: calc(var(--space-3) * (1 - var(--p))) var(--space-5)
    calc(var(--space-4) - (var(--space-4) - var(--space-2)) * var(--p));
  flex-shrink: 0;
  overflow: hidden;
}

.album-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: calc(var(--space-5) * (1 - var(--p)));
  overflow: hidden;
  height: calc(var(--cover-size) * (1 - var(--p)));

  img,
  .cover-placeholder {
    width: calc(var(--cover-size) * (1 - var(--p)));
    height: calc(var(--cover-size) * (1 - var(--p)));
    border-radius: var(--radius-lg);
    object-fit: cover;
    box-shadow: 0 16px 40px rgba(0, 0, 0, calc(0.18 * (1 - var(--p))));
    animation: coverIn var(--duration-slow) var(--ease-out-expo);
  }

  .cover-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-placeholder);
    color: var(--text-tertiary);
    box-shadow: inset 0 0 0 1px var(--hairline);
    animation: none;
  }
}

.song-info {
  text-align: center;
  margin-bottom: calc(var(--space-4) - (var(--space-4) - var(--space-2)) * var(--p));

  .song-name {
    font-size: calc(var(--font-size-xl) - (var(--font-size-xl) - var(--font-size-base)) * var(--p));
    font-weight: var(--font-weight-semibold);
    letter-spacing: -0.02em;
    line-height: var(--line-height-tight);
    color: var(--text-color);
    @include text-ellipsis;
  }

  .song-artist {
    margin-top: 2px;
    font-size: calc(
      var(--font-size-base) - (var(--font-size-base) - var(--font-size-sm)) * var(--p)
    );
    color: var(--text-secondary);
    @include text-ellipsis;
  }
}

.progress-section {
  margin-bottom: calc(var(--space-4) - (var(--space-4) - var(--space-2)) * var(--p));
  padding: 0 var(--space-1);

  .time-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-1);
  }

  .time {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
  }

  .progress-bar-container {
    cursor: pointer;
    padding: calc(var(--space-2) - var(--space-1) * var(--p)) 0;
    touch-action: none;
    border-radius: var(--radius-xs);

    &:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 4px;
    }
  }

  .progress-bar {
    position: relative;
    height: 3px;
    background: var(--progress-track);
    border-radius: var(--radius-pill);
    transition: height var(--duration-fast) ease;
  }

  .progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--primary-color);
    border-radius: var(--radius-pill);
    transition: width 0.25s linear;
  }
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: calc(var(--space-6) - var(--space-2) * var(--p));
}

.control-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  transition:
    background-color var(--duration-fast) ease,
    opacity var(--duration-fast) ease;

  &:hover {
    background: var(--header-back-hover);
  }

  &:active {
    background: var(--hairline-strong);
  }

  &.small {
    color: var(--text-secondary);
    width: 40px;
    height: 40px;

    &.active {
      color: var(--primary-color);
    }
  }
}

// The primary transport control is the one solid accent on the screen.
.play-pause {
  width: 64px;
  height: 64px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--primary-color);
  color: var(--on-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    transform var(--duration-fast) var(--ease-out-expo),
    opacity var(--duration-fast) ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.94);
  }
}

.queue-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--hairline);
  background: var(--bg-page-soft);
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4) var(--space-2);
  flex-shrink: 0;
}

.queue-title {
  @include section-label;
  padding: 0;
}

.queue-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.clear-queue-btn {
  background: none;
  border: none;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  transition: color var(--duration-fast) ease;

  &:hover {
    color: var(--danger-color);
  }
}

.queue-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 var(--space-4);
  @include custom-scrollbar(3px);
}

// TransitionGroup animations for queue reordering
.queue-list-enter-active,
.queue-list-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}
.queue-list-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}
.queue-list-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
.queue-list-move {
  transition: transform var(--duration-normal) var(--ease-out-expo);
}

.queue-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-1);
  margin: 0 var(--space-2);
  min-height: 52px;
  border-radius: var(--radius-sm);
  user-select: none;
  -webkit-user-select: none;
  transition:
    background-color var(--duration-fast) ease,
    opacity var(--duration-fast) ease;
  cursor: pointer;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 52px;
    right: 0;
    bottom: 0;
    height: 1px;
    background-color: var(--hairline);
    transform: scaleY(0.5);
    transform-origin: bottom;
  }

  &:last-child::after {
    display: none;
  }

  &:hover {
    background: var(--bg-card-dimmed);
  }

  &.current {
    // Same treatment as the song rows: a faint accent wash plus the accent
    // name, so "where am I" is legible without reading.
    background: var(--selection-bg);

    .queue-song-name {
      color: var(--primary-color);
      font-weight: var(--font-weight-semibold);
    }
  }

  &.dragging-source {
    opacity: 0.55;
    background: var(--bg-secondary);
    cursor: grabbing;
  }

  &.drag-over::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -1px;
    height: 2px;
    background: var(--primary-color);
    border-radius: 2px;
  }

  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    color: var(--text-disabled);
    padding: var(--space-2) var(--space-1);
    touch-action: none;
    flex-shrink: 0;

    &:active {
      cursor: grabbing;
      color: var(--text-secondary);
    }
  }

  .queue-index {
    width: 26px;
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .queue-song-info {
    flex: 1;
    min-width: 0;

    .queue-song-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-color);
      @include text-ellipsis;
    }

    .queue-song-artist {
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      @include text-ellipsis;
    }
  }
}

.past-song {
  opacity: 0.45;

  .queue-index,
  .queue-song-name {
    color: var(--text-tertiary);
  }
}
</style>
