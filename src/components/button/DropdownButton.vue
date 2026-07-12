<template>
  <div class="circle-dropdown-container">
    <CircleButton
      ref="buttonRef"
      :bg-color="bgColor"
      :disabled="disabled"
      :icon="buttonIcon"
      :icon-color="iconColor"
      :size="size"
      @click="toggleDropdown"
    />
    <Teleport to="body">
      <Transition name="dropdown-fade">
        <div v-if="showDropdown" ref="dropdownRef" :style="dropdownStyle" class="dropdown-menu">
          <div class="dropdown-list">
            <div
              v-for="(item, index) in options"
              :key="index"
              :class="{ disabled: item.disabled }"
              class="dropdown-item"
              @click="selectItem(item)"
            >
              <Icon v-if="item.icon" :icon="item.icon" :width="itemIconSize" class="item-icon" />
              <span class="item-description">{{ item.description }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from './CircleButton.vue'
import type { DropdownButtonProps, DropdownItem } from '@/utils/interface.ts'

const props = withDefaults(defineProps<DropdownButtonProps>(), {
  visible: false,
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
  (e: 'update:visible', value: boolean): void
  (e: 'select', item: DropdownItem): void
  (e: 'visibleChange', visible: boolean): void
}>()

const showDropdown = ref(props.visible ?? false)
const buttonRef = ref<InstanceType<typeof CircleButton> | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const dropdownStyle = ref<{ top?: string; left?: string; right?: string; bottom?: string }>({})

const calculatePosition = async () => {
  if (!showDropdown.value || !buttonRef.value?.$el) return
  await nextTick()
  const button = buttonRef.value.$el
  const buttonRect = button.getBoundingClientRect()
  const dropdown = dropdownRef.value
  if (!dropdown) return

  const dropdownRect = dropdown.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const [verticalPref, horizontalPref] = props.placement.split('-')
  const isBottomPref = verticalPref === 'bottom'
  const isEndPref = horizontalPref === 'end'

  const spaceAbove = buttonRect.top
  const spaceBelow = viewportHeight - buttonRect.bottom
  const spaceLeft = buttonRect.left
  const spaceRight = viewportWidth - buttonRect.right

  let useTop = false
  if (isBottomPref) {
    if (spaceBelow >= dropdownRect.height + (props.dy || 0)) {
      useTop = false
    } else if (spaceAbove >= dropdownRect.height + (props.dy || 0)) {
      useTop = true
    } else {
      useTop = false
    }
  } else {
    if (spaceAbove >= dropdownRect.height + (props.dy || 0)) {
      useTop = true
    } else if (spaceBelow >= dropdownRect.height + (props.dy || 0)) {
      useTop = false
    } else {
      useTop = true
    }
  }

  let leftAlign = !isEndPref
  if (isEndPref) {
    if (spaceRight >= dropdownRect.width + (props.dx || 0)) {
      leftAlign = false
    } else if (spaceLeft >= dropdownRect.width + (props.dx || 0)) {
      leftAlign = true
    } else {
      leftAlign = false
    }
  } else {
    if (spaceLeft >= dropdownRect.width + (props.dx || 0)) {
      leftAlign = true
    } else if (spaceRight >= dropdownRect.width + (props.dx || 0)) {
      leftAlign = false
    } else {
      leftAlign = true
    }
  }

  let top = 0
  let left = 0
  if (useTop) {
    top = buttonRect.top - dropdownRect.height - (props.dy || 0)
  } else {
    top = buttonRect.bottom + (props.dy || 0)
  }
  if (leftAlign) {
    left = buttonRect.left + (props.dx || 0)
  } else {
    left = buttonRect.right - dropdownRect.width - (props.dx || 0)
  }

  top = Math.max(8, Math.min(top, viewportHeight - dropdownRect.height - 8))
  left = Math.max(8, Math.min(left, viewportWidth - dropdownRect.width - 8))

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    right: 'auto',
    bottom: 'auto',
  }
}

const handleResizeOrScroll = () => {
  if (showDropdown.value) {
    calculatePosition()
  }
}

const toggleDropdown = async () => {
  if (props.disabled) return
  const newVal = !showDropdown.value
  showDropdown.value = newVal
  if (newVal) {
    await nextTick()
    calculatePosition()
  }
}

const selectItem = (item: DropdownItem) => {
  if (item.disabled) return
  emit('select', item)
  showDropdown.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (!showDropdown.value) return
  const target = event.target as HTMLElement
  const isInsideDropdown = dropdownRef.value?.contains(target)
  const isInsideButton = buttonRef.value?.$el?.contains(target)
  if (!isInsideDropdown && !isInsideButton) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleResizeOrScroll)
  window.addEventListener('scroll', handleResizeOrScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResizeOrScroll)
  window.removeEventListener('scroll', handleResizeOrScroll, true)
})

watch(
  () => props.visible,
  (val) => {
    if (val !== undefined) showDropdown.value = val
  }
)
watch(showDropdown, (val) => {
  emit('update:visible', val)
  emit('visibleChange', val)
  if (val) calculatePosition()
})
</script>

<style lang="scss" scoped>
.circle-dropdown-container {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: fixed;
  z-index: 2000;
  min-width: 180px;
  background-color: var(--bg-color);
  border: 1px solid var(--dropdown-border, rgba(0, 0, 0, 0.1));
  border-radius: 12px;
  box-shadow: var(--dropdown-shadow, 0 4px 16px rgba(0, 0, 0, 0.12));
  overflow-y: auto;
  max-height: v-bind(maxHeight);
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
  color: var(--text-color);

  &:hover:not(.disabled) {
    background-color: var(--header-back-hover);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.item-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.item-description {
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
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
