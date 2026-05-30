<template>
  <div class="song-item" @click="onCardClick">
    <div class="song-cover">
      <img v-if="song.albumArtUri" :src="song.albumArtUri" :alt="song.title" />
      <Icon v-else icon="mdi:music" :width="36" class="default-cover" />
    </div>

    <div class="song-info">
      <div class="song-name">{{ song.title }}</div>
      <div class="song-artist">{{ song.artist }}</div>
    </div>

    <div class="song-actions">
      <span class="song-duration">{{ formatDuration(song.duration) }}</span>
      <DropdownButton
        v-model:visible="dropdownVisible"
        :button-icon="'mdi:dots-vertical'"
        :size="32"
        :options="menuOptions"
        :offset-x="0"
        :offset-y="4"
        :dx="-40"
        :dy="-60"
        placement="bottom-end"
        @select="onMenuItemSelect"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { useDropdownControl } from '@/composables/useDropdownControl'
import type { DropdownItem, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { isInList } from '@/utils/functions'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
const appStore = useAppStore()
interface Props {
  song: Song
  dropdownOpen?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'click', song: Song): void
  (e: 'menuSelect', action: string, song: Song): void
  (e: 'update:dropdownOpen', value: boolean): void
}>()

const { dropdownVisible } = useDropdownControl(props, emit)

const menuOptions: DropdownItem[] = [
  { icon: 'mdi:playlist-plus', description: '添加到歌单', value: 'addToPlaylist' },
  { icon: 'mdi:heart-outline', description: '喜欢', value: 'like' },
  { icon: 'mdi:queue', description: '添加到播放队列', value: 'queue' },
]

const formatDuration = (milliseconds: number): string => {
  if (isNaN(milliseconds) || milliseconds < 0) return '00:00'
  const totalSeconds = Math.floor(milliseconds / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const onCardClick = () => {
  emit('click', props.song)
}

const onMenuItemSelect = async (item: DropdownItem) => {
  emit('menuSelect', item.value as string, props.song)
  if (item.value === 'queue') {
    appStore.addToQueue(props.song)
    toast.success('已经将1首歌加入播放队列')
  } else if (item.value === 'like') {
    if (isInList(props.song.id, appStore.getLikeList().data)) {
      toast.warning('此歌曲已经在收藏夹里了')
      return
    }
    appStore.mergeLikeListData([props.song])
    toast.success('已经将1首歌加入喜欢')
  } else if (item.value === 'addToPlaylist') {
    const selected = await showPlaylistSelector([
      appStore.getLikeList(),
      ...appStore.getSongLists(),
    ])
    if (selected) {
      console.log('选中歌单:', selected.name)
      if (isInList(props.song.id, selected.data)) {
        toast.warning('这首歌已经在这个歌单中了')
        return
      }
      selected.data.push(props.song)
      appStore.setSongListById(selected.id, selected)
      toast.success('已经将1首歌加入 ' + selected.name)
    }
  }
}
</script>

<style scoped lang="scss">
.song-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background-color: var(--bg-card, #ffffff);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  cursor: pointer;
  animation: slideInUp 0.3s ease both;

  &:hover {
    background-color: var(--bg-card-hover, #f5f5f5);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .song-cover {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 12px;
    overflow: hidden;
    background-color: var(--bg-placeholder, #e0e0e0);
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-cover {
      color: var(--text-secondary, #888);
    }
  }

  .song-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .song-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color, #333);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-artist {
      font-size: 13px;
      color: var(--text-secondary, #666);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .song-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;

    .song-duration {
      font-size: 13px;
      color: var(--text-secondary, #666);
      font-feature-settings: 'tnum';
      font-variant-numeric: tabular-nums;
    }
  }
}

.dark {
  .song-item {
    background-color: var(--bg-card, #1e1e1e);
    &:hover {
      background-color: var(--bg-card-hover, #2c2c2c);
    }
  }
}
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dark .song-cover .default-cover {
  color: rgba(75, 73, 73, 0.6);
}
</style>
