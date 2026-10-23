<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItem from '@/components/song/SongItem.vue'
import { useAppStore } from '@/stores/app'
import type { Song } from '@/utils/interface'
import toast from '@/utils/createToast'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { showConfirm } from '@/utils/createConfirm'
import { onBeforeRouteLeave } from 'vue-router'
let leaveConfirmed = false
onBeforeRouteLeave(async (to, from, next) => {
  // 按钮层已经确认过，直接放行，避免第二次弹窗。
  if (leaveConfirmed) {
    leaveConfirmed = false
    next()
    return
  }
  if (hasUnsavedChanges.value) {
    const confirm = await showConfirm({
      title: t('editor.unsavedTitle'),
      message: t('editor.unsavedMessage'),
      confirmText: t('editor.leave'),
      cancelText: t('editor.stay'),
    })
    if (confirm) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})
const { t } = useI18n()
const appStore = useAppStore()

const listId = ref<number>(-1)
const localSongs = ref<Song[]>([])
const hasUnsavedChanges = ref(false)

const sortMode = ref<'custom' | 'title' | 'artist' | 'addedTime' | 'modifiedTime'>('custom')
const sortAsc = ref<boolean>(true)

const customOrderSongs = ref<Song[]>([])
const originalSongs = ref<Song[]>([])

const listContainer = ref<HTMLElement | null>(null)

const dragSourceIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
let dragItem: HTMLElement | null = null
let isDragging = false
let pointerId: number | null = null

// ---- 自动滚动 ----
// 拖到列表上下边缘时自己滚动，方便把歌拖到很长的列表之外的位置。
let autoScrollSpeed = 0
let autoScrollFrame: number | null = null
// 拖拽过程中的最后指针位置。自动滚动的每一帧都要拿它重新算落点，
// 因为滚动本身不会派发 pointermove。
let lastPointerX = 0
let lastPointerY = 0

// 触发带要远小于列表高度，否则指针一进入列表就会触发滚动，和手动拖动打架。
const AUTO_SCROLL_BAND = 56
const AUTO_SCROLL_MAX_SPEED = 8

function stopAutoScroll() {
  if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame)
  autoScrollFrame = null
  autoScrollSpeed = 0
}

function runAutoScroll() {
  autoScrollFrame = null
  const container = listContainer.value
  if (!container || autoScrollSpeed === 0) return
  const before = container.scrollTop
  container.scrollTop += autoScrollSpeed
  if (container.scrollTop === before) {
    // 到顶/到底后别空转 rAF。
    stopAutoScroll()
    return
  }
  // 列表滚过之后，指针底下换了一行，但不会再触发 pointermove，
  // 必须在这里主动重算落点，否则只会滚、不会换位置。
  handleDragOverAt(lastPointerX, lastPointerY)
  autoScrollFrame = requestAnimationFrame(runAutoScroll)
}

function updateAutoScroll(clientY: number) {
  const container = listContainer.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const distToTop = clientY - rect.top
  const distToBottom = rect.bottom - clientY
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

onMounted(async () => {
  const id = appStore.getToBeSortedSongListIndex()
  if (id === -1) {
    toast.error(t('editor.toast.invalid_list'))
    return
  }
  listId.value = id

  if (id === 0) {
    originalSongs.value = [...appStore.getLikeList().data]
  } else {
    const lists = appStore.getSongLists()
    const target = lists.find((l) => l.id === id)
    if (target) {
      originalSongs.value = [...target.data]
    } else {
      toast.error(t('editor.toast.list_not_found'))
      return
    }
  }
  localSongs.value = [...originalSongs.value]
  customOrderSongs.value = [...originalSongs.value]
  applySort()
  hasUnsavedChanges.value = false
})

onUnmounted(() => {
  stopAutoScroll()
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
  document.removeEventListener('pointercancel', onDragEnd)
})

function applySort() {
  if (sortMode.value === 'custom') {
    localSongs.value = [...customOrderSongs.value]
    return
  }
  const list = [...originalSongs.value]
  const key = sortMode.value
  list.sort((a, b) => {
    let valA: any, valB: any
    switch (key) {
      case 'title':
        valA = a.title.toLowerCase()
        valB = b.title.toLowerCase()
        break
      case 'artist':
        valA = (a.artist || '').toLowerCase()
        valB = (b.artist || '').toLowerCase()
        break
      case 'addedTime':
        valA = a.dateAdded || 0
        valB = b.dateAdded || 0
        break
      case 'modifiedTime':
        valA = a.dateModified || 0
        valB = b.dateModified || 0
        break
      default:
        return 0
    }
    if (valA < valB) return sortAsc.value ? -1 : 1
    if (valA > valB) return sortAsc.value ? 1 : -1
    return 0
  })
  localSongs.value = list
}

function onSortModeChange() {
  if (sortMode.value === 'custom') {
    if (customOrderSongs.value.length === localSongs.value.length) {
      localSongs.value = [...customOrderSongs.value]
    } else {
      customOrderSongs.value = [...originalSongs.value]
      localSongs.value = [...customOrderSongs.value]
    }
    hasUnsavedChanges.value = true
  } else {
    applySort()
    hasUnsavedChanges.value = true
  }
  dragSourceIndex.value = null
  dragOverIndex.value = null
}

const orderIcon = computed(() => {
  if (sortMode.value === 'custom') {
    return 'mdi:swap-vertical'
  } else {
    return sortAsc.value ? 'mdi:sort-ascending' : 'mdi:sort-descending'
  }
})

const orderText = computed(() => {
  if (sortMode.value === 'custom') {
    return t('editor.reverse')
  } else {
    return sortAsc.value ? t('editor.asc') : t('editor.desc')
  }
})

function handleOrderToggle() {
  if (sortMode.value === 'custom') {
    localSongs.value = [...localSongs.value].reverse()
    customOrderSongs.value = [...localSongs.value]
    hasUnsavedChanges.value = true
  } else {
    sortAsc.value = !sortAsc.value
    applySort()
    hasUnsavedChanges.value = true
  }
}

function onDragStart(e: PointerEvent, idx: number) {
  if (sortMode.value !== 'custom') return
  if (e.button !== 0 && e.pointerType !== 'touch') return
  e.preventDefault()
  dragSourceIndex.value = idx
  const target = (e.target as HTMLElement).closest('.song-row')
  if (!target) return
  dragItem = target as HTMLElement
  dragItem.setPointerCapture(e.pointerId)
  pointerId = e.pointerId
  isDragging = true
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', onDragEnd)
  document.addEventListener('pointercancel', onDragEnd)
}

// 根据指针坐标判断落点并重排。抽成独立函数是因为自动滚动的每一帧
// 也要在同一坐标上重新算一次，而那时并没有 pointermove 事件。
function handleDragOverAt(clientX: number, clientY: number) {
  if (!isDragging || dragSourceIndex.value === null) return
  const elements = document.elementsFromPoint(clientX, clientY)
  const targetRow = elements.find((el) => el.classList?.contains('song-row')) as HTMLElement
  if (!targetRow || targetRow === dragItem) return
  const overIdx = parseInt(targetRow.dataset.index || '-1')
  if (overIdx === -1 || overIdx === dragOverIndex.value) return

  dragOverIndex.value = overIdx
  if (dragSourceIndex.value === overIdx) return
  const newList = [...localSongs.value]
  const [moved] = newList.splice(dragSourceIndex.value, 1)
  newList.splice(overIdx, 0, moved)
  localSongs.value = newList
  customOrderSongs.value = [...newList]
  dragSourceIndex.value = overIdx
  dragItem = document.querySelector(`.song-row[data-index="${overIdx}"]`) as HTMLElement
  hasUnsavedChanges.value = true
}

function onDragMove(e: PointerEvent) {
  if (!isDragging || dragSourceIndex.value === null) return
  if (e.pointerId !== pointerId) return
  e.preventDefault()
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  handleDragOverAt(e.clientX, e.clientY)
  updateAutoScroll(e.clientY)
}

function onDragEnd(e: PointerEvent) {
  if (!isDragging) return
  if (e.pointerId !== pointerId) return
  stopAutoScroll()
  if (dragItem) {
    dragItem.classList.remove('dragging-source')
    if (dragItem.hasPointerCapture?.(pointerId!)) dragItem.releasePointerCapture(pointerId!)
  }
  dragSourceIndex.value = null
  dragOverIndex.value = null
  dragItem = null
  isDragging = false
  pointerId = null
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
  document.removeEventListener('pointercancel', onDragEnd)
}

function saveOrder() {
  if (listId.value === -1) return
  if (listId.value === 0) {
    appStore.setLikeListData([...localSongs.value])
  } else {
    const lists = appStore.getSongLists()
    const target = lists.find((l) => l.id === listId.value)
    if (!target) return
    const updatedList = {
      ...target,
      data: [...localSongs.value],
      songCount: localSongs.value.length,
    }
    appStore.setSongListById(target.id, updatedList)
  }
  hasUnsavedChanges.value = false
  router.back()
  toast.success(t('editor.saved'))
}
const backWithoutSave = async () => {
  if (hasUnsavedChanges.value) {
    const confirm = await showConfirm({
      title: t('editor.unsavedTitle'),
      message: t('editor.unsavedMessage'),
      confirmText: t('editor.leave'),
      cancelText: t('editor.stay'),
    })
    if (!confirm) return
    // 这次离开已经确认过，不要再问一遍。
    leaveConfirmed = true
  }
  router.back()
}
</script>

<template>
  <div class="song-list-editor">
    <div class="editor-header">
      <div class="header-left">
        <button
          :aria-label="t('common.back')"
          class="back-btn"
          type="button"
          @click="backWithoutSave"
        >
          <Icon :width="24" icon="mdi:chevron-left" />
        </button>
        <h2>{{ $t('editor.title') }}</h2>
      </div>
      <button class="save-btn" type="button" @click="saveOrder">
        {{ $t('editor.save') }}
      </button>
    </div>

    <div class="sort-controls">
      <div class="sort-left">
        <select v-model="sortMode" class="sort-select mode-select" @change="onSortModeChange">
          <option value="custom">{{ $t('editor.sortCustom') }}</option>
          <option value="title">{{ $t('editor.sortByTitle') }}</option>
          <option value="artist">{{ $t('editor.sortByArtist') }}</option>
          <option value="addedTime">{{ $t('editor.sortByAddedTime') }}</option>
          <option value="modifiedTime">{{ $t('editor.sortByModifiedTime') }}</option>
        </select>

        <button class="sort-btn" @click="handleOrderToggle">
          <Icon :icon="orderIcon" :width="18" />
          <span>{{ orderText }}</span>
        </button>
      </div>
      <span class="song-count">{{ $t('editor.totalSongs', { count: localSongs.length }) }}</span>
    </div>

    <div ref="listContainer" class="song-list">
      <div
        v-for="(song, idx) in localSongs"
        :key="song.id"
        :class="{
          'drag-over': dragOverIndex === idx,
          'dragging-source': dragSourceIndex === idx,
        }"
        :data-index="idx"
        class="song-row"
      >
        <div
          v-if="sortMode === 'custom'"
          class="drag-handle"
          @pointerdown.prevent="onDragStart($event, idx)"
          @touchstart.prevent
        >
          <Icon :width="20" icon="mdi:drag-vertical" />
        </div>
        <div class="song-item-wrapper">
          <SongItem
            :dropdown-open="false"
            :on-delete="() => {}"
            :show-operations="false"
            :song="song"
            @click.stop
          />
        </div>
      </div>
      <div v-if="localSongs.length === 0" class="empty-hint">
        {{ $t('editor.empty') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.song-list-editor {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  background-color: var(--bg-color);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
  padding: 0 var(--space-2) 0 var(--space-2);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .back-btn {
    @include icon-button(40px);
    color: var(--text-color);
  }

  h2 {
    margin: 0;
    @include text-ellipsis;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    letter-spacing: -0.01em;
    color: var(--text-color);
  }
}

.save-btn {
  flex-shrink: 0;
  margin-right: var(--space-2);
  min-height: 36px;
  padding: 0 18px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--primary-color);
  color: var(--on-primary-color);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: opacity var(--duration-fast) ease;

  &:active {
    opacity: 0.8;
  }
}

.sort-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1) var(--space-4) var(--space-3);
  flex-wrap: nowrap;
  flex-shrink: 0;

  .sort-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: nowrap;
    min-width: 0;
  }

  .sort-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 36px;
    padding: 0 12px;
    background: var(--bg-input);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-color);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
    cursor: pointer;

    &:active {
      background: var(--bg-secondary);
    }
  }

  .sort-select {
    min-height: 36px;
    max-width: 150px;
    padding: 0 28px 0 12px;
    border: none;
    border-radius: var(--radius-sm);
    background-color: var(--bg-input);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    color: var(--text-color);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    appearance: none;
  }

  .song-count {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    white-space: nowrap;
    flex-shrink: 0;
  }
}

.song-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(var(--space-6) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  @include custom-scrollbar(3px);
}

.song-row {
  display: flex;
  align-items: center;
  position: relative;
  flex-shrink: 0;
  transition: opacity var(--duration-fast) ease;

  // A single 2px rule at the drop edge marks the insertion point; nothing
  // lifts or outlines the row itself.
  &.drag-over::before {
    content: '';
    position: absolute;
    left: var(--space-4);
    right: 0;
    top: 0;
    height: 2px;
    background-color: var(--primary-color);
    z-index: 1;
  }

  &.dragging-source {
    opacity: 0.4;
  }

  .drag-handle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    align-self: stretch;
    color: var(--text-tertiary);
    cursor: grab;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }
  }

  .song-item-wrapper {
    flex: 1;
    min-width: 0;
    pointer-events: auto;
  }
}

.empty-hint {
  @include empty-state;
}
</style>
