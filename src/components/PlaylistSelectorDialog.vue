<script lang="ts" setup>
import { nextTick, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { Playlist } from '@/utils/interface'
import PlaylistCoverImage from '@/components/lists/PlaylistCoverImage.vue'
import { trapTabKey, useDialogA11y } from '@/composables/useDialogA11y'

const props = withDefaults(
  defineProps<{
    title: string
    likeListName: string
    likeListDescription: string
  }>(),
  {
    title: '',
    likeListName: '',
    likeListDescription: '',
  }
)

const { t } = useI18n()

const visible = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const titleId = `playlist-selector-title-${Math.random().toString(36).slice(2)}`
let resolvePromise: ((value: Playlist | null) => void) | null = null
const playlists = ref<Playlist[]>([])

const { focusFirst } = useDialogA11y(
  containerRef,
  () => cancel(),
  () => visible.value
)

const show = (list: Playlist[]): Promise<Playlist | null> => {
  playlists.value = list
  visible.value = true
  nextTick(focusFirst)
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const selectPlaylist = (playlist: Playlist) => {
  visible.value = false
  if (resolvePromise) resolvePromise(playlist)
  resolvePromise = null
}

const cancel = () => {
  visible.value = false
  if (resolvePromise) resolvePromise(null)
  resolvePromise = null
}

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="playlist-selector-overlay"
        @click.self="cancel"
        @keydown="trapTabKey($event, containerRef)"
      >
        <div
          ref="containerRef"
          :aria-labelledby="titleId"
          aria-modal="true"
          class="playlist-selector-container"
          role="dialog"
        >
          <div class="playlist-selector-header">
            <h3 :id="titleId">{{ props.title }}</h3>
            <button
              :aria-label="t('playlistSelector.close')"
              class="close-btn"
              type="button"
              @click="cancel"
            >
              <Icon height="18" icon="mdi:close" width="18" />
            </button>
          </div>
          <div class="playlist-selector-list">
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="playlist-selector-item"
              type="button"
              @click="selectPlaylist(playlist)"
            >
              <PlaylistCoverImage :playlist="playlist" :icon-size="40" :size="48" radius="12px" />
              <div class="playlist-info">
                <div class="playlist-name">
                  {{ playlist.id === 0 ? props.likeListName : playlist.name }}
                </div>
                <div class="playlist-desc">
                  {{
                    playlist.id === 0
                      ? props.likeListDescription
                      : playlist.description ||
                        t('playlistSelector.songCount', { count: playlist.songCount })
                  }}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.playlist-selector-overlay {
  @include dialog-overlay(20000);
}

.playlist-selector-container {
  @include dialog-container(340px);
  max-width: calc(100vw - 48px);
  max-height: 72vh;
  display: flex;
  flex-direction: column;
}

.playlist-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4) var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--hairline);
  flex-shrink: 0;

  h3 {
    margin: 0;
    @include text-ellipsis;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    letter-spacing: -0.01em;
    color: var(--text-color);
  }

  .close-btn {
    @include icon-button(32px);
    flex-shrink: 0;
  }
}

.playlist-selector-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-1) 0 var(--space-2);
  @include custom-scrollbar(3px);
}

.playlist-selector-item {
  @include list-row;
  min-height: 60px;

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }
}

.playlist-info {
  flex: 1;
  min-width: 0;

  .playlist-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-color);
    @include text-ellipsis;
  }

  .playlist-desc {
    margin-top: 1px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    @include text-ellipsis;
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
