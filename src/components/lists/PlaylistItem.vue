<script lang="ts" setup>
import { computed, toRef } from 'vue'
import { Icon } from '@iconify/vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import type { DropdownItem, Playlist } from '@/utils/interface'
import { showPrompt } from '@/utils/createPrompt'
import toast from '@/utils/createToast'
import { useAppStore } from '@/stores/app'
import { showConfirm } from '@/utils/createConfirm'
import { useI18n } from 'vue-i18n'
import { DEFAULT_COVER } from '@/utils/functions'
import { usePlaylistCover } from '@/composables/usePlaylistCover'
import { showPlaylistCoverPicker } from '@/utils/createPlaylistCoverPicker'

const { t } = useI18n()
const appStore = useAppStore()

interface Props {
  playlist: Playlist
  dropdownOpen?: boolean
  showButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showButton: true,
})

const emit = defineEmits<{
  (e: 'click', playlist: Playlist): void
  (e: 'menuSelect', action: string, playlist: Playlist): void
  (e: 'update:dropdownOpen', value: boolean): void
}>()

const dropdownVisible = computed({
  get: () => props.dropdownOpen ?? false,
  set: (val) => emit('update:dropdownOpen', val),
})

const menuOptions = computed<DropdownItem[]>(() => [
  { icon: 'mdi:image-edit', description: t('playlist.menu.cover'), value: 'cover' },
  { icon: 'mdi:pencil', description: t('playlist.menu.edit'), value: 'edit' },
  { icon: 'mdi:delete', description: t('playlist.menu.delete'), value: 'delete' },
  { icon: 'proicons:cancel', description: t('playlist.menu.cancel'), value: 'cancel' },
])

const onCardClick = () => {
  emit('click', props.playlist)
}

const onMenuItemSelect = async (item: DropdownItem) => {
  emit('menuSelect', item.value as string, props.playlist)
  if (item.value === 'cover') {
    if (props.playlist.id === 0) {
      toast.warning(t('playlist.warning.defaultPlaylist'))
      return
    }
    const cover = await showPlaylistCoverPicker(props.playlist)
    // undefined means the picker was dismissed without a choice.
    if (cover === undefined) return
    const newList = { ...props.playlist, coverUrl: cover ?? '' }
    const index = appStore.getSongLists().findIndex((list) => list.id === newList.id)
    if (index === -1) return
    appStore.setSongListById(index + 1, newList)
    toast.success(cover ? t('playlist.success.coverUpdated') : t('playlist.success.coverReset'))
  } else if (item.value === 'edit') {
    if (props.playlist.id === 0) {
      toast.warning(t('playlist.warning.defaultPlaylist'))
      return
    }
    const name = await showPrompt({
      title: t('playlist.editPrompt.title'),
      message: t('playlist.editPrompt.message'),
      placeholder: '',
      defaultValue: props.playlist.name,
      confirmContent: t('common.confirm'),
      cancelContent: t('common.cancel'),
    })
    if (name) {
      if (name === props.playlist.name) {
        toast.warning(t('playlist.warning.sameName'))
      } else {
        const newList = { ...props.playlist, name }
        const index = appStore.getSongLists().findIndex((list) => list.id === newList.id)
        if (index === -1) return
        appStore.setSongListById(index + 1, newList)
        toast.success(t('playlist.success.renamed'))
      }
    }
  } else if (item.value === 'delete') {
    if (props.playlist.id === 0) {
      toast.warning(t('playlist.warning.defaultPlaylist'))
      return
    }
    const result = await showConfirm({
      title: t('playlist.deleteConfirm.title'),
      message: t('playlist.deleteConfirm.message', { name: props.playlist.name }),
      confirmText: t('playlist.deleteConfirm.confirm'),
      cancelText: t('playlist.deleteConfirm.cancel'),
    })
    if (result) {
      appStore.delectSongListById(props.playlist.id)
      toast.success(t('playlist.success.deleted', { name: props.playlist.name }))
    }
  }
}

const { coverSrc } = usePlaylistCover(toRef(props, 'playlist'))
</script>

<template>
  <div class="playlist-item" @click="onCardClick">
    <div class="playlist-cover">
      <template v-if="playlist.id === 0">
        <Icon :width="36" color="red" icon="si:heart-duotone" />
      </template>
      <template v-else>
        <img
          v-if="coverSrc && coverSrc !== DEFAULT_COVER"
          :alt="playlist.name"
          :src="coverSrc"
          @error="coverSrc = DEFAULT_COVER"
        />
        <Icon
          v-else
          :width="36"
          class="default-cover"
          color="var(--primary-color)"
          icon="mdi:playlist-music"
        />
      </template>
    </div>
    <div class="playlist-info">
      <div class="playlist-name">
        {{ playlist.id === 0 ? t('playList.like.title') : playlist.name }}
      </div>
      <div class="playlist-desc">
        {{
          (playlist.id === 0 ? t('playList.like.description') : playlist.description) ||
          t('playlist.defaultDesc', { count: playlist.songCount })
        }}
      </div>
    </div>
    <div class="playlist-actions">
      <span class="song-count">{{ t('playlist.songCount', { count: playlist.songCount }) }}</span>
      <DropdownButton
        v-if="props.showButton"
        v-model:visible="dropdownVisible"
        :button-icon="'mdi:dots-vertical'"
        :dx="-40"
        :dy="-60"
        :label="t('common.more')"
        :options="menuOptions"
        :size="32"
        placement="bottom-end"
        @select="onMenuItemSelect"
        @click.stop
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.playlist-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  @include card-base;
  cursor: pointer;
  animation: slideInUp 0.35s var(--ease-out-expo) both;
}

.playlist-cover {
  @include cover-thumbnail(var(--radius-md), 56px);

  .default-cover {
    color: var(--text-secondary);
  }
}

.playlist-info {
  flex: 1;
  min-width: 0;

  .playlist-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
    @include text-ellipsis;
  }

  .playlist-desc {
    font-size: 13px;
    color: var(--text-secondary);
    @include text-ellipsis;
  }
}

.playlist-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;

  .song-count {
    font-size: 13px;
    color: var(--text-secondary);
    font-feature-settings: 'tnum';
  }
}
</style>
