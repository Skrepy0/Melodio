<template>
  <div class="playlists-list">
    <div class="list-container">
      <PlaylistItemSelectable
        v-for="playlist in playlists"
        :key="playlist.id"
        :playlist="playlist"
        :selectable="isSelectMode"
        :selected="selectedIds.has(playlist.id)"
        :dropdown-open="openDropdownId === playlist.id"
        @long-press="enterSelectMode"
        @toggle-select="toggleSelect"
        @click="onPlaylistClick"
        @menu-select="onMenuSelect"
        @update:dropdown-open="(open) => handleDropdownToggle(playlist.id, open)"
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
import PlaylistItemSelectable from '@/components/lists/PlaylistItemSelectable.vue'
import { useDropdownManager } from '@/composables/useDropdownManager'
import type { Playlist } from '@/utils/interface'

interface Props {
  playlists: Playlist[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'batch-delete', playlistIds: number[]): void
  (e: 'playlist-click', playlist: Playlist): void
  (e: 'menu-select', action: string, playlist: Playlist): void
}>()

const isSelectMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())
const { openDropdownId, handleDropdownToggle } = useDropdownManager()

const enterSelectMode = (id?: number) => {
  if (isSelectMode.value) return
  isSelectMode.value = true
  if (id !== undefined) {
    selectedIds.value.add(id)
  }
}

const toggleSelect = (id: number) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
    if (selectedIds.value.size === 0) exitSelectMode()
  } else {
    selectedIds.value.add(id)
  }
}

const selectAll = () => {
  props.playlists.forEach((p) => selectedIds.value.add(p.id))
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

const onPlaylistClick = (playlist: Playlist) => {
  if (!isSelectMode.value) {
    emit('playlist-click', playlist)
  }
}

const onMenuSelect = (action: string, playlist: Playlist) => {
  emit('menu-select', action, playlist)
}
</script>

<style scoped lang="scss">
.playlists-list {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 80px;
}

.list-container {
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
  background: var(--bottom-actions-bg);
  border-top: 1px solid var(--bottom-actions-border);
  box-shadow: var(--shadow-bottom);
  z-index: 200;
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bottom-actions-bg-rgb), 0.9);
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
  color: var(--text-color);
  cursor: pointer;
  transition: opacity 0.2s;
  padding: 8px;

  &:hover {
    opacity: 0.7;
  }

  &.danger {
    color: var(--danger-color);
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
