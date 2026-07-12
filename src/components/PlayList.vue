<template>
  <div class="playlist">
    <div class="song-list">
      <SongItemSelectable
        v-for="song in songs"
        :key="song.id"
        :dropdown-open="openDropdownId === song.id"
        :on-delete="handleDeleteSong"
        :selectable="isSelectMode"
        :selected="selectedIds.has(song.id)"
        :show-operations="props.showOperations"
        :song="song"
        @click="handleSongClick"
        @long-press="enterSelectMode"
        @toggle-select="toggleSelect(song.id)"
        @update:dropdown-open="(open) => handleDropdownToggle(song.id, open)"
      />
    </div>

    <Transition name="slide-up">
      <div v-if="isSelectMode" class="bottom-actions">
        <div class="actions-container">
          <button v-if="props.visibility.selectAll" class="action-btn" @click="selectAll">
            <Icon :width="20" icon="mdi:select-all" />
            <span>{{ $t('playList.selectAll') }}</span>
          </button>
          <button v-if="props.visibility.clear" class="action-btn" @click="clearSelection">
            <Icon :width="20" icon="mdi:select-off" />
            <span>{{ $t('playList.clear') }}</span>
          </button>
          <button v-if="props.visibility.addToQueue" class="action-btn" @click="addToQueue">
            <Icon :width="20" icon="ic:baseline-queue" />
            <span>{{ $t('playList.addToQueue') }}</span>
          </button>
          <button v-if="props.visibility.addToPlaylist" class="action-btn" @click="addToSongList">
            <Icon :width="20" icon="mdi:heart-outline" />
            <span>{{ $t('playList.addToPlaylist') }}</span>
          </button>
          <button v-if="props.visibility.delete" class="action-btn danger" @click="batchDelete">
            <Icon :width="20" icon="mdi:delete" />
            <span>{{ $t('playList.delete', { count: selectedIds.size }) }}</span>
          </button>
          <button v-if="props.visibility.ban" class="action-btn" @click="addToBlacklist">
            <Icon :width="20" icon="tabler:ban" />
            <span>{{ $t('playList.addToBlacklist', { count: selectedIds.size }) }}</span>
          </button>
          <button v-if="props.visibility.close" class="action-btn" @click="exitSelectMode">
            <Icon :width="20" icon="mdi:close" />
            <span>{{ $t('playList.cancel') }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItemSelectable from '@/components/song/SongItemSelectable.vue'
import { useDropdownManager } from '@/composables/useDropdownManager'
import type { Song } from '@/utils/interface.ts'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { isInList } from '@/utils/functions'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appStore = useAppStore()

interface Props {
  songs: Song[]
  showOperations?: boolean
  visibility?: {
    selectAll?: boolean
    clear?: boolean
    addToQueue?: boolean
    addToPlaylist?: boolean
    delete?: boolean
    ban?: boolean
    close?: boolean
  }
}

const props = withDefaults(defineProps<Props>(), {
  showOperations: true,
  visibility: () => ({
    selectAll: true,
    clear: true,
    addToQueue: true,
    addToPlaylist: true,
    delete: true,
    ban: true,
    close: true,
  }),
})

const emit = defineEmits<{
  (e: 'batch-delete', songIds: string[]): void
  (e: 'song-click', song: Song): void
  (e: 'delete-song', song: Song): void
  (e: 'add-to-blacklist', songIds: string[]): void
}>()

const isSelectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const { openDropdownId, handleDropdownToggle } = useDropdownManager()

const enterSelectMode = (songId?: string) => {
  if (isSelectMode.value) return
  isSelectMode.value = true
  if (songId !== undefined) {
    selectedIds.value.add(songId)
  }
}

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
    if (selectedIds.value.size === 0) {
      exitSelectMode()
    }
  } else {
    selectedIds.value.add(id)
  }
}

const selectAll = () => {
  props.songs.forEach((song) => {
    selectedIds.value.add(song.id)
  })
}

const addToQueue = () => {
  const queue = appStore.getPlayQueue()
  const newSongs: Song[] = []
  props.songs.forEach((song) => {
    if (selectedIds.value.has(song.id) && !isInList(song.id, queue)) {
      newSongs.push(song)
    }
  })
  if (newSongs.length > 0) {
    appStore.addListToQueue(newSongs)
    toast.success(t('playList.toast.addedToQueue', { count: newSongs.length }))
  } else {
    toast.warning(t('playList.toast.alreadyInQueue'))
  }
  exitSelectMode()
}

const addToSongList = async () => {
  const selected = await showPlaylistSelector(
    [appStore.getLikeList(), ...appStore.getSongLists()],
    t('playlistSelector.title'),
    t('playList.like.title'),
    t('playList.like.description')
  )
  if (selected) {
    if (selected.id === 0) {
      const likeList = appStore.getLikeList().data
      const newSongs: Song[] = []
      props.songs.forEach((song) => {
        if (selectedIds.value.has(song.id) && !isInList(song.id, likeList)) {
          newSongs.push(song)
        }
      })
      if (newSongs.length > 0) {
        appStore.mergeLikeListData(newSongs)
        toast.success(
          t('playList.toast.addedToPlaylist', {
            count: newSongs.length,
            name: selected.id === 0 ? t('playList.like.title') : selected.name,
          })
        )
      } else {
        toast.warning(t('playList.toast.alreadyInLike'))
      }
    } else {
      const list: Song[] = []
      props.songs.forEach((song) => {
        if (selectedIds.value.has(song.id) && !isInList(song.id, selected.data)) {
          list.push(song)
        }
      })
      if (list.length > 0) {
        appStore.setSongListDataById(selected.id, [...selected.data, ...list])
        toast.success(
          t('playList.toast.addedToPlaylist', { count: list.length, name: selected.name })
        )
      } else {
        toast.warning(t('playList.toast.alreadyInPlaylist'))
      }
    }
  }
  exitSelectMode()
}

const clearSelection = () => {
  selectedIds.value.clear()
  exitSelectMode()
}

const batchDelete = () => {
  if (selectedIds.value.size === 0) return
  emit('batch-delete', Array.from(selectedIds.value))
  exitSelectMode()
}
const addToBlacklist = () => {
  if (selectedIds.value.size === 0) return
  emit('add-to-blacklist', Array.from(selectedIds.value))
  exitSelectMode()
}
const handleDeleteSong = (song: Song) => {
  emit('delete-song', song)
}
const exitSelectMode = () => {
  isSelectMode.value = false
  selectedIds.value.clear()
  openDropdownId.value = null
}

const handleSongClick = (song: Song) => {
  if (!isSelectMode.value) {
    emit('song-click', song)
  }
}
</script>

<style lang="scss" scoped>
.playlist {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 80px;
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bottom-actions-bg, #ffffff);
  border-top: 1px solid var(--bottom-actions-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 -2px 10px var(--bottom-actions-shadow, rgba(0, 0, 0, 0.1));
  z-index: 200;
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bottom-actions-bg-rgb, 255, 255, 255), 0.9);
}

.actions-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  white-space: nowrap;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
    &:hover {
      background: var(--scrollbar-thumb-hover);
    }
  }
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-color);
  cursor: pointer;
  transition: opacity 0.2s;
  padding: 8px;

  &:hover {
    opacity: 0.7;
  }

  &.danger {
    color: var(--danger-color, #ff4444);
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

// 暗色模式专用（全局 .dark 类下覆盖）
.dark .bottom-actions {
  background: var(--bottom-actions-bg);
  background-color: rgba(var(--bottom-actions-bg-rgb, 30, 30, 35), 0.9);
  border-top-color: var(--bottom-actions-border);
}

.dark .action-btn {
  color: var(--text-color);
}

.dark .action-btn.danger {
  color: var(--danger-color-hover, #ff6b6b);
}

.dark .action-btn:hover {
  opacity: 0.8;
}
</style>
