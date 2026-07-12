<template>
  <div
    class="song-item-wrapper"
    @click="onClick"
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
    <SongItem
      :class="{ 'select-mode-offset': selectable }"
      :dropdownOpen="dropdownOpen"
      :on-delete="handleDeleteSong"
      :showOperations="props.showOperations"
      :song="song"
      @click="onSongClick"
      @menu-select="onMenuSelect"
    />
  </div>
</template>

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
  (e: 'update:dropdownOpen', value: boolean): void // 新增
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

<style lang="scss" scoped>
.song-item-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
  animation: slideInUp 0.3s ease both;
  min-width: 0;
  width: 100%;
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
  min-width: 0;
}

.select-mode-offset :deep(.song-name),
.select-mode-offset :deep(.song-artist),
.select-mode-offset :deep(.queue-song-name),
.select-mode-offset :deep(.queue-song-artist) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
