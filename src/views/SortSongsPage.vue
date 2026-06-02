<template>
  <div class="song-list-editor">
    <div class="editor-header">
      <div class="header-left">
        <button class="back-btn" @click="backWithoutSave">
          <Icon icon="mdi:arrow-left" :width="24" color="var(--text-color)" />
        </button>
        <h2>{{ $t('editor.title') }}</h2>
      </div>
      <CircleButton icon="ic:twotone-save" @click="saveOrder" :icon-color="'#1bd96a'" />
    </div>

    <div class="sort-controls">
      <div class="sort-left">
        <button class="sort-btn" @click="reverseOrder">
          <Icon icon="mdi:swap-vertical" :width="20" />
          <span>{{ $t('editor.reverse') }}</span>
        </button>
        <select v-model="sortKey" class="sort-select" @change="applySort">
          <option value="title">{{ $t('editor.sortByTitle') }}</option>
          <option value="artist">{{ $t('editor.sortByArtist') }}</option>
          <option value="addedTime">{{ $t('editor.sortByAddedTime') }}</option>
          <option value="modifiedTime">{{ $t('editor.sortByModifiedTime') }}</option>
        </select>
        <button class="sort-btn" @click="toggleSortDirection">
          <Icon :icon="sortAsc ? 'mdi:sort-ascending' : 'mdi:sort-descending'" :width="20" />
          <span>{{ sortAsc ? $t('editor.asc') : $t('editor.desc') }}</span>
        </button>
      </div>
      <span class="song-count">{{ $t('editor.totalSongs', { count: localSongs.length }) }}</span>
    </div>

    <div class="song-list" ref="listContainer">
      <div
        v-for="(song, idx) in localSongs"
        :key="song.id"
        :data-index="idx"
        class="song-row"
        :class="{
          'drag-over': dragOverIndex === idx,
          'dragging-source': dragSourceIndex === idx,
        }"
      >
        <div
          class="drag-handle"
          @pointerdown.prevent="onDragStart($event, idx)"
          @touchstart.prevent
        >
          <Icon icon="mdi:drag-vertical" :width="24" color="var(--text-secondary)" />
        </div>
        <div class="song-item-wrapper">
          <SongItem
            :song="song"
            :dropdown-open="false"
            :on-delete="() => {}"
            @click.stop
            :show-operations="false"
          />
        </div>
      </div>
      <div v-if="localSongs.length === 0" class="empty-hint">
        {{ $t('editor.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { App } from '@capacitor/app'
import SongItem from '@/components/song/SongItem.vue'
import { useAppStore } from '@/stores/app'
import type { Song } from '@/utils/interface'
import toast from '@/utils/createToast'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { showConfirm } from '@/utils/createConfirm'
import CircleButton from '@/components/button/CircleButton.vue'

const { t } = useI18n()
const appStore = useAppStore()

const listId = ref<number>(-1)
const localSongs = ref<Song[]>([])
const hasUnsavedChanges = ref(false)

const sortKey = ref<string>('title')
const sortAsc = ref<boolean>(true)

const originalSongs = ref<Song[]>([])

const dragSourceIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
let dragItem: HTMLElement | null = null
let isDragging = false
let pointerId: number | null = null

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
  applySort()
  hasUnsavedChanges.value = false

  App.addListener('backButton', () => {
    handleBackPress()
  })
})

function applySort() {
  const list = [...originalSongs.value]
  list.sort((a, b) => {
    let valA: any, valB: any
    switch (sortKey.value) {
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
  hasUnsavedChanges.value = true
}

function toggleSortDirection() {
  sortAsc.value = !sortAsc.value
  applySort()
}

function reverseOrder() {
  localSongs.value = [...localSongs.value].reverse()
  originalSongs.value = [...localSongs.value]
  hasUnsavedChanges.value = true
}

function onDragStart(e: PointerEvent, idx: number) {
  if (e.button !== 0 && e.pointerType !== 'touch') return
  e.preventDefault()
  dragSourceIndex.value = idx
  const target = (e.target as HTMLElement).closest('.song-row')
  if (!target) return
  dragItem = target as HTMLElement
  dragItem.setPointerCapture(e.pointerId)
  pointerId = e.pointerId
  isDragging = true
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (!isDragging || dragSourceIndex.value === null) return
  if (e.pointerId !== pointerId) return
  e.preventDefault()
  const elements = document.elementsFromPoint(e.clientX, e.clientY)
  const targetRow = elements.find((el) => el.classList?.contains('song-row')) as HTMLElement
  if (targetRow && targetRow !== dragItem) {
    const overIdx = parseInt(targetRow.dataset.index || '-1')
    if (overIdx !== -1 && overIdx !== dragOverIndex.value) {
      dragOverIndex.value = overIdx
      if (dragSourceIndex.value !== overIdx) {
        const newList = [...localSongs.value]
        const [moved] = newList.splice(dragSourceIndex.value, 1)
        newList.splice(overIdx, 0, moved)
        localSongs.value = newList
        originalSongs.value = [...newList]
        dragSourceIndex.value = overIdx
        dragItem = document.querySelector(`.song-row[data-index="${overIdx}"]`) as HTMLElement
        hasUnsavedChanges.value = true
      }
    }
  }
}

function onDragEnd(e: PointerEvent) {
  if (!isDragging) return
  if (e.pointerId !== pointerId) return
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

async function handleBackPress() {
  if (hasUnsavedChanges.value) {
    const confirm = await showConfirm({
      title: t('editor.unsavedTitle'),
      message: t('editor.unsavedMessage'),
      confirmText: t('editor.leave'),
      cancelText: t('editor.stay'),
    })
    if (confirm) {
      router.back()
    }
  } else {
    router.back()
  }
}

const backWithoutSave = () => {
  handleBackPress()
}

onUnmounted(() => {
  App.removeAllListeners()
})
</script>

<style scoped lang="scss">
.song-list-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  height: 100dvh;
  padding: 16px 16px 0;
  background-color: var(--bg-color);
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--bg-card-hover);
    }
    min-width: 36px;
    min-height: 36px;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
  }
}

.sort-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;

  .sort-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sort-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2));
    border-radius: 10px;
    color: var(--text-color);
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
    transition: background-color 0.2s;
    min-height: 36px;

    &:hover {
      background: var(--bg-card-hover);
    }
  }

  .sort-select {
    padding: 8px 10px;
    background: var(--bg-card);
    border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2));
    border-radius: 10px;
    color: var(--text-color);
    font-size: 13px;
    cursor: pointer;
    min-height: 36px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }

  .song-count {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
  }
}

.song-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color, #ccc);
    border-radius: 4px;
  }
}

.song-row {
  display: flex;
  align-items: center;
  border-radius: 12px;
  background-color: var(--bg-card);
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    opacity 0.2s;
  overflow: hidden;
  margin: 0;

  &.dragging-source {
    opacity: 0.4;
  }

  &.drag-over {
    box-shadow: 0 0 0 2px var(--primary-color);
  }

  .drag-handle {
    flex-shrink: 0;
    padding: 14px 8px;
    cursor: grab;
    touch-action: none;
    display: flex;
    align-items: center;
    min-width: 40px;
    justify-content: center;

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
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  font-size: 15px;
}
</style>
