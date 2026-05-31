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
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const { t } = useI18n()
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

const menuOptions = computed<DropdownItem[]>(() => [
  { icon: 'mdi:playlist-plus', description: t('song.menu.addToPlaylist'), value: 'addToPlaylist' },
  { icon: 'mdi:heart-outline', description: t('song.menu.like'), value: 'like' },
  { icon: 'mi:next', description: t('song.menu.playNext'), value: 'next' },
  { icon: 'mdi:queue', description: t('song.menu.addToQueue'), value: 'queue' },
])

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
    toast.success(t('song.toast.addedToQueue'))
  } else if (item.value === 'like') {
    if (isInList(props.song.id, appStore.getLikeList().data)) {
      toast.warning(t('song.toast.alreadyLiked'))
      return
    }
    appStore.mergeLikeListData([props.song])
    toast.success(t('song.toast.liked'))
  } else if (item.value === 'addToPlaylist') {
    const selected = await showPlaylistSelector(
      [appStore.getLikeList(), ...appStore.getSongLists()],
      t('playlistSelector.title')
    )
    if (selected) {
      if (isInList(props.song.id, selected.data)) {
        toast.warning(t('song.toast.alreadyInPlaylist'))
        return
      }
      selected.data.push(props.song)
      appStore.setSongListById(selected.id, selected)
      toast.success(t('song.toast.addedToPlaylist', { name: selected.name }))
    }
  } else if (item.value === 'next') {
    const queue = appStore.getPlayQueue()
    queue.splice(appStore.getPlayData().currentIndex + 1, 0, props.song)
    appStore.setPlayQueue(queue)
    toast.success(t('song.toast.next', { name: props.song.title }))
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
  background-color: var(--bg-card);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  cursor: pointer;
  animation: slideInUp 0.3s ease both;

  &:hover {
    background-color: var(--bg-card-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .song-cover {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 12px;
    overflow: hidden;
    background-color: var(--bg-placeholder);
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-cover {
      color: var(--text-secondary);
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
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-artist {
      font-size: 13px;
      color: var(--text-secondary);
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
      color: var(--text-secondary);
      font-feature-settings: 'tnum';
      font-variant-numeric: tabular-nums;
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
</style>
