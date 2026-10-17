<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import CircleButton from './CircleButton.vue'
import type { DropdownButtonProps, DropdownItem } from '@/utils/interface.ts'

const props = withDefaults(defineProps<DropdownButtonProps>(), {
  visible: false,
  buttonIcon: 'mdi:dots-horizontal',
  size: 48,
  bgColor: 'transparent',
  iconColor: 'var(--text-secondary)',
  disabled: false,
  placement: 'bottom-start',
  maxHeight: '240px',
  itemIconSize: 20,
  dx: 0,
  dy: 0,
  label: '',
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

  let useTop: boolean
  if (isBottomPref) {
    if (spaceBelow >= dropdownRect.height + (props.dy || 0)) {
      useTop = false
    } else useTop = spaceAbove >= dropdownRect.height + (props.dy || 0)
  } else {
    if (spaceAbove >= dropdownRect.height + (props.dy || 0)) {
      useTop = true
    } else useTop = spaceBelow < dropdownRect.height + (props.dy || 0)
  }

  let leftAlign: boolean
  if (isEndPref) {
    if (spaceRight >= dropdownRect.width + (props.dx || 0)) {
      leftAlign = false
    } else leftAlign = spaceLeft >= dropdownRect.width + (props.dx || 0)
  } else {
    if (spaceLeft >= dropdownRect.width + (props.dx || 0)) {
      leftAlign = true
    } else leftAlign = spaceRight < dropdownRect.width + (props.dx || 0)
  }

  let top: number
  let left: number
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
    await calculatePosition()
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

const handleKeydown = (event: KeyboardEvent) => {
  if (!showDropdown.value) return
  if (event.key === 'Escape') {
    showDropdown.value = false
    ;(buttonRef.value?.$el as HTMLElement | undefined)?.focus()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResizeOrScroll)
  window.addEventListener('scroll', handleResizeOrScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
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

<template>
  <div class="circle-dropdown-container">
    <CircleButton
      ref="buttonRef"
      :bg-color="bgColor"
      :disabled="disabled"
      :icon="buttonIcon"
      :icon-color="iconColor"
      :label="label"
      :size="size"
      @click="toggleDropdown"
    />
    <Teleport to="body">
      <Transition name="dropdown-fade">
        <div
          v-if="showDropdown"
          ref="dropdownRef"
          :style="dropdownStyle"
          :aria-label="label || $t('common.more')"
          class="dropdown-menu"
          role="menu"
        >
          <div class="dropdown-list">
            <button
              v-for="(item, index) in options"
              :key="index"
              :class="{ disabled: item.disabled }"
              :disabled="item.disabled"
              class="dropdown-item"
              role="menuitem"
              type="button"
              @click="selectItem(item)"
            >
              <Icon v-if="item.icon" :icon="item.icon" :width="itemIconSize" class="item-icon" />
              <span class="item-description">{{ item.description }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.circle-dropdown-container {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: fixed;
  z-index: 2000;
  min-width: 180px;
  background-color: var(--bg-dialog);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  overflow-y: auto;
  max-height: v-bind(maxHeight);
  padding: var(--space-1) 0;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  min-height: 44px;
  border: none;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  color: var(--text-color);

  &:hover:not(.disabled),
  &:focus-visible {
    background-color: var(--bg-card-dimmed);
    outline: none;
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
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  word-break: break-word;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}
.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
