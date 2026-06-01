<template>
  <div
    class="song-item-wrapper"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @touchmove="onTouchMove"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @click="onClick"
  >
    <div class="checkbox-area" v-if="selectable">
      <Icon
        :icon="selected ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'"
        :width="22"
        class="checkbox"
        @click.stop="toggleSelect"
      />
    </div>
    <SongItem
      :song="song"
      :class="{ 'select-mode-offset': selectable }"
      v-model:dropdownOpen="dropdownOpen"
      @click="onSongClick"
      @menu-select="onMenuSelect"
      :on-delete="handleDeleteSong"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItem from './SongItem.vue'
import type { Song, SongItemSelectableProps } from '@/utils/interface.ts'

const props = defineProps<SongItemSelectableProps>()

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

<style scoped lang="scss">
.song-item-wrapper {
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
