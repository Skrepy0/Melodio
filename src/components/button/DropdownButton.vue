<template>
  <div class="circle-dropdown-container">
    <CircleButton
      ref="buttonRef"
      :icon="buttonIcon"
      :size="size"
      :bg-color="bgColor"
      :icon-color="iconColor"
      :disabled="disabled"
      @click="toggleDropdown"
    />
    <Transition name="dropdown-fade">
      <div
        v-if="showDropdown"
        ref="dropdownRef"
        class="dropdown-menu"
        :class="placement"
        :style="{ maxHeight, transform: `translate(${dx}px, ${dy}px)` }"
      >
        <div class="dropdown-list">
          <div
            v-for="(item, index) in options"
            :key="index"
            class="dropdown-item"
            :class="{ disabled: item.disabled }"
            @click="selectItem(item)"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="item-icon" :width="itemIconSize" />
            <span class="item-description">{{ item.description }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from './CircleButton.vue' // 导入基础圆形按钮
import type { DropdownButtonProps, DropdownItem } from '@/utils/interface.ts'

const props = withDefaults(defineProps<DropdownButtonProps>(), {
  buttonIcon: 'mdi:dots-horizontal',
  size: 48,
  bgColor: 'var(--bg-color, #e0e0e0)',
  iconColor: 'var(--text-color, #333)',
  disabled: false,
  placement: 'bottom-start',
  maxHeight: '240px',
  itemIconSize: 20,
  dx: 0,
  dy: 0,
})

const emit = defineEmits<{
  (e: 'select', item: DropdownItem): void
  (e: 'visibleChange', visible: boolean): void
}>()

const showDropdown = ref(false)
const buttonRef = ref<InstanceType<typeof CircleButton> | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  if (props.disabled) return
  showDropdown.value = !showDropdown.value
  emit('visibleChange', showDropdown.value)
}

const selectItem = (item: DropdownItem) => {
  if (item.disabled) return
  emit('select', item)
  showDropdown.value = false
  emit('visibleChange', false)
}

const handleClickOutside = (event: MouseEvent) => {
  if (!showDropdown.value) return
  const target = event.target as HTMLElement
  if (
    dropdownRef.value &&
    !dropdownRef.value.contains(target) &&
    buttonRef.value?.$el &&
    !buttonRef.value.$el.contains(target)
  ) {
    showDropdown.value = false
    emit('visibleChange', false)
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
.circle-dropdown-container {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: absolute;
  z-index: 1000;
  min-width: 180px;
  background-color: var(--bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  margin-top: 8px;

  &.bottom-start {
    top: 100%;
    left: 0;
  }
  &.bottom-end {
    top: 100%;
    right: 0;
  }
  &.top-start {
    bottom: 100%;
    left: 0;
    margin-top: 0;
    margin-bottom: 8px;
  }
  &.top-end {
    bottom: 100%;
    right: 0;
    margin-top: 0;
    margin-bottom: 8px;
  }
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--text-color, #333);

  &:hover:not(.disabled) {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.item-icon {
  flex-shrink: 0;
  color: var(--text-secondary, #666);
}

.item-description {
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.45s,
    transform 0.45s;
}
.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
