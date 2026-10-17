<script lang="ts" setup>
import { OnlineSong, Song } from '@/utils/interface'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { trapTabKey, useDialogA11y } from '@/composables/useDialogA11y'

interface Props {
  song: Song | OnlineSong
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

const visible = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const titleId = `info-title-${Math.random().toString(36).slice(2)}`

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
  resolvePromise?.(true)
}

const { focusFirst } = useDialogA11y(containerRef, handleClose, () => visible.value)

const show = (): Promise<boolean> => {
  visible.value = true
  lockBodyScroll()
  nextTick(focusFirst)
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
  return date.toLocaleDateString(locale.value, {
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
    <div
      v-if="visible"
      class="info-overlay"
      @click.self="handleClose"
      @keydown="trapTabKey($event, containerRef)"
    >
      <div
        ref="containerRef"
        :aria-labelledby="titleId"
        aria-modal="true"
        class="info-card"
        role="dialog"
        @click.stop
      >
        <!-- 头部 -->
        <div class="info-header">
          <span :id="titleId" class="info-title">{{ t('infoDialog.title') }}</span>
          <button class="close-btn" type="button" @click="handleClose">
            {{ t('infoDialog.close') }}
          </button>
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
          <button class="footer-btn" type="button" @click="handleClose">
            {{ t('infoDialog.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.info-overlay {
  @include dialog-overlay;
}

.info-card {
  @include dialog-container(380px);
  max-width: calc(100vw - 48px);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-5) var(--space-3);
  border-bottom: 1px solid var(--hairline);
  flex-shrink: 0;
}

.info-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
  color: var(--text-color);
}

.close-btn {
  padding: 4px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;

  &:hover {
    background: var(--header-back-hover);
    color: var(--text-color);
  }
}

.info-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) var(--space-5);
  @include custom-scrollbar(3px);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  position: relative;

  & + &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--hairline);
    transform: scaleY(0.5);
  }
}

.info-label {
  flex: 0 0 68px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  padding-top: 1px;
}

.info-value {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-base);
  color: var(--text-color);
  word-break: break-word;
  line-height: var(--line-height-normal);
}

.info-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-3) var(--space-5) var(--space-4);
  border-top: 1px solid var(--hairline);
  flex-shrink: 0;
}

.footer-btn {
  padding: 8px 24px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--primary-color);
  color: var(--on-primary-color);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: opacity var(--duration-fast) ease;

  &:active {
    opacity: 0.82;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
