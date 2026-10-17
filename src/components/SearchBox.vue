<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  modelValue?: string // v-model 绑定的值
  placeholder?: string // 占位文本
  showButton?: boolean // 是否显示右侧搜索按钮
  clearable?: boolean // 是否显示清除按钮
  disabled?: boolean // 是否禁用
  size?: 'small' | 'medium' | 'large' // 尺寸
  realTimeSearch?: boolean // 是否启用实时搜索（输入时自动触发搜索）
  debounce?: number // 防抖延迟（ms），仅当 realTimeSearch 为 true 时生效
  autofocus?: boolean // 自动聚焦
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  showButton: false,
  clearable: true,
  disabled: false,
  size: 'medium',
  realTimeSearch: true,
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

  if (props.realTimeSearch) {
    if (debounceTimer) clearTimeout(debounceTimer)
    if (props.debounce > 0) {
      debounceTimer = setTimeout(() => {
        emit('search', value)
      }, props.debounce)
    } else {
      emit('search', value)
    }
  }
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<template>
  <div :class="[`size-${size}`, { disabled }]" class="search-container">
    <div class="search-box">
      <button
        :aria-label="$t('common.search')"
        class="icon-btn search-icon"
        type="button"
        @click="handleSearch"
      >
        <Icon :width="iconSize" icon="mdi:magnify" />
      </button>
      <input
        ref="inputRef"
        :autofocus="autofocus"
        :disabled="disabled"
        :placeholder="placeholder || $t('searchBox.placeholder')"
        :value="modelValue"
        class="search-input"
        type="text"
        @input="onInput"
        @keyup.enter="handleSearch"
      />

      <button
        v-if="clearable && modelValue.length > 0"
        :aria-label="$t('common.remove')"
        class="icon-btn clear-icon"
        type="button"
        @click="clearInput"
      >
        <Icon :width="iconSize" icon="mdi:close-circle" />
      </button>

      <button
        v-if="showButton"
        :disabled="disabled"
        class="search-button"
        type="button"
        @click="handleSearch"
      >
        {{ $t('searchBox.searchButton') }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-container {
  width: 100%;
  // As a flex item in a page header this box would otherwise refuse to shrink
  // below its min-content width, so the clear button appearing after the first
  // character would push the search button off-screen on narrow phones.
  min-width: 0;
  flex: 1 1 auto;
  box-sizing: border-box;
}

.size-small {
  .search-box {
    padding: 0 2px 0 6px;
    border-radius: var(--radius-sm);
    height: 40px;
  }
  .search-input {
    font-size: var(--font-size-sm);
    padding: 0;
  }
  .search-button {
    padding: 0 12px;
    font-size: var(--font-size-xs);
  }
}

.size-medium {
  .search-box {
    padding: 0 6px 0 10px;
    border-radius: var(--radius-md);
    height: 42px;
  }
  .search-input {
    font-size: var(--font-size-base);
    padding: 0;
  }
  .search-button {
    padding: 6px 14px;
    font-size: var(--font-size-sm);
  }
}

.size-large {
  .search-box {
    padding: 0 8px 0 12px;
    border-radius: var(--radius-md);
    height: 48px;
  }
  .search-input {
    font-size: var(--font-size-lg);
    padding: 0;
  }
  .search-button {
    padding: 8px 18px;
    font-size: var(--font-size-base);
  }
}

// A filled field on the page ground: no border, no shadow, no focus glow.
// Focus is shown by the caret and a hairline that takes the accent.
.search-box {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-input);
  border: 1px solid transparent;
  transition: border-color var(--duration-normal) ease;

  &:focus-within {
    border-color: var(--focus-ring);
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: color var(--duration-fast) ease;
  border-radius: var(--radius-xs);
  flex-shrink: 0;

  &:hover {
    color: var(--text-color);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }
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
    color: var(--text-tertiary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.search-button {
  display: inline-flex;
  align-items: center;
  align-self: stretch;
  margin: 1px 0;
  // The one committed action on the page, so it takes the accent instead of
  // the graphite used for everything else.
  background-color: var(--primary-color);
  color: var(--on-primary-color);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: opacity var(--duration-fast) ease;
  white-space: nowrap;
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;

  &:hover:not(:disabled) {
    opacity: 0.82;
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
