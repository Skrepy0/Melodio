<template>
  <Transition name="fade">
    <div v-if="visible" class="prompt-overlay" @click.self="cancel">
      <div class="prompt-container">
        <div class="prompt-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="prompt-body">
          <p v-if="message">{{ message }}</p>
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="prompt-input"
            :placeholder="placeholder"
            @keyup.enter="confirm"
          />
        </div>
        <div class="prompt-footer">
          <button class="prompt-btn cancel" @click="cancel">取消</button>
          <button class="prompt-btn confirm" @click="confirm">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '请输入',
  message: '',
  defaultValue: '',
  placeholder: '请输入内容',
})

const visible = ref(true)
const inputValue = ref(props.defaultValue)
const inputRef = ref<HTMLInputElement | null>(null)

let resolvePromise: (value: string | null) => void

const confirm = () => {
  visible.value = false
  resolvePromise(inputValue.value)
}

const cancel = () => {
  visible.value = false
  resolvePromise(null)
}

const show = (): Promise<string | null> => {
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

defineExpose({ show })

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<style scoped lang="scss">
.prompt-overlay {
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

.prompt-container {
  width: 280px;
  background: var(--bg-color);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  animation: scaleIn 0.2s ease;
}

.prompt-header {
  padding: 16px 16px 0;
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
  }
}

.prompt-body {
  padding: 16px;
  p {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.prompt-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-input);
  color: var(--text-color);
  outline: none;
  transition:
    border-color 0.2s,
    background 0.2s;
  &:focus {
    border-color: var(--primary-color);
  }
}

.prompt-footer {
  display: flex;
  border-top: 1px solid var(--setting-border);
  .prompt-btn {
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
        background: rgba(var(--primary-color-rgb, 0, 122, 255), 0.05);
      }
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
