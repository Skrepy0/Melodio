<script lang="ts" setup>
import { Icon } from '@iconify/vue'

interface Props {
  goBack: () => void
  title: string
  icon_width?: number
}
const props = withDefaults(defineProps<Props>(), {
  icon_width: 24,
})
</script>

<template>
  <div class="settings-header">
    <div class="header-back" @click="props.goBack">
      <Icon
        :width="props.icon_width"
        color="var(--primary-color)"
        icon="material-symbols:arrow-back"
      />
    </div>
    <div class="header-title">{{ props.title }}</div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/theme/settings';
</style>
