<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { trapTabKey, useDialogA11y } from '@/composables/useDialogA11y'

interface Props {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmContent?: string
  cancelContent?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  message: '',
  defaultValue: '',
  placeholder: '',
  confirmContent: 'Confirm',
  cancelContent: 'Cancel',
})

const visible = ref(true)
const inputValue = ref(props.defaultValue)
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const titleId = `prompt-title-${Math.random().toString(36).slice(2)}`

let resolvePromise: (value: string | null) => void

const confirm = () => {
  visible.value = false
  resolvePromise?.(inputValue.value)
}

const cancel = () => {
  visible.value = false
  resolvePromise?.(null)
}

const show = (): Promise<string | null> => {
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

useDialogA11y(containerRef, cancel, () => visible.value)

defineExpose({ show })

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="prompt-overlay"
      @click.self="cancel"
      @keydown="trapTabKey($event, containerRef)"
    >
      <div
        ref="containerRef"
        :aria-labelledby="title ? titleId : undefined"
        aria-modal="true"
        class="prompt-container"
        role="dialog"
      >
        <div class="prompt-header">
          <h3 :id="titleId">{{ title }}</h3>
        </div>
        <div class="prompt-body">
          <p v-if="message">{{ message }}</p>
          <input
            ref="inputRef"
            v-model="inputValue"
            :placeholder="placeholder"
            class="prompt-input"
            data-autofocus
            type="text"
            @keyup.enter="confirm"
          />
        </div>
        <div class="prompt-footer">
          <button class="prompt-btn cancel" type="button" @click="cancel">
            {{ props.cancelContent }}
          </button>
          <button class="prompt-btn confirm" type="button" @click="confirm">
            {{ props.confirmContent }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.prompt-overlay {
  @include dialog-overlay;
}

.prompt-container {
  @include dialog-container(300px);
  max-width: calc(100vw - 48px);
}

.prompt-header {
  @include dialog-header;
}

.prompt-body {
  padding: var(--space-2) var(--space-5) var(--space-4);

  p {
    margin: 0 0 var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
  }
}

.prompt-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-color);
  font: inherit;
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color var(--duration-fast) ease;

  &::placeholder {
    color: var(--text-tertiary);
  }

  &:focus {
    border-color: var(--focus-ring);
  }
}

.prompt-footer {
  @include dialog-footer;

  .prompt-btn {
    @include dialog-btn;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
