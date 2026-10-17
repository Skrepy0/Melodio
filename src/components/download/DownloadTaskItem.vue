<script lang="ts" setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { DownloadTaskSnapshot } from '@/utils/interface'

const props = defineProps<{
  task: DownloadTaskSnapshot
}>()

const emit = defineEmits<{
  (e: 'pause', taskId: string): void
  (e: 'resume', taskId: string): void
  (e: 'retry', taskId: string): void
}>()

const progressPercent = computed(() => {
  if (props.task.progress >= 0) return Math.max(0, Math.min(100, props.task.progress))
  return 0
})

const progressText = computed(() => {
  if (props.task.progress >= 0) return `${props.task.progress}%`
  return '--'
})

const loadedText = computed(() => formatBytes(props.task.loaded))
const totalText = computed(() => {
  if (props.task.total <= 0) return 'Unknown'
  return formatBytes(props.task.total)
})

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
  <div class="download-task-item">
    <div class="cover">
      <img v-if="task.coverUrl" :src="task.coverUrl" alt="" />
      <Icon v-else icon="mdi:music-note" width="20" />
    </div>

    <div class="content">
      <div class="top-row">
        <div class="meta">
          <div class="title">{{ task.name }}</div>
          <div class="subtitle">{{ task.singers || task.album }}</div>
        </div>
        <div class="status">{{ $t(`downloads.status.${task.status}`) }}</div>
      </div>

      <div class="progress-row">
        <div class="progress-track">
          <div :style="{ width: `${progressPercent}%` }" class="progress-fill" />
        </div>
        <div class="progress-value tabular">{{ progressText }}</div>
      </div>

      <div class="detail-row">
        <span class="tabular">{{ loadedText }} / {{ totalText }}</span>
        <span v-if="task.errorMessage" class="error-text">{{ task.errorMessage }}</span>
        <button
          v-if="task.status === 'downloading'"
          class="action-btn"
          @click="emit('pause', task.taskId)"
        >
          {{ $t('downloads.actions.pause') }}
        </button>
        <button
          v-else-if="task.status === 'paused'"
          class="action-btn"
          @click="emit('resume', task.taskId)"
        >
          {{ $t('downloads.actions.resume') }}
        </button>
        <button
          v-else-if="task.status === 'failed'"
          class="action-btn"
          @click="emit('retry', task.taskId)"
        >
          {{ $t('downloads.actions.retry') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Downloads read as rows in the same list as songs: artwork, title, and a
// progress rule that belongs to the row rather than to a card.
.download-task-item {
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
}

.top-row,
.progress-row,
.detail-row {
  display: flex;
  align-items: center;
}

.top-row {
  justify-content: space-between;
  gap: var(--space-3);
}

.meta {
  min-width: 0;
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

.status,
.detail-row {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.status {
  flex-shrink: 0;
}

.progress-row {
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.progress-track {
  flex: 1;
  height: 3px;
  background: var(--progress-track);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: var(--radius-pill);
  transition: width 0.2s ease;
}

.progress-value {
  min-width: 34px;
  text-align: right;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.detail-row {
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.error-text {
  color: var(--danger-color);
}

.action-btn {
  margin-left: auto;
  padding: 4px 12px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--chip-bg);
  color: var(--text-color);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;

  &:hover {
    background: var(--bg-secondary);
  }
}
</style>
