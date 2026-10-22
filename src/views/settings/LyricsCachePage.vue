<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { IonPage, onIonViewWillEnter } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/PageTitle.vue'
import {
  listLyricCache,
  readLyricCache,
  deleteLyricCache,
  clearLyricCache,
  type LyricCacheEntry,
} from '@/utils/lyricCache'
import { showConfirm } from '@/utils/createConfirm'

const router = useRouter()
const { t } = useI18n()
const entries = ref<LyricCacheEntry[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref(false)
const previewId = ref('')
const previewText = ref('')
let generation = 0
let disposed = false
async function refresh() {
  const current = ++generation
  loading.value = true
  error.value = false
  try {
    const result = await listLyricCache()
    if (!disposed && current === generation) entries.value = result
  } catch {
    if (!disposed && current === generation) error.value = true
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}
async function preview(entry: LyricCacheEntry) {
  if (previewId.value === entry.id) {
    previewId.value = ''
    return
  }
  previewId.value = entry.id
  previewText.value = t('lyricsCache.loading')
  try {
    const text = await readLyricCache(entry.id)
    if (!disposed && previewId.value === entry.id)
      previewText.value = text || t('lyricsCache.empty')
  } catch {
    if (!disposed && previewId.value === entry.id) previewText.value = t('lyricsCache.error')
  }
}
async function remove(entry?: LyricCacheEntry) {
  if (busy.value) return
  busy.value = true
  try {
    const confirmed = await showConfirm({
      title: t(entry ? 'lyricsCache.delete' : 'lyricsCache.clear'),
      message: entry
        ? t('lyricsCache.deleteConfirm', { title: entry.title })
        : t('lyricsCache.clearConfirm'),
      confirmText: t('lyricsCache.delete'),
      cancelText: t('common.cancel'),
    })
    if (!confirmed || disposed) return
    if (entry) await deleteLyricCache(entry.id)
    else await clearLyricCache()
    previewId.value = ''
    await refresh()
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}
onMounted(refresh)
onIonViewWillEnter(() => {
  if (!busy.value) void refresh()
})
onUnmounted(() => {
  disposed = true
  generation++
})
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="() => router.back()" :title="t('lyricsCache.title')" />
      <div class="settings-content cache-content">
        <p class="cache-hint">{{ t('lyricsCache.desc') }}</p>
        <div class="cache-toolbar">
          <span>{{ t('lyricsCache.count', { count: entries.length }) }}</span>
          <div>
            <button type="button" :disabled="loading || busy" @click="refresh">
              {{ t('lyricsCache.refresh') }}
            </button>
            <button type="button" :disabled="!entries.length || loading || busy" @click="remove()">
              {{ t('lyricsCache.clear') }}
            </button>
          </div>
        </div>
        <p v-if="error" role="alert" class="cache-status">{{ t('lyricsCache.error') }}</p>
        <p v-if="loading" role="status" class="cache-status">{{ t('lyricsCache.loading') }}</p>
        <p v-else-if="!entries.length && !error" class="cache-status">
          {{ t('lyricsCache.empty') }}
        </p>
        <ul class="cache-list" :aria-busy="loading">
          <li v-for="entry in entries" :key="entry.id" class="cache-entry">
            <div class="cache-row">
              <div class="cache-identity">
                <div class="cache-title">{{ entry.title }}</div>
                <div class="cache-meta">
                  {{ entry.artist }}<template v-if="entry.album"> · {{ entry.album }}</template>
                </div>
                <div class="cache-meta">
                  {{ t('lyricsCache.lines', { count: entry.lineCount }) }}
                  <template v-if="entry.duration > 0">
                    · {{ Math.floor(entry.duration / 60000) }}:{{
                      String(Math.floor(entry.duration / 1000) % 60).padStart(2, '0')
                    }}</template
                  >
                </div>
              </div>
              <div class="cache-actions">
                <button
                  type="button"
                  class="cache-action preview-action"
                  :class="{ 'is-expanded': previewId === entry.id }"
                  :aria-expanded="previewId === entry.id"
                  :aria-label="
                    t(
                      previewId === entry.id
                        ? 'lyricsCache.collapseSong'
                        : 'lyricsCache.previewSong',
                      { title: entry.title }
                    )
                  "
                  :disabled="busy"
                  @click="preview(entry)"
                >
                  <Icon
                    :icon="previewId === entry.id ? 'mdi:chevron-up' : 'mdi:text-box-outline'"
                    :width="18"
                    aria-hidden="true"
                  />
                  <span>{{
                    t(previewId === entry.id ? 'lyricsCache.collapse' : 'lyricsCache.preview')
                  }}</span>
                </button>
                <button
                  type="button"
                  class="cache-action delete-action"
                  :disabled="busy"
                  :aria-label="t('lyricsCache.deleteSong', { title: entry.title })"
                  @click="remove(entry)"
                >
                  <Icon icon="mdi:trash-can-outline" :width="18" aria-hidden="true" />
                  <span>{{ t('lyricsCache.delete') }}</span>
                </button>
              </div>
            </div>
            <pre v-if="previewId === entry.id" class="cache-preview">{{ previewText }}</pre>
          </li>
        </ul>
      </div>
    </div>
  </ion-page>
</template>

<style scoped lang="scss">
@use '../../theme/settings.scss';
.cache-content {
  padding-inline: var(--space-4);
}
.cache-hint,
.cache-status {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
.cache-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.cache-toolbar {
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}
.cache-toolbar > div {
  display: flex;
}
button {
  min-height: 44px;
  padding: 8px;
  border: 0;
  background: transparent;
  color: var(--text-color);
  font: inherit;
  cursor: pointer;
  flex-shrink: 0;
}
button:hover {
  background: var(--bg-input);
}
button:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.cache-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.cache-entry {
  padding-block: var(--space-3);
  border-bottom: 1px solid var(--hairline);
}
.cache-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}
.cache-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.cache-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 72px;
  min-height: 44px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease;
  &:active:not(:disabled) {
    background: var(--bg-secondary);
  }
}
.preview-action {
  background: var(--bg-input);
  color: var(--text-color);
  &.is-expanded {
    color: var(--primary-color);
    background: var(--bg-secondary);
  }
}
.delete-action {
  color: var(--danger-color);
  &:hover:not(:disabled) {
    color: var(--danger-color-hover);
  }
}
@media (max-width: 360px) {
  .cache-row {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }
  .cache-actions {
    justify-content: flex-end;
  }
}
.cache-identity {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.cache-title {
  font-weight: 600;
  color: var(--text-color);
}
.cache-meta {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-top: 4px;
}
.cache-preview {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: var(--font-size-sm);
  line-height: 1.8;
  max-height: 320px;
  overflow-y: auto;
  padding: var(--space-3);
  background: var(--bg-input);
  color: var(--text-color);
}
</style>
