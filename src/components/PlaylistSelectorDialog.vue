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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
  backdrop-filter: blur(4px);
}

.playlist-selector-container {
  width: 320px;
  max-height: 80%;
  background: var(--bg-color);
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 20px 35px -8px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(0, 0, 0, 0.02);
}

.playlist-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  background: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    letter-spacing: -0.3px;
  }
  .close-btn {
    background: rgba(0, 0, 0, 0.05);
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--text-secondary);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
    &:hover {
      background: rgba(0, 0, 0, 0.1);
      transform: scale(1.02);
    }
  }
}

.playlist-selector-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }
}

.playlist-selector-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s;
  &:hover,
  &:focus-visible {
    background: var(--setting-hover-bg);
    transform: translateX(4px);
    outline: none;
  }
}

.playlist-info {
  flex: 1;
  min-width: 0;
  .playlist-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .playlist-desc {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
