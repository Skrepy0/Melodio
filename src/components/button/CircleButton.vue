<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import type { CircleButtonProps } from '@/utils/interface.ts'

const props = withDefaults(defineProps<CircleButtonProps>(), {
  size: 48,
  bgColor: 'var(--bg-color, #e0e0e0)',
  iconColor: 'var(--primary-color)',
  disabled: false,
  label: '',
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
// Expand the tap target to 48px only for buttons that already read as standalone
// controls. Compact row buttons (e.g. 32px) must not steal taps from their row.
const expandHitArea = typeof props.size !== 'number' || props.size >= 40
</script>

<template>
  <button
    :aria-label="label || undefined"
    :class="['circle-button', { 'expand-hit-area': expandHitArea }]"
    :disabled="disabled"
    :style="{
      width: buttonSize,
      height: buttonSize,
      backgroundColor: bgColor,
      color: iconColor,
    }"
    class="circle-button"
    type="button"
    @click="handleClick"
  >
    <Icon :icon="icon" :width="iconSize" :color="iconColor" />
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
  // Keep the visual size configurable while guaranteeing a 48px hit area.
  position: relative;

  &.expand-hit-area::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(100%, 48px);
    height: max(100%, 48px);
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }

  &:hover:not(:disabled) {
    transform: scale(1.05);
    opacity: 0.9;
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
