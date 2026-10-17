<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { Playlist } from '@/utils/interface'
import {
  DEFAULT_COVER,
  fetchCoverFromWeb,
  getCoverBase64,
  getCoverSrc,
  isPersistableCoverSource,
  isSafeCoverSource,
} from '@/utils/functions'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { trapTabKey, useDialogA11y } from '@/composables/useDialogA11y'

/** Covers are stored in localStorage, so keep the uploaded image small. */
const MAX_COVER_SIZE = 384
const JPEG_QUALITY = 0.85
/** Concurrent provider requests; the queue itself is unbounded. */
const WEB_CONCURRENCY = 4

const { t } = useI18n()
const appStore = useAppStore()

const visible = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const titleId = `playlist-cover-title-${Math.random().toString(36).slice(2)}`
const playlist = ref<Playlist | null>(null)
const isReading = ref(false)
const currentCoverFailed = ref(false)

interface CoverRow {
  key: string
  title: string
  artist: string
  /** Reference that would be persisted if this row is picked. */
  raw: string
  /** URL for the thumbnail. */
  src: string
  state: 'local' | 'pending' | 'web' | 'none'
}

const songRows = ref<CoverRow[]>([])
let lookupAbort: AbortController | null = null

// Web-lookup queue. Songs are processed in small concurrent batches; entries
// that already ran (or failed) are remembered so a broken thumbnail cannot loop.
interface LookupEntry {
  row: CoverRow
  title: string
  artist: string
}

let lookupQueue: LookupEntry[] = []
/** The controller whose drain loop is currently running. */
let activeDrain: AbortController | null = null
const attempted = new Set<string>()
const queued = new Set<string>()
const lookupKey = (title: string, artist: string) =>
  `${title.trim().toLowerCase()}\u0000${artist.trim().toLowerCase()}`

const remainingCount = computed(
  () => songRows.value.filter((row) => row.state === 'pending').length
)

let resolvePromise: ((value: string | null | undefined) => void) | null = null

/** undefined = cancelled, null = reset to default, string = new cover. */
const finish = (value: string | null | undefined) => {
  // Closing the dialog must also stop any in-flight provider requests.
  lookupAbort?.abort()
  lookupAbort = null
  lookupQueue = []
  activeDrain = null
  visible.value = false
  resolvePromise?.(value)
  resolvePromise = null
}

const cancel = () => finish(undefined)

useDialogA11y(containerRef, cancel, () => visible.value)

const show = (target: Playlist): Promise<string | null | undefined> => {
  playlist.value = target
  currentCoverFailed.value = false
  visible.value = true
  loadCovers(target)
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

defineExpose({ show })

/**
 * Build one row per song, in playlist order. Songs that share artwork are
 * intentionally kept as separate rows so the whole playlist is visible; the
 * same cover can be picked from any of them.
 */
function loadCovers(target: Playlist) {
  lookupAbort?.abort()
  lookupAbort = new AbortController()

  lookupQueue = []
  activeDrain = null
  attempted.clear()
  queued.clear()

  const songs = target.data ?? []
  // Playlists are stored as snapshots, so a song may carry stale metadata here.
  // Fall back to the live library entry before giving up on embedded artwork.
  const library = new Map(appStore.getAllSongs().map((song) => [song.id, song]))
  const rows: CoverRow[] = []
  const pending: LookupEntry[] = []

  for (const [index, song] of songs.entries()) {
    const uri = (song.albumArtUri || library.get(song.id)?.albumArtUri || '').trim()
    const artist = song.artist || ''
    const row: CoverRow = {
      key: `${song.id}-${index}`,
      title: song.title,
      artist,
      raw: '',
      src: DEFAULT_COVER,
      state: 'none',
    }

    if (uri && isSafeCoverSource(uri)) {
      row.raw = uri
      row.src = getCoverSrc(uri)
      row.state = 'local'
    } else if (appStore.getCanFetchCoverFromWeb()) {
      row.state = 'pending'
      pending.push({ row, title: song.title, artist })
    }

    rows.push(row)
  }

  songRows.value = rows
  enqueueLookups(pending)
}

/**
 * Queue songs for a web lookup. Every song without artwork is eligible — the
 * queue is drained in small concurrent batches, so a large playlist is not
 * silently truncated.
 */
function enqueueLookups(entries: LookupEntry[]) {
  if (!appStore.getCanFetchCoverFromWeb() || !lookupAbort) return
  for (const entry of entries) {
    const key = lookupKey(entry.title, entry.artist)
    if (attempted.has(key) || queued.has(key)) continue
    queued.add(key)
    lookupQueue.push(entry)
  }
  void drainLookups()
}

async function drainLookups() {
  const controller = lookupAbort
  if (!controller || controller.signal.aborted || activeDrain === controller) return
  activeDrain = controller

  try {
    while (lookupQueue.length > 0 && !controller.signal.aborted) {
      const batch = lookupQueue.splice(0, WEB_CONCURRENCY)
      if (activeDrain !== controller) return
      await Promise.all(
        batch.map(async (entry) => {
          const key = lookupKey(entry.title, entry.artist)
          queued.delete(key)
          attempted.add(key)
          if (controller.signal.aborted) return
          try {
            const url = await fetchCoverFromWeb(entry.title, entry.artist, controller.signal)
            if (controller.signal.aborted) return
            if (url && isSafeCoverSource(url)) {
              entry.row.raw = url
              entry.row.src = url
              entry.row.state = 'web'
            } else {
              entry.row.state = 'none'
            }
          } catch {
            // Offline or provider failure — the placeholder stays.
            entry.row.state = 'none'
          }
        })
      )
    }
  } finally {
    // A newer dialog open may already own the drain; leave its state alone.
    if (activeDrain === controller) {
      activeDrain = null
      // Songs may have been enqueued while the last batch was finishing.
      if (lookupQueue.length > 0 && lookupAbort === controller && !controller.signal.aborted) {
        void drainLookups()
      }
    }
  }
}

/**
 * A thumbnail failed to decode (a MediaStore album-art URI can point at a
 * missing entry). Replace it with a web lookup; if that also fails the row
 * shows the default icon.
 */
function onRowError(row: CoverRow) {
  if (row.state === 'local') {
    if (currentCoverFailed.value === false && (playlist.value?.coverUrl || '').trim() === row.raw) {
      currentCoverFailed.value = true
    }
    row.raw = ''
    row.src = DEFAULT_COVER
  }
  const key = lookupKey(row.title, row.artist)
  // A failed web result (or one already attempted) must not be retried, or the
  // row would sit in "pending" forever.
  if (!appStore.getCanFetchCoverFromWeb() || !lookupAbort || attempted.has(key)) {
    row.state = 'none'
    return
  }
  row.state = 'pending'
  enqueueLookups([{ row, title: row.title, artist: row.artist }])
}

/**
 * Persist only references that stay valid: https URLs and image data URIs.
 * A `content://` album-art URI can disappear, so local covers are inlined as a
 * data URL first; anything else is rejected.
 */
const chooseRow = async (row: CoverRow) => {
  const cover = row.raw
  if (!cover || !isSafeCoverSource(cover)) return
  if (isPersistableCoverSource(cover)) {
    finish(cover)
    return
  }
  isReading.value = true
  const inline = await getCoverBase64(cover)
  isReading.value = false
  if (isPersistableCoverSource(inline)) {
    finish(inline)
  } else {
    toast.error(t('playlistCover.readFailed'))
  }
}

onUnmounted(() => {
  lookupAbort?.abort()
  lookupAbort = null
})

const currentCover = computed(() => {
  if (currentCoverFailed.value) return DEFAULT_COVER
  const custom = playlist.value?.coverUrl?.trim()
  // A persisted value from an older version (or a tampered store) may carry a
  // disallowed scheme; never hand that to the browser.
  if (custom && isSafeCoverSource(custom)) return getCoverSrc(custom)
  return songRows.value.find((row) => row.raw)?.src || DEFAULT_COVER
})

// Keep the reset action available whenever a stored value exists, even if that
// value is no longer considered safe to render.
const hasCustomCover = computed(() => (playlist.value?.coverUrl?.trim() ?? '') !== '')

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
              <img
                :alt="t('playlistCover.current')"
                :src="currentCover"
                loading="lazy"
                @error="currentCoverFailed = true"
              />
              <span>{{ t('playlistCover.current') }}</span>
            </div>

            <section class="cover-section">
              <h4>{{ t('playlistCover.fromSongs') }}</h4>
              <ul v-if="songRows.length" class="song-cover-list">
                <li
                  v-for="row in songRows"
                  :key="row.key"
                  :class="{ 'is-pending': row.state === 'pending' }"
                >
                  <button
                    :aria-label="row.title"
                    :disabled="!row.raw"
                    class="song-cover-row"
                    type="button"
                    @click="chooseRow(row)"
                  >
                    <img :alt="row.title" :src="row.src" loading="lazy" @error="onRowError(row)" />
                    <span class="song-cover-meta">
                      <span class="song-cover-title">{{ row.title }}</span>
                      <span class="song-cover-artist">
                        {{
                          row.state === 'pending'
                            ? t('playlistCover.searching')
                            : row.state === 'none'
                              ? t('playlistCover.noCover')
                              : row.artist
                        }}
                      </span>
                    </span>
                    <Icon
                      v-if="row.state === 'local' || row.state === 'web'"
                      class="song-cover-pick"
                      icon="mdi:check-circle-outline"
                      width="18"
                    />
                  </button>
                </li>
              </ul>
              <div v-else class="empty-cover">
                <img :alt="t('playlistCover.empty')" :src="DEFAULT_COVER" loading="lazy" />
                <p class="empty-hint">{{ t('playlistCover.empty') }}</p>
              </div>
              <p v-if="remainingCount > 0" class="lookup-hint">
                {{ t('playlistCover.remaining', { count: remainingCount }) }}
              </p>
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

.song-cover-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  li + li {
    margin-top: 4px;
  }
}

.song-cover-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-color);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;

  img {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    background: var(--bg-placeholder);
  }

  &:hover:not(:disabled) {
    background: var(--setting-hover-bg);
  }

  &:focus-visible {
    border-color: var(--primary-color);
    outline: none;
  }

  &:disabled {
    cursor: default;
    opacity: 0.65;
  }
}

.song-cover-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-cover-title {
  font-size: 13px;
  font-weight: 500;
  @include text-ellipsis;
}

.song-cover-artist {
  font-size: 11px;
  color: var(--text-secondary);
  @include text-ellipsis;
}

.song-cover-pick {
  flex-shrink: 0;
  color: var(--primary-color);
}

.empty-hint,
.upload-hint,
.lookup-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.empty-cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  img {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: var(--radius-md);
    background: var(--bg-placeholder);
    opacity: 0.7;
  }
}

.lookup-hint {
  margin-top: 8px;
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
