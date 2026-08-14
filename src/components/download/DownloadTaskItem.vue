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
    <img v-if="task.coverUrl" :src="task.coverUrl" alt="cover" class="cover" />
    <div v-else class="cover placeholder">
      <Icon icon="mdi:music" width="24" />
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
        <div class="progress-value">{{ progressText }}</div>
      </div>

      <div class="detail-row">
        <span>{{ loadedText }} / {{ totalText }}</span>
        <span v-if="task.errorMessage" class="error-text">{{ task.errorMessage }}</span>
      </div>

      <div class="actions">
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
.download-task-item {
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

.top-row,
.progress-row,
.detail-row,
.actions {
  display: flex;
  align-items: center;
}

.top-row {
  justify-content: space-between;
  gap: 12px;
}

.meta {
  min-width: 0;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.status,
.detail-row {
  font-size: 12px;
  color: var(--text-secondary);
}

.progress-row {
  gap: 10px;
  margin-top: 10px;
}

.progress-track {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-color-dark));
  border-radius: 999px;
  transition: width 0.2s ease;
}

.progress-value {
  min-width: 36px;
  text-align: right;
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-row {
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.error-text {
  color: #ff6b6b;
}

.actions {
  margin-top: 12px;
}

.action-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: var(--primary-color);
  color: #fff;
  font-size: 13px;
}
</style>
