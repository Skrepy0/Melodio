<template>
  <Transition name="fade">
    <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
      <div class="confirm-container">
        <div v-if="title" class="confirm-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="confirm-body">
          <p>{{ message }}</p>
        </div>
        <div class="confirm-footer">
          <button class="confirm-btn cancel" @click="handleCancel">{{ cancelText }}</button>
          <button class="confirm-btn confirm" @click="handleConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

interface Props {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

withDefaults(defineProps<Props>(), {
  title: '',
  confirmText: '确定',
  cancelText: '取消',
})

const visible = ref(true)

let resolvePromise: (value: boolean) => void

const handleConfirm = () => {
  visible.value = false
  resolvePromise(true)
}

const handleCancel = () => {
  visible.value = false
  resolvePromise(false)
}

const show = (): Promise<boolean> => {
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

defineExpose({ show })
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.confirm-container {
  width: 280px;
  background: var(--bg-color);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  animation: scaleIn 0.2s ease;
}

.confirm-header {
  padding: 16px 16px 0;
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
  }
}

.confirm-body {
  padding: 16px;
  p {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.confirm-footer {
  display: flex;
  border-top: 1px solid var(--setting-border);
}

.confirm-btn {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &.cancel {
    color: var(--text-secondary);
    &:hover {
      background: var(--header-back-hover);
    }
  }

  &.confirm {
    color: var(--primary-color);
    &:hover {
      background: rgba(var(--primary-color-rgb), 0.05);
    }
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
