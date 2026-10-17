<script lang="ts" setup>
import { nextTick, ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItemSelectable from '@/components/song/SongItemSelectable.vue'
import { useDropdownManager } from '@/composables/useDropdownManager'
import type { DropdownItem, Song } from '@/utils/interface.ts'
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
  operations?: DropdownItem[]
  onMenuItemSelect?: (item: DropdownItem) => void
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
    selectedIds.value = new Set([...selectedIds.value, songId])
  }
  // Force a repaint on Android WebView which can skip rendering
  // child components after a v-show toggle in a v-for list
  nextTick(() => {
    const el = document.querySelector('.song-list')
    if (el) {
      ;(el as HTMLElement).style.transform = 'translateZ(0)'
      requestAnimationFrame(() => {
        ;(el as HTMLElement).style.transform = ''
      })
    }
  })
}

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    const next = new Set(selectedIds.value)
    next.delete(id)
    selectedIds.value = next
    if (next.size === 0) {
      exitSelectMode()
    }
  } else {
    selectedIds.value = new Set([...selectedIds.value, id])
  }
}

const selectAll = () => {
  selectedIds.value = new Set(props.songs.map((s) => s.id))
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
  selectedIds.value = new Set()
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
  selectedIds.value = new Set()
  openDropdownId.value = null
}

const handleSongClick = (song: Song) => {
  if (!isSelectMode.value) {
    emit('song-click', song)
  }
}
</script>

<template>
  <div class="playlist">
    <div class="song-list">
      <SongItemSelectable
        v-for="song in songs"
        :key="song.id"
        :dropdown-open="openDropdownId === song.id"
        :on-delete="handleDeleteSong"
        :onMenuItemSelect="props.onMenuItemSelect"
        :operations="props.operations"
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

<style lang="scss" scoped>
.playlist {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 96px;
  @include custom-scrollbar(3px);
}

.song-list {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bottom-actions-bg);
  border-top: 1px solid var(--bottom-actions-border);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  animation: sheetIn var(--duration-normal) var(--ease-out-expo);
}

.actions-container {
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  padding: var(--space-2) var(--space-3);
  gap: var(--space-1);
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.action-btn {
  flex: 1 0 auto;
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-color);
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  white-space: nowrap;
  transition: background-color var(--duration-fast) ease;

  &:hover {
    background: var(--setting-hover-bg);
  }

  &:active {
    background: var(--hairline);
  }

  &.danger {
    color: var(--danger-color);
  }
}
</style>
