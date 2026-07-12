<template>
  <Transition name="fade">
    <div v-if="visible" :class="type" class="toast">
      <Icon v-if="iconMap[type]" :icon="iconMap[type]" class="toast-icon" />
      <span class="toast-text">{{ message }}</span>
    </div>
  </Transition>
</template>

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

<style lang="scss" scoped>
.toast {
  position: fixed;
  top: 85%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--toast-bg, rgba(0, 0, 0, 0.8));
  backdrop-filter: blur(10px);
  color: var(--toast-text, #ffffff);
  border-radius: 40px;
  font-size: 14px;
  z-index: 9999;
  white-space: nowrap;
  box-shadow: var(--toast-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
}

.toast-icon {
  width: 18px;
  height: 18px;
}

.success {
  background: var(--success-bg, rgba(46, 125, 50, 0.9));
}
.error {
  background: var(--error-bg, rgba(211, 47, 47, 0.9));
}
.warning {
  background: var(--warning-bg, rgba(237, 108, 2, 0.9));
}
.info {
  background: var(--info-bg, rgba(25, 118, 210, 0.9));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
