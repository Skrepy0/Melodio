<template>
  <div class="playlist">
    <div class="song-list">
      <SongItemSelectable
        v-for="song in songs"
        :key="song.id"
        :song="song"
        :selectable="isSelectMode"
        :selected="selectedIds.has(song.id)"
        :dropdown-open="openDropdownId === song.id"
        @long-press="enterSelectMode"
        @toggle-select="toggleSelect(song.id)"
        @click="handleSongClick"
        @update:dropdown-open="(open) => handleDropdownToggle(song.id, open)"
      />
    </div>

    <Transition name="slide-up">
      <div v-if="isSelectMode" class="bottom-actions">
        <div class="actions-container">
          <button class="action-btn" @click="selectAll">
            <Icon icon="mdi:select-all" :width="20" />
            <span>全选</span>
          </button>
          <button class="action-btn" @click="clearSelection">
            <Icon icon="mdi:select-off" :width="20" />
            <span>清空</span>
          </button>
          <button class="action-btn danger" @click="batchDelete">
            <Icon icon="mdi:delete" :width="20" />
            <span>删除({{ selectedIds.size }})</span>
          </button>
          <button class="action-btn" @click="exitSelectMode">
            <Icon icon="mdi:close" :width="20" />
            <span>取消</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItemSelectable from '@/components/song/SongItemSelectable.vue'
import { useDropdownManager } from '@/composables/useDropdownManager'
import type { Song } from '@/utils/interface.ts'

interface Props {
  songs: Song[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'batch-delete', songIds: (string | number)[]): void
  (e: 'song-click', song: Song): void
}>()

const isSelectMode = ref(false)
const selectedIds = ref<Set<string | number>>(new Set())
const { openDropdownId, handleDropdownToggle } = useDropdownManager()

const enterSelectMode = (songId?: string | number) => {
  if (isSelectMode.value) return
  isSelectMode.value = true
  if (songId !== undefined) {
    selectedIds.value.add(songId)
  }
}

const toggleSelect = (id: string | number) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
    if (selectedIds.value.size === 0) {
      exitSelectMode()
    }
  } else {
    selectedIds.value.add(id)
  }
}

const selectAll = () => {
  props.songs.forEach((song) => {
    selectedIds.value.add(song.id)
  })
}

const clearSelection = () => {
  selectedIds.value.clear()
  exitSelectMode()
}

const batchDelete = () => {
  if (selectedIds.value.size === 0) return
  emit('batch-delete', Array.from(selectedIds.value))
  exitSelectMode()
}

const exitSelectMode = () => {
  isSelectMode.value = false
  selectedIds.value.clear()
  openDropdownId.value = null
}

const handleSongClick = (song: Song) => {
  if (!isSelectMode.value) {
    emit('song-click', song)
  }
}
</script>

<style scoped lang="scss">
.playlist {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 80px;
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-color, #ffffff);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 200;
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bg-color-rgb, 255, 255, 255), 0.9);
}

.actions-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-color, #333);
  cursor: pointer;
  transition: opacity 0.2s;
  padding: 8px;

  &:hover {
    opacity: 0.7;
  }

  &.danger {
    color: #ff4444;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
