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
    <button :aria-label="$t('common.back')" class="header-back" type="button" @click="props.goBack">
      <Icon
        :width="props.icon_width"
        color="var(--primary-color)"
        icon="material-symbols:arrow-back"
      />
    </button>
    <div class="header-title">{{ props.title }}</div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/theme/settings';
</style>
