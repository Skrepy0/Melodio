<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
interface Props {
  icon_width?: number
  icon: string
  title: string
  desc?: string
  modelValue: string | number
  placeholder?: string
  type?: 'integer' | 'decimal' | 'string'
  min?: number
  max?: number
  maxlength?: number
  defaultValue?: string | number
  required?: boolean // 是否必填
}

const props = withDefaults(defineProps<Props>(), {
  icon_width: 22,
  desc: '',
  placeholder: 'Value',
  type: 'string',
  min: undefined,
  max: undefined,
  maxlength: undefined,
  defaultValue: undefined,
  required: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'reset'): void
}>()

const errorMessage = ref<string>('')
const inputValue = ref<string>(String(props.modelValue))

const isDefault = computed(() => {
  if (props.defaultValue === undefined) return true
  return String(props.modelValue) === String(props.defaultValue)
})

watch(
  () => props.modelValue,
  (newVal) => {
    inputValue.value = String(newVal)
  }
)

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  const rawValue = target.value
  let error = ''
  let isValid
  if (props.required && rawValue.trim() === '') {
    error = t('input_box.error.empty')
    inputValue.value = rawValue
    errorMessage.value = error
    return
  }
  if (props.type === 'integer') {
    if (rawValue === '' || rawValue === '-') {
      error = ''
      isValid = true
    } else {
      const integerRegex = /^-?\d+$/
      if (!integerRegex.test(rawValue)) {
        error = t('input_box.error.integer.invalid')
        isValid = false
      } else {
        const num = Number(rawValue)
        if (props.min !== undefined && num < props.min) {
          error = t('input_box.error.integer.min', { min: props.min })
          isValid = false
        } else if (props.max !== undefined && num > props.max) {
          error = t('input_box.error.integer.max', { max: props.max })
          isValid = false
        } else {
          isValid = true
        }
      }
    }
  } else if (props.type === 'decimal') {
    if (rawValue === '' || rawValue === '-' || rawValue === '.') {
      error = ''
      isValid = true
    } else {
      const decimalRegex = /^-?\d+(\.\d*)?$/
      if (!decimalRegex.test(rawValue)) {
        error = t('input_box.error.decimal.invalid')
        isValid = false
      } else {
        const num = Number(rawValue)
        if (props.min !== undefined && num < props.min) {
          error = t('input_box.error.decimal.min', { min: props.min })
          isValid = false
        } else if (props.max !== undefined && num > props.max) {
          error = t('input_box.error.decimal.max', { max: props.max })
          isValid = false
        } else {
          isValid = true
        }
      }
    }
  } else {
    if (props.maxlength !== undefined && rawValue.length > props.maxlength) {
      error = t('input_box.error.string.max', { max: props.maxlength })
      isValid = false
    } else {
      isValid = true
    }
  }

  inputValue.value = rawValue
  errorMessage.value = error

  if (isValid && rawValue !== '' && rawValue !== '-' && rawValue !== '.') {
    let emitValue: string | number = rawValue
    if (props.type === 'integer' || props.type === 'decimal') {
      emitValue = Number(rawValue)
    }
    emit('update:modelValue', emitValue)
  } else if (isValid && (rawValue === '' || rawValue === '-' || rawValue === '.')) {
    emit('update:modelValue', '')
  }
}

const resetToDefault = () => {
  if (props.defaultValue === undefined) return
  errorMessage.value = ''
  inputValue.value = String(props.defaultValue)
  emit('update:modelValue', props.defaultValue)
  emit('reset')
}
</script>

<template>
  <div class="setting-item">
    <div class="setting-row">
      <div class="item-left">
        <Icon
          :icon="props.icon"
          :width="props.icon_width"
          class="item-icon"
          color="var(--primary-color)"
        />
        <span class="item-label">{{ props.title }}</span>
      </div>
      <div class="input-wrapper">
        <input
          :class="{ 'has-error': errorMessage }"
          :placeholder="props.placeholder"
          :value="inputValue"
          class="text-input"
          type="text"
          @input="onInput"
        />
        <button
          v-if="props.defaultValue !== undefined"
          :disabled="isDefault"
          class="reset-btn"
          title="恢复默认值"
          @click="resetToDefault"
        >
          <Icon icon="mdi:restore" width="18" />
        </button>
      </div>
    </div>
    <div v-if="props.desc && !errorMessage" class="setting-desc">{{ props.desc }}</div>
    <div v-if="errorMessage" class="setting-error">{{ errorMessage }}</div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/theme/settings.scss';
.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-input {
  border: 1px solid var(--primary-color);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
  font-family: inherit;
  width: 100px;
  background: var(--bg-color);
  color: var(--text-color);
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  &::placeholder {
    color: var(--text-secondary);
    font-weight: 300;
    font-size: 13px;
    opacity: 0.8;
  }

  &:hover {
    border-color: var(--primary-color);
  }

  &.has-error {
    border-color: #f44336 !important;
    box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.15) !important;
  }
}

.reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--primary-color);
  cursor: pointer;
  transition:
    background 0.2s ease,
    opacity 0.2s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(76, 106, 255, 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.setting-error {
  color: #f44336;
  font-size: 12px;
  margin-top: 4px;
  padding-left: 4px;
}
</style>
