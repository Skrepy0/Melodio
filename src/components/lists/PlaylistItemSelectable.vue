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

<template>
  <div
    :class="{ selected: selectable && selected }"
    class="playlist-item-wrapper"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @touchend="onTouchEnd"
    @touchmove="onTouchMove"
    @touchstart="onTouchStart"
  >
    <div v-show="selectable" class="checkbox-area">
      <Icon
        :icon="selected ? 'mdi:check-circle' : 'mdi:circle-outline'"
        :width="22"
        class="checkbox"
        @click.stop="toggleSelect"
      />
    </div>
    <PlaylistItem
      :class="{ 'select-mode-offset': selectable }"
      :dropdown-open="dropdownOpen"
      :playlist="playlist"
      :show-button="!selectable"
      @click="onItemClick"
      @menu-select="onMenuSelect"
      @update:dropdown-open="(open) => emit('update:dropdownOpen', open)"
    />
  </div>
</template>

<style lang="scss" scoped>
.playlist-item-wrapper {
  display: flex;
  align-items: center;
  transition: background-color var(--duration-fast) ease;

  &.selected {
    background-color: var(--selection-bg);
  }
}

.checkbox-area {
  flex-shrink: 0;
  cursor: pointer;
  padding: var(--space-3) 0 var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
}

.checkbox {
  color: var(--primary-color);
}

.select-mode-offset {
  flex: 1;
  min-width: 0;

  &.playlist-item {
    padding-left: 0;

    &::after {
      left: 0;
    }
  }
}
</style>
