<template>
  <div class="playlist-item" @click="onCardClick">
    <div class="playlist-cover">
      <template v-if="playlist.id === 0">
        <Icon icon="si:heart-duotone" :width="36" color="red" />
      </template>
      <template v-else>
        <img v-if="coverSrc && coverSrc !== DEFAULT_COVER" :src="coverSrc" :alt="playlist.name" />
        <Icon v-else icon="mdi:playlist-music" :width="36" class="default-cover" />
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
import { ref, watch, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { computed } from 'vue'
import type { DropdownItem, Playlist } from '@/utils/interface'
import { showPrompt } from '@/utils/createPrompt'
import toast from '@/utils/createToast'
import { useAppStore } from '@/stores/app'
import { showConfirm } from '@/utils/createConfirm'
import { useI18n } from 'vue-i18n'
import { fetchCoverFromWeb, DEFAULT_COVER } from '@/utils/functions'

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
  { icon: 'mdi:pencil', description: t('playlist.menu.edit'), value: 'edit' },
  { icon: 'mdi:delete', description: t('playlist.menu.delete'), value: 'delete' },
  { icon: 'proicons:cancel', description: t('playlist.menu.cancel'), value: 'cancel' },
])

const onCardClick = () => {
  emit('click', props.playlist)
}

const onMenuItemSelect = async (item: DropdownItem) => {
  emit('menuSelect', item.value as string, props.playlist)
  if (item.value === 'edit') {
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
        appStore.setSongListById(newList.id, newList)
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

const coverSrc = ref<string>('')

const resolveCover = async () => {
  if (props.playlist.id === 0) {
    coverSrc.value = ''
    return
  }
  if (appStore.getCanFetchCoverFromWeb()) {
    const songs = props.playlist.data ?? []
    for (const song of songs) {
      if (song.albumArtUri && song.albumArtUri.trim() !== '') {
        coverSrc.value = song.albumArtUri
        return
      }
    }

    if (songs.length > 0) {
      const firstSong = songs[0]
      const webCover = await fetchCoverFromWeb(firstSong.title, firstSong.artist || '')
      if (webCover) {
        coverSrc.value = webCover
        return
      }
    }
  }
  coverSrc.value = DEFAULT_COVER
}

watch(
  () => props.playlist,
  () => {
    resolveCover()
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  resolveCover()
})
</script>

<style scoped lang="scss">
.playlist-item {
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
}

.playlist-cover {
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

.playlist-info {
  flex: 1;
  min-width: 0;

  .playlist-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-desc {
    font-size: 13px;
    color: var(--text-secondary);
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
    color: var(--text-secondary);
    font-feature-settings: 'tnum';
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
