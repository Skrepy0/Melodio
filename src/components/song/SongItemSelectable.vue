<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItem from './SongItem.vue'
import type { Song, SongItemSelectableProps } from '@/utils/interface.ts'

const props = withDefaults(defineProps<SongItemSelectableProps>(), {
  showOperations: true,
})

const emit = defineEmits<{
  (e: 'long-press', songId: string): void
  (e: 'toggle-select', songId: string): void
  (e: 'click', song: Song): void
  (e: 'menuSelect', action: string, song: Song): void
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
    emit('long-press', props.song.id)
  }, 500)
}

const onTouchEnd = () => {
  clearTimer()
  setTimeout(() => {
    isLongPressed.value = false
  }, 100)
}

const onTouchMove = () => {
  clearTimer()
}

const onMouseDown = () => {
  clearTimer()
  longPressTimer = setTimeout(() => {
    isLongPressed.value = true
    emit('long-press', props.song.id)
  }, 500)
}

const onMouseUp = () => {
  clearTimer()
  setTimeout(() => {
    isLongPressed.value = false
  }, 100)
}

const onClick = (e: MouseEvent) => {
  if (isLongPressed.value) {
    e.stopPropagation()
    return
  }
}
const handleDeleteSong = (song: Song) => {
  props.onDelete(song)
}
const onSongClick = (song: Song) => {
  if (isLongPressed.value) return
  if (props.selectable) {
    toggleSelect()
  } else {
    emit('click', song)
  }
}

const toggleSelect = () => {
  emit('toggle-select', props.song.id)
}
</script>

<template>
  <div
    :class="{ selected: selectable && selected }"
    class="song-item-wrapper"
    @click="onClick"
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
    <SongItem
      :class="{ 'select-mode-offset': selectable }"
      :dropdownOpen="dropdownOpen"
      :on-delete="handleDeleteSong"
      :onMenuItemSelect="props.onMenuItemSelect"
      :operations="props.operations"
      :showOperations="props.showOperations && !selectable"
      :song="song"
      @click="onSongClick"
      @menu-select="onMenuSelect"
      @update:dropdownOpen="(val) => (dropdownOpen = val)"
    />
  </div>
</template>

<style lang="scss" scoped>
.song-item-wrapper {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
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
  transition: color var(--duration-fast) ease;
}

.select-mode-offset {
  flex: 1;
  min-width: 0;

  // In select mode the checkbox owns the leading edge, so the row loses its
  // own left padding and its divider starts at the row edge.
  &.song-item {
    padding-left: 0;

    &::after {
      left: 0;
    }
  }
}

.select-mode-offset :deep(.song-name),
.select-mode-offset :deep(.song-artist),
.select-mode-offset :deep(.queue-song-name),
.select-mode-offset :deep(.queue-song-artist) {
  @include text-ellipsis;
}
</style>
