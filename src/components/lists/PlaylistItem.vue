<template>
  <div class="playlist-item" @click="onCardClick">
    <div class="playlist-cover">
      <img v-if="playlist.coverUrl" :src="playlist.coverUrl" :alt="playlist.name" />
      <Icon v-else icon="mdi:playlist-music" :width="36" class="default-cover" />
    </div>
    <div class="playlist-info">
      <div class="playlist-name">{{ playlist.name }}</div>
      <div class="playlist-desc">{{ playlist.description || `${playlist.songCount}首歌曲` }}</div>
    </div>
    <div class="playlist-actions">
      <span class="song-count">{{ playlist.songCount }}首</span>
      <DropdownButton
        v-model:visible="dropdownVisible"
        :button-icon="'mdi:dots-vertical'"
        :size="32"
        :options="menuOptions"
        placement="bottom-end"
        :offset-y="-4"
        :dx="-40"
        :dy="-60"
        @select="onMenuItemSelect"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import type { DropdownItem, Playlist } from '@/utils/interface'

interface Props {
  playlist: Playlist
  dropdownOpen?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'click', playlist: Playlist): void
  (e: 'menuSelect', action: string, playlist: Playlist): void
  (e: 'update:dropdownOpen', value: boolean): void
}>()

const dropdownVisible = computed({
  get: () => props.dropdownOpen ?? false,
  set: (val) => emit('update:dropdownOpen', val),
})

const menuOptions: DropdownItem[] = [
  { icon: 'mdi:play', description: '播放', value: 'play' },
  { icon: 'mdi:pencil', description: '编辑', value: 'edit' },
  { icon: 'mdi:delete', description: '删除', value: 'delete' },
]

const onCardClick = () => {
  emit('click', props.playlist)
}

const onMenuItemSelect = (item: DropdownItem) => {
  emit('menuSelect', item.value as string, props.playlist)
}
</script>

<style scoped lang="scss">
.playlist-item {
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
}

.playlist-cover {
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

.playlist-info {
  flex: 1;
  min-width: 0;

  .playlist-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-desc {
    font-size: 13px;
    color: var(--text-secondary, #666);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.playlist-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;

  .song-count {
    font-size: 13px;
    color: var(--text-secondary, #666);
    font-feature-settings: 'tnum';
  }
}

.dark {
  .playlist-item {
    background-color: var(--bg-card, #1e1e1e);
    &:hover {
      background-color: var(--bg-card-hover, #2c2c2c);
    }
  }
}
</style>
