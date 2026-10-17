<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { audio } from '@/utils/createAudio'
import { DEFAULT_COVER, fetchCoverFromWeb, getCoverSrc, isSafeCoverSource } from '@/utils/functions'

const appStore = useAppStore()
const { t } = useI18n()

const currentSong = computed(() => appStore.currentSong)
const isPlaying = computed(() => appStore.getPlayData().isPlaying)
const currentTime = ref(appStore.getPlayData().mockCurrentTime)
const duration = computed(() =>
  currentSong.value?.duration ? currentSong.value.duration / 1000 : 0
)
const progressPercent = computed(() =>
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
)

const emit = defineEmits<{
  (e: 'expand'): void
}>()

const onExpand = () => {
  emit('expand')
}

let timeUpdateHandler: (() => void) | null = null

onMounted(() => {
  timeUpdateHandler = () => {
    currentTime.value = audio.currentTime
  }
  audio.addEventListener('timeupdate', timeUpdateHandler)
})

onUnmounted(() => {
  if (timeUpdateHandler) {
    audio.removeEventListener('timeupdate', timeUpdateHandler)
  }
})

const togglePlay = () => {
  appStore.togglePlay().catch(() => {})
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const coverSrc = ref('')
let coverAbort: AbortController | null = null
let triedWebFallback = false

const fetchWebCover = async (song: any) => {
  coverAbort?.abort()
  coverAbort = new AbortController()
  const signal = coverAbort.signal
  try {
    const url = await fetchCoverFromWeb(song.title, song.artist || '', signal)
    if (!signal.aborted) coverSrc.value = url || DEFAULT_COVER
  } catch {
    if (!signal.aborted) coverSrc.value = DEFAULT_COVER
  }
}

const resolveCover = (song: any) => {
  coverAbort?.abort()
  coverAbort = null
  triedWebFallback = false
  // Drop the previous track's artwork so it cannot flash while resolving.
  coverSrc.value = DEFAULT_COVER

  if (!song) {
    return
  }
  const local = isSafeCoverSource(song.albumArtUri) ? getCoverSrc(song.albumArtUri || '') : ''
  if (local) {
    // The embedded URI may be stale (missing MediaStore album art); the error
    // handler retries online.
    coverSrc.value = local
    return
  }
  if (!appStore.getCanFetchCoverFromWeb()) {
    coverSrc.value = DEFAULT_COVER
    return
  }
  triedWebFallback = true
  void fetchWebCover(song)
}

/** A broken local cover retries online once before falling back to the icon. */
const onCoverError = () => {
  const song = currentSong.value
  if (!song || triedWebFallback || !appStore.getCanFetchCoverFromWeb()) {
    coverSrc.value = DEFAULT_COVER
    return
  }
  triedWebFallback = true
  coverSrc.value = DEFAULT_COVER
  void fetchWebCover(song)
}

watch(currentSong, (s) => resolveCover(s), { immediate: true })

onUnmounted(() => {
  coverAbort?.abort()
})
</script>

<template>
  <div v-if="currentSong" class="now-playing-bar">
    <div class="progress-line">
      <div :style="{ width: progressPercent + '%' }" class="progress-fill-line"></div>
    </div>

    <div class="bar-content">
      <div
        :aria-label="t('player.a11y.expand')"
        class="song-info"
        role="button"
        tabindex="0"
        @click="onExpand"
        @keydown.enter="onExpand"
        @keydown.space.prevent="onExpand"
      >
        <div class="cover">
          <img
            v-if="coverSrc && coverSrc !== DEFAULT_COVER"
            :alt="currentSong.title"
            :src="coverSrc"
            @error="onCoverError"
          />
          <Icon v-else :width="20" class="cover-placeholder" icon="mdi:music-note" />
        </div>
        <div class="details">
          <div class="name">{{ currentSong.title }}</div>
          <div class="artist">{{ currentSong.artist }}</div>
        </div>
      </div>

      <div class="player-controls">
        <div class="time-info">
          <span>{{ formatTime(currentTime) }}</span>
          <span>/</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
        <div class="action-buttons">
          <button
            :aria-label="t('player.a11y.playPause')"
            class="play-pause-btn"
            type="button"
            @click="togglePlay"
          >
            <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" :width="28" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// The mini player is a strip of the page, not a floating object: same ground
// as the app, a hairline above, and a progress rule that spans the full width.
.now-playing-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-color);
  border-top: 1px solid var(--hairline);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.progress-line {
  height: 2px;
  background-color: var(--progress-track);
  width: 100%;
  overflow: hidden;
  position: relative;
}

.progress-fill-line {
  height: 100%;
  background: var(--primary-color);
  width: 0;
  transition: width 0.2s linear;
}

.bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  height: 60px;
}

.song-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-sm);
  padding: var(--space-1);
  margin: calc(var(--space-1) * -1);
  transition: background-color var(--duration-fast) ease;

  &:hover {
    background: var(--setting-hover-bg);
  }

  &:active {
    background: var(--hairline);
  }
}

.cover {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: var(--bg-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--hairline);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    color: var(--text-tertiary);
  }
}

.details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;

  .name {
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-base);
    letter-spacing: -0.005em;
    color: var(--text-color);
    @include text-ellipsis;
  }

  .artist {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    @include text-ellipsis;
  }
}

.player-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.time-info {
  display: flex;
  gap: 3px;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
  color: var(--text-tertiary);
}

.action-buttons {
  flex-shrink: 0;

  .play-pause-btn {
    @include icon-button(44px);
    // The transport control is the strip's one action, so it carries the
    // accent; the progress rule above already ties the bar to the theme.
    color: var(--primary-color);

    &:hover {
      color: var(--primary-color);
      background: var(--primary-color-light);
    }
  }
}

@media (max-width: 640px) {
  .bar-content {
    padding: var(--space-2) var(--space-3);
  }

  .cover {
    width: 40px;
    height: 40px;
  }

  .time-info {
    display: none;
  }
}
</style>
