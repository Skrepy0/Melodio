<script lang="ts" setup>
import { Icon } from '@iconify/vue'

interface Props {
  icon: string
  title: string
  desc: string
  icon_width?: number
  checked: any[] | boolean | Set<any> | undefined
  change: any
}
const props = defineProps<Props>()
</script>

<template>
  <div class="setting-item">
    <div class="setting-row">
      <div class="item-left">
        <Icon :icon="props.icon" :width="props.icon_width ?? 22" class="item-icon" />
        <span class="item-label">{{ props.title }}</span>
      </div>
      <label class="switch">
        <input
          :aria-label="props.title"
          :checked="props.checked"
          type="checkbox"
          @change="props.change"
        />
        <span class="slider round"></span>
      </label>
    </div>
    <div class="setting-desc">{{ props.desc }}</div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/theme/settings.scss';
</style>
