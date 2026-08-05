<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { useDropdownControl } from '@/composables/useDropdownControl'
import type { DropdownItem, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import toast from '@/utils/createToast'
import { DEFAULT_COVER, fetchCoverFromWeb, getAccessibleUrl, isInList } from '@/utils/functions'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
import { useI18n } from 'vue-i18n'
import { computed, onUnmounted, ref, watch } from 'vue'
import { audio } from '@/utils/createAudio'

const { t } = useI18n()
const appStore = useAppStore()

interface Props {
  song: Song
  dropdownOpen?: boolean
  showOperations?: boolean
  onDelete: (song: Song) => void
  operations?: DropdownItem[]
  onMenuItemSelect?: (item: DropdownItem) => void
}

const defaultOnMenuItemSelect = async (item: DropdownItem) => {
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
      t('playlistSelector.title'),
      t('playList.like.title'),
      t('playList.like.description')
    )
    if (selected) {
      if (isInList(props.song.id, selected.data)) {
        toast.warning(t('song.toast.alreadyInPlaylist'))
        return
      }
      selected.data.push(props.song)
      appStore.setSongListById(selected.id, selected)
      toast.success(
        t('song.toast.addedToPlaylist', {
          name: selected.id === 0 ? t('playList.like.title') : selected.name,
        })
      )
    }
  } else if (item.value === 'next') {
    const queue = [...appStore.getPlayQueue()]
    const currentIndex = appStore.getPlayData().currentIndex
    if (queue.length === 0 || currentIndex < 0) {
      queue.push(props.song)
    } else {
      queue.splice(currentIndex + 1, 0, props.song)
    }
    appStore.setPlayQueue(queue)
    toast.success(t('song.toast.next', { name: props.song.title }))
  } else if (item.value === 'delete') {
    if (props.onDelete) {
      props.onDelete(props.song)
    }
  } else if (item.value === 'play') {
    if (appStore.getIsSwitchingSong()) return

    appStore.setIsSwitchingSong(true)
    try {
      const queue = [...appStore.getPlayQueue()]
      const currentIndex = appStore.getPlayData().currentIndex
      let targetIndex: number

      if (queue.length === 0 || currentIndex < 0) {
        queue.push(props.song)
        targetIndex = queue.length - 1
      } else {
        const insertPos = currentIndex + 1
        queue.splice(insertPos, 0, props.song)
        targetIndex = insertPos
      }

      appStore.setPlayQueue(queue)
      appStore.setCurrentIndex(targetIndex)
      appStore.setMockCurrentTime(0)

      await audio.setPlaylist(
        queue.map((s) => ({
          url: getAccessibleUrl(s.uri),
          title: s.title,
          artist: s.artist || 'Unknown',
          album: s.album || '',
          coverUrl: s.albumArtUri || '',
        }))
      )

      await audio.playIndex(targetIndex)
      // songChanged event from native updates isPlaying and currentIndex
    } catch (e) {
      toast.error(t('common.playFailed'))
    } finally {
      appStore.setIsSwitchingSong(false)
    }
  }
}

const props = withDefaults(defineProps<Props>(), {
  showOperations: true,
})

const emit = defineEmits<{
  (e: 'click', song: Song): void
  (e: 'menuSelect', action: string, song: Song): void
  (e: 'update:dropdownOpen', value: boolean): void
}>()

const { dropdownVisible } = useDropdownControl(props, emit)

const coverSrc = ref<string>('')
const isCoverLoading = ref(false)
let abortController: AbortController | null = null

async function resolveCover() {
  if (
    (props.song.albumArtUri && props.song.albumArtUri.trim() !== '') ||
    !appStore.getCanFetchCoverFromWeb()
  ) {
    coverSrc.value = props.song.albumArtUri
    return
  }

  isCoverLoading.value = true
  abortController = new AbortController()
  try {
    const url = await fetchCoverFromWeb(props.song.title, props.song.artist || '')
    coverSrc.value = url || DEFAULT_COVER
  } catch {
    coverSrc.value = DEFAULT_COVER
  } finally {
    isCoverLoading.value = false
  }
}

watch(
  () => props.song,
  () => resolveCover(),
  { immediate: true }
)

onUnmounted(() => {
  abortController?.abort()
})

const menuOptions = computed<DropdownItem[]>(() => {
  if (props.operations) {
    return props.operations
  }
  return [
    { icon: 'mdi:play', description: t('song.menu.play'), value: 'play' },
    {
      icon: 'mdi:playlist-plus',
      description: t('song.menu.addToPlaylist'),
      value: 'addToPlaylist',
    },
    { icon: 'mdi:heart-outline', description: t('song.menu.like'), value: 'like' },
    { icon: 'mi:next', description: t('song.menu.playNext'), value: 'next' },
    { icon: 'mdi:queue', description: t('song.menu.addToQueue'), value: 'queue' },
    { icon: 'mdi:delete', description: t('song.menu.delete'), value: 'delete' },
    { icon: 'proicons:cancel', description: t('song.menu.cancel'), value: 'cancel' },
  ]
})

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

const onMenuItemSelect = computed(() => {
  if (props.onMenuItemSelect) {
    return props.onMenuItemSelect
  }
  return defaultOnMenuItemSelect
})
</script>

<template>
  <div class="song-item" @click="onCardClick">
    <div class="song-cover">
      <img
        v-if="coverSrc && coverSrc !== DEFAULT_COVER && !isCoverLoading"
        :alt="song.title"
        :src="coverSrc"
        @error="coverSrc = DEFAULT_COVER"
      />
      <Icon
        v-else
        :width="36"
        class="default-cover"
        icon="mdi:music"
        color="var(--primary-color)"
      />
    </div>

    <div class="song-info">
      <div class="song-name">{{ song.title }}</div>
      <div class="song-artist">{{ song.artist }}</div>
    </div>

    <div class="song-actions">
      <span class="song-duration">{{ formatDuration(song.duration) }}</span>
      <DropdownButton
        v-if="props.showOperations"
        v-model:visible="dropdownVisible"
        :button-icon="'mdi:dots-vertical'"
        :dx="-40"
        :dy="-60"
        :offset-x="0"
        :offset-y="4"
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
.song-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  @include card-base;
  cursor: pointer;
  animation: slideInUp 0.35s var(--ease-out-expo) both;

  .song-cover {
    @include cover-thumbnail(var(--radius-md), 56px);
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
      @include text-ellipsis;
    }

    .song-artist {
      font-size: 13px;
      color: var(--text-secondary);
      @include text-ellipsis;
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
</style>
