<script lang="ts" setup>
import { ref } from 'vue'
import { trapTabKey, useDialogA11y } from '@/composables/useDialogA11y'

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
const containerRef = ref<HTMLElement | null>(null)
const titleId = `confirm-title-${Math.random().toString(36).slice(2)}`

let resolvePromise: (value: boolean) => void

const handleConfirm = () => {
  visible.value = false
  resolvePromise?.(true)
}

const handleCancel = () => {
  visible.value = false
  resolvePromise?.(false)
}

const show = (): Promise<boolean> => {
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

useDialogA11y(containerRef, handleCancel, () => visible.value)

defineExpose({ show })
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="confirm-overlay"
      @click.self="handleCancel"
      @keydown="trapTabKey($event, containerRef)"
    >
      <div
        ref="containerRef"
        :aria-labelledby="title ? titleId : undefined"
        aria-modal="true"
        class="confirm-container"
        role="dialog"
      >
        <div v-if="title" class="confirm-header">
          <h3 :id="titleId">{{ title }}</h3>
        </div>
        <div class="confirm-body">
          <p>{{ message }}</p>
        </div>
        <div class="confirm-footer">
          <button class="confirm-btn cancel" type="button" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button class="confirm-btn confirm" type="button" @click="handleConfirm">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.confirm-overlay {
  @include dialog-overlay;
}

.confirm-container {
  @include dialog-container(300px);
  max-width: calc(100vw - 48px);
}

.confirm-header {
  @include dialog-header;
}

.confirm-body {
  @include dialog-body;
}

.confirm-footer {
  @include dialog-footer;
}

.confirm-btn {
  @include dialog-btn;
}
</style>
