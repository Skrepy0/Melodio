<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  click: () => void
  icon: string
  icon_width?: number
  title: string
  desc: string
  isLink?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  icon_width: 22,
  isLink: true,
})
</script>

<template>
  <div class="setting-item clickable" @click="props.click">
    <div class="setting-row">
      <div class="item-left">
        <Icon
          :width="props.icon_width"
          class="item-icon"
          :icon="props.icon"
          color="var(--primary-color)"
        />
        <span class="item-label">{{ props.title }}</span>
      </div>
      <div class="item-right">
        <Icon
          :width="20"
          :icon="props.isLink ? 'mdi:chevron-right' : 'material-symbols:chevron-left'"
          color="var(--primary-color)"
        />
      </div>
    </div>
    <div class="setting-desc">{{ props.desc }}</div>
  </div>
</template>

<style scoped lang="scss">
@use '@/theme/settings.scss';
</style>
