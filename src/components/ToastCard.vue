<script lang="ts" setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

const visible = ref(false)
const message = ref('')
const type = ref<ToastType>('info')
let timer: ReturnType<typeof setTimeout> | null = null

const iconMap = {
  success: 'mdi:check-circle',
  error: 'mdi:close-circle',
  warning: 'mdi:alert',
  info: 'mdi:information',
}

const show = (msg: string, t: ToastType = 'info', duration = 2000) => {
  message.value = msg
  type.value = t
  visible.value = true

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, duration)
}

defineExpose({ show })
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" :class="type" aria-live="polite" class="toast" role="status">
      <Icon v-if="iconMap[type]" :icon="iconMap[type]" class="toast-icon" />
      <span class="toast-text">{{ message }}</span>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
// A toast is a quiet report, not a banner. It sits in a solid dark pill so it
// reads over any page, and only the icon carries the outcome colour.
.toast {
  position: fixed;
  bottom: calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 80px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: min(88vw, 420px);
  padding: 10px 16px;
  background: var(--toast-bg);
  color: var(--toast-text);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  text-align: center;
  word-break: break-word;
  z-index: 10001;
  box-shadow: var(--elevation-3);
}

.toast-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.success .toast-icon {
  color: #57d98a;
}
.error .toast-icon {
  color: #ff7b7b;
}
.warning .toast-icon {
  color: #ffc46b;
}
.info .toast-icon {
  color: #8bb4ff;
}

.toast-enter-active {
  transition:
    opacity var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}
.toast-leave-active {
  transition:
    opacity var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, 8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>
