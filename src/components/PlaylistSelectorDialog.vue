<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="playlist-selector-overlay" @click.self="cancel">
        <div class="playlist-selector-container">
          <div class="playlist-selector-header">
            <h3>{{ props.title }}</h3>
            <button class="close-btn" @click="cancel">✕</button>
          </div>
          <div class="playlist-selector-list">
            <div
              v-for="playlist in playlists"
              :key="playlist.id"
              class="playlist-selector-item"
              @click="selectPlaylist(playlist)"
            >
              <div class="playlist-cover">
                <template v-if="playlist.id === 0">
                  <Icon icon="mdi:heart" :width="40" color="red" />
                </template>
                <template v-else>
                  <img
                    v-if="getCover(playlist) && getCover(playlist) !== DEFAULT_COVER"
                    :src="getCover(playlist)"
                    :alt="playlist.name"
                  />
                  <Icon v-else icon="mdi:playlist-music" :width="40" class="default-cover" />
                </template>
              </div>
              <div class="playlist-info">
                <div class="playlist-name">
                  {{ playlist.id === 0 ? props.likeListName : playlist.name }}
                </div>
                <div class="playlist-desc">
                  {{
                    playlist.id === 0
                      ? props.likeListDescription
                      : playlist.description || `${playlist.songCount}首歌曲`
                  }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { Playlist } from '@/utils/interface'
import { fetchCoverFromWeb, DEFAULT_COVER } from '@/utils/functions'

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

const visible = ref(false)
let resolvePromise: ((value: Playlist | null) => void) | null = null
const playlists = ref<Playlist[]>([])
const coverCache = ref<Record<number, string>>({})

const show = (list: Playlist[]): Promise<Playlist | null> => {
  playlists.value = list
  visible.value = true
  list.forEach((p) => loadCover(p))
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

async function loadCover(playlist: Playlist) {
  if (playlist.id === 0) return
  const songs = playlist.data ?? []
  for (const song of songs) {
    if (song.albumArtUri && song.albumArtUri.trim() !== '') {
      coverCache.value[playlist.id] = song.albumArtUri
      return
    }
  }
  if (songs.length > 0) {
    const firstSong = songs[0]
    try {
      const webCover = await fetchCoverFromWeb(firstSong.title, firstSong.artist || '')
      if (webCover) {
        coverCache.value[playlist.id] = webCover
        return
      }
    } catch (e) {
      console.warn('联网获取封面失败', e)
    }
  }
  coverCache.value[playlist.id] = DEFAULT_COVER
}

function getCover(playlist: Playlist): string {
  return coverCache.value[playlist.id] || ''
}

watch(
  () => playlists.value,
  (newList) => {
    newList.forEach((p) => loadCover(p))
  },
  { deep: true }
)

defineExpose({ show })
</script>

<style scoped lang="scss">
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
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: var(--setting-hover-bg);
    transform: translateX(4px);
  }
}

.playlist-cover {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--bg-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .default-cover {
    color: var(--text-secondary);
    opacity: 0.7;
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
