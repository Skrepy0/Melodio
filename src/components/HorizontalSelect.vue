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
  padding: 8px 4px;
  cursor: default;
  scrollbar-width: none; /* Firefox 隐藏滚动条 */
  -ms-overflow-style: none; /* IE/Edge 隐藏滚动条 */

  &::-webkit-scrollbar {
    display: none; /* Chrome/Safari 隐藏滚动条 */
  }
}

.select-item {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--bg-header, #f0f0f0);
  border-radius: 32px;
  font-size: 14px;
  color: var(--text-color, #333);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover:not(.disabled) {
    background-color: var(--bg-header-hover, #e0e0e0);
    transform: translateY(-1px);
  }

  &.selected {
    background-color: var(--primary-color, #007aff);
    color: white;
    .item-icon {
      color: white;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.item-icon {
  flex-shrink: 0;
  color: inherit;
}

.item-label {
  white-space: nowrap;
}
</style>
