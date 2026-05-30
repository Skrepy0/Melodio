<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="playlist-selector-overlay" @click.self="cancel">
        <div class="playlist-selector-container">
          <div class="playlist-selector-header">
            <h3>选择歌单</h3>
            <button class="close-btn" @click="cancel">✕</button>
          </div>
          <div class="playlist-selector-list">
            <div
              v-for="playlist in playlists"
              :key="playlist.id"
              class="playlist-selector-item"
              @click="selectPlaylist(playlist)"
            >
              <PlaylistItem :playlist="playlist" :dropdown-open="false" :show-button="false" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PlaylistItem from '@/components/lists/PlaylistItem.vue'
import type { Playlist } from '@/utils/interface'

const visible = ref(false)
let resolvePromise: ((value: Playlist | null) => void) | null = null

const playlists = ref<Playlist[]>([])

const show = (list: Playlist[]): Promise<Playlist | null> => {
  playlists.value = list
  visible.value = true
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
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.playlist-selector-container {
  width: 320px;
  max-height: 80%;
  background: var(--bg-color, #fff);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.playlist-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color, #333);
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }
}

.playlist-selector-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  max-height: 400px;
}

.playlist-selector-item {
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dark {
  .playlist-selector-container {
    background: var(--bg-color, #1e1e1e);
  }
  .playlist-selector-header {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }
  .playlist-selector-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }
}
</style>
