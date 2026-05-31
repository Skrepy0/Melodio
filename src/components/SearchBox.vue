<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  modelValue?: string // v-model 绑定的值
  placeholder?: string // 占位文本
  showButton?: boolean // 是否显示右侧搜索按钮
  clearable?: boolean // 是否显示清除按钮
  disabled?: boolean // 是否禁用
  size?: 'small' | 'medium' | 'large' // 尺寸
  debounce?: number // 防抖延迟（ms），用于实时搜索
  autofocus?: boolean // 自动聚焦
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  showButton: false,
  clearable: true,
  disabled: false,
  size: 'medium',
  debounce: 300,
  autofocus: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void // v-model 更新
  (e: 'search', value: string): void // 主动搜索（回车/点击图标/点击按钮）
  (e: 'input', value: string): void // 原始输入事件（未防抖，直接触发）
}>()

const inputRef = ref<HTMLInputElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const iconSize = computed(() => {
  switch (props.size) {
    case 'small':
      return '16'
    case 'large':
      return '24'
    default:
      return '20'
  }
})

const clearInput = () => {
  if (props.disabled) return
  emit('update:modelValue', '')
  emit('input', '')
  emit('search', '')
  inputRef.value?.focus()
}

const handleSearch = () => {
  if (props.disabled) return
  emit('search', props.modelValue)
}

const onInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('input', value)
  emit('update:modelValue', value)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (props.debounce > 0) {
    debounceTimer = setTimeout(() => {
      emit('search', value)
    }, props.debounce)
  } else {
    // 如果不需要防抖，可以立即触发 search（注意会与回车/点击重复触发）
    // 通常在实时搜索时 debounce > 0 使用，此处不主动调用 search 避免重复
  }
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<template>
  <div class="search-container" :class="[`size-${size}`, { disabled }]">
    <div class="search-box">
      <span class="search-icon" @click="handleSearch">
        <Icon icon="mdi:magnify" :width="iconSize" />
      </span>
      <input
        ref="inputRef"
        :value="modelValue"
        type="text"
        :placeholder="placeholder || $t('searchBox.placeholder')"
        :disabled="disabled"
        :autofocus="autofocus"
        @input="onInput"
        @keyup.enter="handleSearch"
        class="search-input"
      />

      <span v-if="clearable && modelValue.length > 0" class="clear-icon" @click="clearInput">
        <Icon icon="mdi:close-circle" :width="iconSize" />
      </span>

      <button v-if="showButton" class="search-button" :disabled="disabled" @click="handleSearch">
        {{ $t('searchBox.searchButton') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-container {
  width: 100%;
  box-sizing: border-box;
}

.size-small {
  .search-box {
    padding: 2px 8px;
    border-radius: 20px;
  }
  .search-input {
    font-size: 13px;
    padding: 4px 0;
  }
  .search-button {
    padding: 4px 12px;
    font-size: 12px;
  }
}

.size-medium {
  .search-box {
    padding: 4px 12px;
    border-radius: 24px;
  }
  .search-input {
    font-size: 15px;
    padding: 6px 0;
  }
  .search-button {
    padding: 6px 16px;
    font-size: 14px;
  }
}

.size-large {
  .search-box {
    padding: 6px 16px;
    border-radius: 32px;
  }
  .search-input {
    font-size: 16px;
    padding: 8px 0;
  }
  .search-button {
    padding: 8px 20px;
    font-size: 15px;
  }
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-color);
  border: 1px solid var(--input-border);
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
  &:focus-within {
    box-shadow: 0 0 0 2px rgba(var(--text-color-rgb, 26, 28, 30), 0.2);
    border-color: transparent;
  }
}

.search-icon,
.clear-icon {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  color: var(--text-color);
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.clear-icon {
  cursor: pointer;
}

.search-input {
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-color);
  font-family: inherit;

  &::placeholder {
    color: var(--text-color);
    opacity: 0.5;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.search-button {
  background-color: var(--text-color);
  color: var(--bg-color);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
  font-weight: 500;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
