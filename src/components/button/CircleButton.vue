<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import type { CircleButtonProps } from '@/utils/interface.ts'

const props = withDefaults(defineProps<CircleButtonProps>(), {
  size: 48,
  bgColor: 'var(--bg-color, #e0e0e0)',
  iconColor: 'var(--text-color, #333)',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}

const buttonSize = typeof props.size === 'number' ? `${props.size}px` : props.size
const iconSize = typeof props.size === 'number' ? props.size * 0.55 : '24px'
</script>

<template>
  <button
    :disabled="disabled"
    :style="{
      width: buttonSize,
      height: buttonSize,
      backgroundColor: bgColor,
      color: iconColor,
    }"
    class="circle-button"
    @click="handleClick"
  >
    <Icon :icon="icon" :width="iconSize" />
  </button>
</template>

<style lang="scss" scoped>
.circle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  padding: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
  box-shadow: var(--shadow-sm);

  &:hover:not(:disabled) {
    transform: scale(1.05);
    opacity: 0.9;
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
