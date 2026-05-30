<template>
  <div class="playlist">
    <div class="song-list">
      <SongItemSelectable
        v-for="song in songs"
        :key="song.id"
        :song="song"
        :selectable="isSelectMode"
        :selected="selectedIds.has(song.id)"
        :dropdown-open="openDropdownId === song.id"
        @long-press="enterSelectMode"
        @toggle-select="toggleSelect(song.id)"
        @click="handleSongClick"
        @update:dropdown-open="(open) => handleDropdownToggle(song.id, open)"
      />
    </div>

    <Transition name="slide-up">
      <div v-if="isSelectMode" class="bottom-actions">
        <div class="actions-container">
          <button class="action-btn" @click="selectAll">
            <Icon icon="mdi:select-all" :width="20" />
            <span>全选</span>
          </button>
          <button class="action-btn" @click="clearSelection">
            <Icon icon="mdi:select-off" :width="20" />
            <span>清空</span>
          </button>
          <button class="action-btn" @click="addToQueue">
            <Icon icon="ic:baseline-queue" :width="20" />
            <span>添加到队列</span>
          </button>
          <button class="action-btn" @click="addToSongList">
            <Icon icon="mdi:heart-outline" :width="20" />
            <span>添加到歌单</span>
          </button>
          <button class="action-btn danger" @click="batchDelete">
            <Icon icon="mdi:delete" :width="20" />
            <span>删除({{ selectedIds.size }})</span>
          </button>
          <button class="action-btn" @click="exitSelectMode">
            <Icon icon="mdi:close" :width="20" />
            <span>取消</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import SongItemSelectable from '@/components/song/SongItemSelectable.vue'
import { useDropdownManager } from '@/composables/useDropdownManager'
import type { Song } from '@/utils/interface.ts'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { isInList } from '@/utils/functions'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
const appStore = useAppStore()
interface Props {
  songs: Song[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'batch-delete', songIds: string[]): void
  (e: 'song-click', song: Song): void
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
    toast.success(`已添加 ${newSongs.length} 首歌至队列`)
  } else {
    toast.warning('所选歌曲已在队列中')
  }
  exitSelectMode()
}
const addToSongList = async () => {
  const selected = await showPlaylistSelector([appStore.getLikeList(), ...appStore.getSongLists()])
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
        toast.success(`已添加 ${newSongs.length} 首歌曲至"${selected.name}"`)
      } else {
        toast.warning('所选歌曲已在喜欢歌单中')
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
        toast.success(`已添加 ${list.length} 首歌曲至"${selected.name}"`)
      } else {
        toast.warning('所选歌曲已在此歌单中')
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

<style scoped lang="scss">
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
  background: var(--bg-color, #ffffff);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 200;
  backdrop-filter: blur(10px);
  background-color: rgba(var(--bg-color-rgb, 255, 255, 255), 0.9);
}

.actions-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-color, #333);
  cursor: pointer;
  transition: opacity 0.2s;
  padding: 8px;

  &:hover {
    opacity: 0.7;
  }

  &.danger {
    color: #ff4444;
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
.dark .bottom-actions {
  background: var(--bg-color, #1e1e1e);
  background-color: rgba(var(--bg-color-rgb, 30, 30, 35), 0.9);
  border-top-color: rgba(255, 255, 255, 0.1);
}

.dark .action-btn {
  color: var(--text-color, #e0e0e0);
}

.dark .action-btn.danger {
  color: #ff6b6b;
}

.dark .action-btn:hover {
  opacity: 0.8;
}
</style>
