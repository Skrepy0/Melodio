<script lang="ts" setup>
import { OnlineSong, Song } from '@/utils/interface'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  song: Song | OnlineSong
}

const props = defineProps<Props>()
const { t } = useI18n()

const visible = ref(false)

let resolvePromise: (value: boolean) => void

// ---- 控制背景滚动 ----
const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
}
const unlockBodyScroll = () => {
  document.body.style.overflow = ''
}

const handleClose = () => {
  visible.value = false
  unlockBodyScroll()
  resolvePromise(true)
}

const show = (): Promise<boolean> => {
  visible.value = true
  lockBodyScroll()
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

// 组件卸载时确保解锁滚动（避免意外残留）
onBeforeUnmount(() => {
  if (visible.value) {
    unlockBodyScroll()
  }
})

defineExpose({ show })

// ---------- 工具函数 ----------
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return t('infoDialog.placeholder')
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes < 0) return t('infoDialog.placeholder')
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const formatDate = (timestamp: number): string => {
  if (!timestamp) return t('infoDialog.placeholder')
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getSourceLabel = (source: string): string => {
  const key = `infoDialog.source.${source}`
  const translated = t(key)
  return translated === key ? source : translated
}

// ---------- 判断歌曲类型 ----------
const isOnlineSong = (song: Song | OnlineSong): song is OnlineSong => {
  return 'source' in song && typeof song.source === 'string'
}

// ---------- 生成信息字段 ----------
interface InfoField {
  label: string
  value: string
}

const infoFields = computed<InfoField[]>(() => {
  const song = props.song
  if (!song) return []

  if (isOnlineSong(song)) {
    const fields: InfoField[] = []
    fields.push({
      label: t('infoDialog.fields.name'),
      value: song.name || t('infoDialog.placeholder'),
    })
    fields.push({
      label: t('infoDialog.fields.artist'),
      value: song.singers || t('infoDialog.placeholder'),
    })
    if (song.album) fields.push({ label: t('infoDialog.fields.album'), value: song.album })
    if (song.source)
      fields.push({ label: t('infoDialog.fields.source'), value: getSourceLabel(song.source) })
    if (song.duration)
      fields.push({ label: t('infoDialog.fields.duration'), value: formatDuration(song.duration) })
    if (song.file_size_bytes)
      fields.push({
        label: t('infoDialog.fields.fileSize'),
        value: formatFileSize(song.file_size_bytes),
      })
    if (song.ext) fields.push({ label: t('infoDialog.fields.extension'), value: song.ext })
    if (song.cover_url)
      fields.push({ label: t('infoDialog.fields.cover'), value: t('infoDialog.coverAvailable') })
    return fields
  } else {
    const fields: InfoField[] = []
    fields.push({
      label: t('infoDialog.fields.title'),
      value: song.title || song.displayName || t('infoDialog.placeholder'),
    })
    if (song.artist) fields.push({ label: t('infoDialog.fields.artist'), value: song.artist })
    if (song.album) fields.push({ label: t('infoDialog.fields.album'), value: song.album })
    if (song.track && song.track > 0)
      fields.push({ label: t('infoDialog.fields.track'), value: String(song.track) })
    if (song.year && song.year > 0)
      fields.push({ label: t('infoDialog.fields.year'), value: String(song.year) })
    if (song.duration)
      fields.push({
        label: t('infoDialog.fields.duration'),
        value: formatDuration(song.duration / 1000),
      })
    if (song.size)
      fields.push({ label: t('infoDialog.fields.fileSize'), value: formatFileSize(song.size) })
    if (song.mediaType)
      fields.push({ label: t('infoDialog.fields.mediaType'), value: song.mediaType })
    if (song.dateAdded)
      fields.push({ label: t('infoDialog.fields.dateAdded'), value: formatDate(song.dateAdded) })
    if (song.dateModified)
      fields.push({
        label: t('infoDialog.fields.dateModified'),
        value: formatDate(song.dateModified),
      })
    return fields
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="info-overlay" @click.self="handleClose">
      <div class="info-card" @click.stop>
        <!-- 头部 -->
        <div class="info-header">
          <span class="info-title">{{ t('infoDialog.title') }}</span>
          <button class="close-btn" @click="handleClose">{{ t('infoDialog.close') }}</button>
        </div>

        <!-- 信息列表：左右两列 -->
        <div class="info-body">
          <div v-for="(field, index) in infoFields" :key="index" class="info-row">
            <span class="info-label">{{ field.label }}</span>
            <span class="info-value">{{ field.value }}</span>
          </div>
        </div>

        <!-- 底部 -->
        <div class="info-footer">
          <button class="footer-btn" @click="handleClose">{{ t('infoDialog.confirm') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ---------- 覆盖层 ---------- */
.info-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-color, rgba(0, 0, 0, 0.55));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ---------- 卡片 ---------- */
.info-card {
  width: 380px;
  max-width: 92vw;
  max-height: 80vh;
  background: var(--bg-color, #ffffff);
  border-radius: 20px;
  box-shadow: var(--shadow-md, 0 20px 60px rgba(0, 0, 0, 0.3));
  overflow: hidden;
  animation: scaleIn 0.25s cubic-bezier(0.21, 1.02, 0.35, 1);
  display: flex;
  flex-direction: column;
}

/* ---------- 头部 ---------- */
.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px 20px;
  border-bottom: 1px solid var(--setting-border, #f0f0f0);
  flex-shrink: 0;
}

.info-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color, #1a1a1a);
  letter-spacing: 0.3px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  color: var(--text-secondary, #999);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s,
    color 0.2s;
}
.close-btn:hover {
  background: var(--header-back-hover, #f5f5f5);
  color: var(--text-color, #1a1a1a);
}

/* ---------- 信息主体 ---------- */
.info-body {
  padding: 14px 20px 10px 20px;
  overflow-y: auto;
  flex: 1;
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: 6px 0;
  border-bottom: 1px solid var(--setting-border, #f5f5f5);
  gap: 16px;
}
.info-row:last-child {
  border-bottom: none;
}

.info-label {
  flex: 0 0 68px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #888);
  letter-spacing: 0.3px;
  padding-top: 1px;
}

.info-value {
  flex: 1;
  font-size: 14px;
  color: var(--text-color, #1a1a1a);
  word-break: break-word;
  line-height: 1.5;
}

/* ---------- 底部 ---------- */
.info-footer {
  padding: 12px 20px 18px 20px;
  border-top: 1px solid var(--setting-border, #f0f0f0);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.footer-btn {
  padding: 8px 28px;
  border: none;
  border-radius: 20px;
  background: var(--primary-color, #3498db);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s;
}
.footer-btn:hover {
  background: var(--primary-color-dark, #2980b9);
  transform: scale(1.02);
}
.footer-btn:active {
  transform: scale(0.97);
}

/* ---------- 动画 ---------- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes scaleIn {
  0% {
    opacity: 0;
    transform: scale(0.92) translateY(12px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ---------- 暗色适配 ---------- */
@media (prefers-color-scheme: dark) {
  .info-card {
    background: var(--bg-color, #1e1e1e);
  }
  .info-header {
    border-bottom-color: var(--setting-border, #333);
  }
  .info-row {
    border-bottom-color: var(--setting-border, #2a2a2a);
  }
  .info-footer {
    border-top-color: var(--setting-border, #333);
  }
  .close-btn:hover {
    background: var(--header-back-hover, #2a2a2a);
  }
  .badge.local {
    background: rgba(52, 152, 219, 0.2);
  }
  .badge.online {
    background: rgba(46, 204, 113, 0.2);
  }
}

/* ---------- 滚动条 ---------- */
.info-body::-webkit-scrollbar {
  width: 4px;
}
.info-body::-webkit-scrollbar-track {
  background: transparent;
}
.info-body::-webkit-scrollbar-thumb {
  background: var(--setting-border, #ddd);
  border-radius: 4px;
}
.info-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary, #aaa);
}
</style>
