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
    <SongItem :song="song" :class="{ 'select-mode-offset': selectable }" @click="onSongClick" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItem from './SongItem.vue'
import type { Song, SongItemSelectableProps } from '@/utils/interface.ts'

const props = defineProps<SongItemSelectableProps>()

const emit = defineEmits<{
  (e: 'long-press', songId: string | number): void
  (e: 'toggle-select', songId: string | number): void
  (e: 'click', song: Song): void
}>()

// 长按定时器
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const isLongPressed = ref(false)

const clearTimer = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const onTouchStart = (e: TouchEvent) => {
  clearTimer()
  longPressTimer = setTimeout(() => {
    isLongPressed.value = true
    emit('long-press', props.song.id)
  }, 500) // 长按阈值 500ms
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

const onMouseDown = (e: MouseEvent) => {
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
  // 普通点击，交由内部处理
}

const onSongClick = (song: Song) => {
  if (isLongPressed.value) return
  emit('click', song)
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
}

.checkbox-area {
  flex-shrink: 0;
  cursor: pointer;
  padding: 8px;
}

.checkbox {
  color: var(--primary-color, #007aff);
}

.select-mode-offset {
  flex: 1;
}
</style>
