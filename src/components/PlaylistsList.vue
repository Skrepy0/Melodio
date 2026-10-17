<script lang="ts" setup>
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

<template>
  <div class="playlists-list">
    <div class="list-container">
      <PlaylistItemSelectable
        v-for="playlist in playlists"
        :key="playlist.id"
        :dropdown-open="openDropdownId === playlist.id"
        :playlist="playlist"
        :selectable="isSelectMode"
        :selected="selectedIds.has(playlist.id)"
        @click="onPlaylistClick"
        @long-press="enterSelectMode"
        @toggle-select="toggleSelect"
        @menu-select="onMenuSelect"
        @update:dropdown-open="(open) => handleDropdownToggle(playlist.id, open)"
      />
    </div>

    <Transition name="slide-up">
      <div v-if="isSelectMode" class="bottom-actions">
        <div class="actions-container">
          <button class="action-btn" type="button" @click="selectAll">
            <Icon :width="20" icon="mdi:select-all" />
            <span>{{ $t('playList.selectAll') }}</span>
          </button>
          <button class="action-btn" type="button" @click="clearSelection">
            <Icon :width="20" icon="mdi:select-off" />
            <span>{{ $t('playList.clear') }}</span>
          </button>
          <button class="action-btn danger" type="button" @click="batchDelete">
            <Icon :width="20" icon="mdi:delete" />
            <span>{{ $t('playList.delete', { count: selectedIds.size }) }}</span>
          </button>
          <button class="action-btn" type="button" @click="exitSelectMode">
            <Icon :width="20" icon="mdi:close" />
            <span>{{ $t('playList.cancel') }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.playlists-list {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  @include custom-scrollbar(3px);
}

.list-container {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bottom-actions-bg);
  border-top: 1px solid var(--bottom-actions-border);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  animation: sheetIn var(--duration-normal) var(--ease-out-expo);
}

.actions-container {
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  padding: var(--space-2) var(--space-3);
  gap: var(--space-1);
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.action-btn {
  flex: 1 0 auto;
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-color);
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  white-space: nowrap;
  transition: background-color var(--duration-fast) ease;

  &:hover {
    background: var(--setting-hover-bg);
  }

  &:active {
    background: var(--hairline);
  }

  &.danger {
    color: var(--danger-color);
  }
}
</style>
