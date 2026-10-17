<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { Playlist } from '@/utils/interface'
import { DEFAULT_COVER, fetchCoverFromWeb, getCoverSrc } from '@/utils/functions'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { trapTabKey, useDialogA11y } from '@/composables/useDialogA11y'

/** Covers are stored in localStorage, so keep the uploaded image small. */
const MAX_COVER_SIZE = 384
const JPEG_QUALITY = 0.85
/** How many songs without embedded artwork to look up online. */
const MAX_WEB_LOOKUPS = 12

const { t } = useI18n()
const appStore = useAppStore()

const visible = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const titleId = `playlist-cover-title-${Math.random().toString(36).slice(2)}`
const playlist = ref<Playlist | null>(null)
const isReading = ref(false)
const isLookingUp = ref(false)

interface CoverOption {
  raw: string
  src: string
  title: string
}

const songCovers = ref<CoverOption[]>([])
let lookupAbort: AbortController | null = null

let resolvePromise: ((value: string | null | undefined) => void) | null = null

/** undefined = cancelled, null = reset to default, string = new cover. */
const finish = (value: string | null | undefined) => {
  visible.value = false
  resolvePromise?.(value)
  resolvePromise = null
}

const cancel = () => finish(undefined)

useDialogA11y(containerRef, cancel, () => visible.value)

const show = (target: Playlist): Promise<string | null | undefined> => {
  playlist.value = target
  visible.value = true
  loadCovers(target)
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

defineExpose({ show })

/**
 * Songs in the list often show artwork that came from the web rather than from
 * the file's embedded tag, so fall back to the same lookup here instead of
 * reporting an empty playlist.
 */
async function loadCovers(target: Playlist) {
  lookupAbort?.abort()
  lookupAbort = new AbortController()
  const signal = lookupAbort.signal

  const songs = target.data ?? []
  // Playlists are stored as snapshots, so a song may carry stale metadata here.
  // Fall back to the live library entry before giving up on embedded artwork.
  const library = new Map(appStore.getAllSongs().map((song) => [song.id, song]))
  const options: CoverOption[] = []
  const seen = new Set<string>()
  const pending: { title: string; artist: string }[] = []

  for (const song of songs) {
    const uri = (song.albumArtUri || library.get(song.id)?.albumArtUri || '').trim()
    if (uri) {
      if (seen.has(uri)) continue
      seen.add(uri)
      // Keep the raw URI in storage; the local-server URL can change between runs.
      options.push({ raw: uri, src: getCoverSrc(uri), title: song.title })
    } else if (pending.length < MAX_WEB_LOOKUPS) {
      pending.push({ title: song.title, artist: song.artist || '' })
    }
  }

  songCovers.value = options
  isLookingUp.value = false

  if (pending.length === 0 || !appStore.getCanFetchCoverFromWeb()) return

  isLookingUp.value = true
  for (const song of pending) {
    if (signal.aborted) break
    try {
      const url = await fetchCoverFromWeb(song.title, song.artist, signal)
      if (signal.aborted || !url) continue
      if (seen.has(url)) continue
      seen.add(url)
      songCovers.value = [...songCovers.value, { raw: url, src: url, title: song.title }]
    } catch {
      // Offline or provider failure — keep whatever we already have.
    }
  }
  if (!signal.aborted) isLookingUp.value = false
}

onUnmounted(() => {
  lookupAbort?.abort()
  lookupAbort = null
})

const currentCover = computed(() => {
  const custom = playlist.value?.coverUrl?.trim()
  if (custom) return getCoverSrc(custom)
  return songCovers.value[0]?.src || DEFAULT_COVER
})

const hasCustomCover = computed(() => (playlist.value?.coverUrl?.trim() ?? '') !== '')

const choose = (cover: string) => finish(cover)

const resetCover = () => finish(null)

const openFilePicker = () => {
  fileInputRef.value?.click()
}

/** Downscale and re-encode so the data URL stays small enough for storage. */
const readImageAsCover = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('decode failed'))
      image.onload = () => {
        const scale = Math.min(1, MAX_COVER_SIZE / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('canvas unavailable'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error(t('playlistCover.invalidImage'))
    return
  }
  isReading.value = true
  try {
    const cover = await readImageAsCover(file)
    isReading.value = false
    finish(cover)
  } catch {
    isReading.value = false
    toast.error(t('playlistCover.readFailed'))
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="cover-picker-overlay" @click.self="cancel">
        <div
          ref="containerRef"
          :aria-labelledby="titleId"
          aria-modal="true"
          class="cover-picker-container"
          role="dialog"
          @keydown="trapTabKey($event, containerRef)"
        >
          <div class="cover-picker-header">
            <h3 :id="titleId">{{ t('playlistCover.title') }}</h3>
            <button :aria-label="t('common.close')" class="close-btn" type="button" @click="cancel">
              <Icon height="18" icon="mdi:close" width="18" />
            </button>
          </div>

          <div class="cover-picker-body">
            <div class="current-cover">
              <img :alt="t('playlistCover.current')" :src="currentCover" />
              <span>{{ t('playlistCover.current') }}</span>
            </div>

            <section class="cover-section">
              <h4>{{ t('playlistCover.fromSongs') }}</h4>
              <div v-if="songCovers.length" class="cover-grid">
                <button
                  v-for="cover in songCovers"
                  :key="cover.raw"
                  :aria-label="cover.title"
                  :title="cover.title"
                  class="cover-option"
                  type="button"
                  @click="choose(cover.raw)"
                >
                  <img :alt="cover.title" :src="cover.src" />
                </button>
              </div>
              <p v-else-if="isLookingUp" class="empty-hint">
                {{ t('playlistCover.searching') }}
              </p>
              <p v-else class="empty-hint">{{ t('playlistCover.empty') }}</p>
            </section>

            <section class="cover-section">
              <h4>{{ t('playlistCover.upload') }}</h4>
              <button
                :disabled="isReading"
                class="upload-btn"
                type="button"
                @click="openFilePicker"
              >
                <Icon :width="20" icon="mdi:image-plus" />
                <span>{{
                  isReading ? t('playlistCover.reading') : t('playlistCover.pickImage')
                }}</span>
              </button>
              <p class="upload-hint">{{ t('playlistCover.uploadHint') }}</p>
              <input
                ref="fileInputRef"
                accept="image/*"
                class="file-input"
                type="file"
                @change="onFileChange"
              />
            </section>
          </div>

          <div class="cover-picker-footer">
            <button
              v-if="hasCustomCover"
              class="footer-btn reset"
              type="button"
              @click="resetCover"
            >
              {{ t('playlistCover.reset') }}
            </button>
            <button class="footer-btn cancel" type="button" @click="cancel">
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.cover-picker-overlay {
  position: fixed;
  inset: 0;
  background-color: var(--overlay-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 20000;
  backdrop-filter: blur(4px);
}

.cover-picker-container {
  width: 340px;
  max-width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  border-radius: var(--radius-2xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  animation: scaleIn 0.2s ease;
}

.cover-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  background: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--text-color);
    letter-spacing: -0.3px;
  }

  .close-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--header-back-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
  }
}

.cover-picker-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }
}

.current-cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;

  img {
    width: 96px;
    height: 96px;
    object-fit: cover;
    border-radius: var(--radius-lg);
    background: var(--bg-placeholder);
    box-shadow: var(--elevation-1, 0 2px 8px rgba(0, 0, 0, 0.08));
  }

  span {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.cover-section {
  & + & {
    margin-top: 20px;
  }

  h4 {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }
}

.cover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  max-height: 168px;
  overflow-y: auto;
  padding: 2px;
}

.cover-option {
  padding: 0;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--bg-placeholder);
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 1;
  transition:
    border-color 0.2s,
    transform 0.2s;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover {
    transform: scale(1.04);
  }

  &:focus-visible {
    border-color: var(--primary-color);
    outline: none;
  }
}

.empty-hint,
.upload-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px dashed var(--input-border);
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--primary-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;

  &:hover {
    border-color: var(--primary-color);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.upload-hint {
  margin-top: 8px;
}

.file-input {
  display: none;
}

.cover-picker-footer {
  display: flex;
  border-top: 1px solid var(--setting-border);

  .footer-btn {
    flex: 1;
    min-height: 48px;
    padding: 12px;
    border: none;
    background: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;

    &.reset {
      color: var(--danger-color);
    }

    &.cancel {
      color: var(--text-secondary);
    }

    &:hover {
      background: var(--header-back-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: -2px;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
