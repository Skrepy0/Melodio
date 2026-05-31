<script setup lang="ts">
import { onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import type { HorizontalSelectOption, HorizontalSelectProps } from '@/utils/interface.ts'

const props = withDefaults(defineProps<HorizontalSelectProps>(), {
  modelValue: null,
  iconSize: 20,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'select', option: HorizontalSelectOption): void
}>()

const selectItem = (item: HorizontalSelectOption) => {
  if (item.disabled) return
  emit('update:modelValue', item.value)
  emit('select', item)
}

onMounted(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    const firstEnabled = props.options.find((opt) => !opt.disabled)
    if (firstEnabled) {
      selectItem(firstEnabled)
    }
  }
})
</script>
<template>
  <div class="horizontal-select" ref="scrollContainer">
    <div
      v-for="(item, index) in options"
      :key="index"
      class="select-item"
      :class="{
        selected: modelValue === item.value,
        disabled: item.disabled,
      }"
      @click="selectItem(item)"
    >
      <Icon v-if="item.icon" :icon="item.icon" class="item-icon" :width="iconSize" />
      <span class="item-label">{{ item.label || item.description }}</span>
    </div>
  </div>
</template>
<style scoped lang="scss">
.horizontal-select {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  padding: 8px 4px 12px;
  cursor: default;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
    &:hover {
      background: var(--scrollbar-thumb-hover);
    }
  }
}

.select-item {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background-color: var(--bg-card);
  border-radius: 40px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);

  &:hover:not(.disabled) {
    background-color: var(--bg-card-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--border-light-hover);
  }

  &.selected {
    background: linear-gradient(135deg, var(--primary-color), var(--primary-color-dark));
    color: white;
    border: none;
    box-shadow: var(--selected-shadow);
    .item-icon {
      color: white;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    &:hover {
      transform: none;
    }
  }
}

.item-icon {
  flex-shrink: 0;
  color: inherit;
  transition: transform 0.1s ease;
}

.select-item:active:not(.disabled) .item-icon {
  transform: scale(0.95);
}

.item-label {
  white-space: nowrap;
}
</style>
