<template>
  <div class="song-item" @click="onCardClick">
    <div class="song-cover">
      <img v-if="song.coverUrl" :src="song.coverUrl" :alt="song.name" />
      <Icon v-else icon="mdi:music" :width="36" class="default-cover" />
    </div>

    <div class="song-info">
      <div class="song-name">{{ song.name }}</div>
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
  { icon: 'mdi:play', description: '播放', value: 'play' },
  { icon: 'mdi:playlist-plus', description: '添加到歌单', value: 'addToPlaylist' },
  { icon: 'mdi:heart-outline', description: '喜欢', value: 'like' },
  { icon: 'mdi:download', description: '下载', value: 'download' },
  { icon: 'mdi:delete', description: '删除', value: 'delete' },
]

const formatDuration = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const onCardClick = () => {
  emit('click', props.song)
}

const onMenuItemSelect = (item: DropdownItem) => {
  emit('menuSelect', item.value as string, props.song)
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
</style>
