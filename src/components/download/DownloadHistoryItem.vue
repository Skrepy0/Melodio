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
    <img v-if="item.coverUrl" :src="item.coverUrl" alt="cover" class="cover" />
    <div v-else class="cover placeholder">
      <Icon icon="mdi:music" width="24" />
    </div>

    <div class="content">
      <div class="title">{{ item.name }}</div>
      <div class="subtitle">{{ item.singers || item.album }}</div>
      <div class="meta-row">
        <span>{{ $t('downloads.history.completedAt') }}: {{ completedAtText }}</span>
      </div>
      <div class="meta-row">
        <span>{{ $t('downloads.history.fileSize') }}: {{ sizeText }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.download-history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.cover {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 12px;
  flex-shrink: 0;

  &.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }
}

.content {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.subtitle,
.meta-row {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
