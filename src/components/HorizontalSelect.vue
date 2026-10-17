<script lang="ts" setup>
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
  <div class="horizontal-select">
    <div
      v-for="(item, index) in options"
      :key="index"
      :class="{
        selected: modelValue === item.value,
        disabled: item.disabled,
      }"
      class="select-item"
      @click="selectItem(item)"
    >
      <Icon v-if="item.icon" :icon="item.icon" :width="iconSize" class="item-icon" />
      <span class="item-label">{{ item.label || item.description }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// A segmented control: one quiet track, one raised chip for the active view.
// No gradient, no glow — the selected chip reads through contrast alone.
.horizontal-select {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background-color: var(--bg-input);
  border-radius: var(--radius-md);
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.select-item {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background-color: transparent;
  border-radius: calc(var(--radius-md) - 3px);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease;
  user-select: none;
  -webkit-user-select: none;

  &:hover:not(.selected):not(.disabled) {
    color: var(--text-color);
  }

  // The active view is state, so it is the one place in the control that takes
  // the accent. The raised chip stays neutral so the track keeps its weight.
  // `--bg-elevated` is more opaque than the track's `--bg-input`, so the chip
  // still reads as raised when both are translucent over a wallpaper.
  &.selected {
    background-color: var(--bg-elevated);
    color: var(--primary-color);
    box-shadow: var(--elevation-1);

    .item-icon {
      opacity: 1;
    }
  }

  &.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.item-icon {
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.85;
}

.item-label {
  white-space: nowrap;
}
</style>
