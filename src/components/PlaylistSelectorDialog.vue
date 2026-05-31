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
  background: var(--bg-color);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-md);
}

.playlist-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--setting-border);
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
    &:hover {
      background: var(--header-back-hover);
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
    background: var(--setting-hover-bg);
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
</style>
