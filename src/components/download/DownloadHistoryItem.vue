<script lang="ts" setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { DownloadHistoryItem } from '@/utils/interface'

const props = defineProps<{
  item: DownloadHistoryItem
}>()

const completedAtText = computed(() => {
  return new Date(props.item.completedAt).toLocaleString()
})

const sizeText = computed(() => formatBytes(props.item.size))

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}
</script>

<template>
  <div class="download-history-item">
    <div class="cover">
      <img v-if="item.coverUrl" :src="item.coverUrl" alt="" />
      <Icon v-else icon="mdi:music-note" width="20" />
    </div>

    <div class="content">
      <div class="title">{{ item.name }}</div>
      <div class="subtitle">{{ item.singers || item.album }}</div>
      <div class="meta-row tabular">{{ sizeText }} · {{ completedAtText }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.download-history-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: var(--space-4);
    right: 0;
    bottom: 0;
    height: 1px;
    background-color: var(--hairline);
    transform: scaleY(0.5);
    transform-origin: bottom;
  }
}

.cover {
  @include cover-thumbnail(var(--radius-sm), 48px);
  color: var(--text-tertiary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-color);
  @include text-ellipsis;
}

.subtitle {
  margin-top: 1px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  @include text-ellipsis;
}

.meta-row {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
