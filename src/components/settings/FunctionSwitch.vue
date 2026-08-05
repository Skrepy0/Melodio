<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  icon: string
  title: string
  desc: string
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
          :width="props.icon_width ?? 22"
          class="item-icon"
          :icon="props.icon"
          color="var(--primary-color)"
        />
        <span class="item-label">{{ props.title }}</span>
      </div>
      <label class="switch">
        <input :checked="props.checked" type="checkbox" @change="props.change" />
        <span class="slider round"></span>
      </label>
    </div>
    <div class="setting-desc">{{ props.desc }}</div>
  </div>
</template>

<style scoped lang="scss">
@use '@/theme/settings.scss';
</style>
