<script lang="ts" setup>
import { Icon } from '@iconify/vue'

interface Props {
  icon: string
  title: string
  icon_width?: number
  checked: any[] | boolean | Set<any> | undefined
  change: (e: Event) => void
}
const props = defineProps<Props>()
</script>

<template>
  <div class="setting-item">
    <div class="setting-row">
      <div class="item-left">
        <Icon
          :icon="props.icon"
          :width="props.icon_width ?? 22"
          class="item-icon"
          color="var(--primary-color)"
        />
        <span class="item-label">{{ props.title }}</span>
      </div>
      <label class="switch">
        <input :checked="props.checked" type="checkbox" @change="props.change" />
        <span class="slider round"></span>
      </label>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/theme/settings.scss';
</style>
