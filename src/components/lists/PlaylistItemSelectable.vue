<template>
  <div
    class="playlist-item-wrapper"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @touchend="onTouchEnd"
    @touchmove="onTouchMove"
    @touchstart="onTouchStart"
  >
    <div v-if="selectable" class="checkbox-area">
      <Icon
        :icon="selected ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'"
        :width="22"
        class="checkbox"
        @click.stop="toggleSelect"
      />
    </div>
    <PlaylistItem
      :class="{ 'select-mode-offset': selectable }"
      :dropdown-open="dropdownOpen"
      :playlist="playlist"
      @click="onItemClick"
      @menu-select="onMenuSelect"
      @update:dropdown-open="(open) => emit('update:dropdownOpen', open)"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import PlaylistItem from './PlaylistItem.vue'
import type { Playlist } from '@/utils/interface'

interface Props {
  playlist: Playlist
  selectable: boolean
  selected: boolean
  dropdownOpen?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'long-press', playlistId: number): void
  (e: 'toggle-select', playlistId: number): void
  (e: 'click', playlist: Playlist): void
  (e: 'menuSelect', action: string, playlist: Playlist): void
  (e: 'update:dropdownOpen', value: boolean): void
}>()

const dropdownOpen = computed({
  get: () => props.dropdownOpen ?? false,
  set: (val) => emit('update:dropdownOpen', val),
})

let longPressTimer: ReturnType<typeof setTimeout> | null = null
const isLongPressed = ref(false)

const clearTimer = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const onTouchStart = () => {
  clearTimer()
  longPressTimer = setTimeout(() => {
    isLongPressed.value = true
    emit('long-press', props.playlist.id)
  }, 500)
}

const onTouchEnd = () => {
  clearTimer()
  setTimeout(() => {
    isLongPressed.value = false
  }, 100)
}

const onTouchMove = () => clearTimer()
const onMouseDown = () => {
  clearTimer()
  longPressTimer = setTimeout(() => {
    isLongPressed.value = true
    emit('long-press', props.playlist.id)
  }, 500)
}
const onMouseUp = () => {
  clearTimer()
  setTimeout(() => {
    isLongPressed.value = false
  }, 100)
}

const onItemClick = (playlist: Playlist) => {
  if (isLongPressed.value) return
  if (props.selectable) {
    toggleSelect()
  } else {
    emit('click', playlist)
  }
}

const onMenuSelect = (action: string, playlist: Playlist) => {
  emit('menuSelect', action, playlist)
}

const toggleSelect = () => {
  emit('toggle-select', props.playlist.id)
}
</script>

<style lang="scss" scoped>
.playlist-item-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
  animation: slideInUp 0.3s ease both;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.checkbox-area {
  flex-shrink: 0;
  cursor: pointer;
  padding: 8px;
}

.checkbox {
  color: var(--primary-color);
}

.select-mode-offset {
  flex: 1;
}
</style>
