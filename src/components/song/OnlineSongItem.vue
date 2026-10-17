<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import { useDropdownControl } from '@/composables/useDropdownControl'
import type { DropdownItem, OnlineSong, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import { DEFAULT_COVER, fetchCoverFromWeb } from '@/utils/functions'
import { computed, onUnmounted, ref, watch } from 'vue'

const appStore = useAppStore()

interface Props {
  song: OnlineSong
  dropdownOpen?: boolean
  showOperations?: boolean
  operations: DropdownItem[]
  onMenuItemSelect: (item: DropdownItem) => void
}

const props = withDefaults(defineProps<Props>(), {
  showOperations: true,
})

const emit = defineEmits<{
  (e: 'click', song: OnlineSong): void
  (e: 'menuSelect', action: string, song: Song): void
  (e: 'update:dropdownOpen', value: boolean): void
}>()

const { dropdownVisible } = useDropdownControl(props, emit)

const coverSrc = ref<string>('')
const isCoverLoading = ref(false)
let abortController: AbortController | null = null

async function resolveCover() {
  if (
    (props.song.cover_url && props.song.cover_url.trim() !== '') ||
    !appStore.getCanFetchCoverFromWeb()
  ) {
    coverSrc.value = props.song.cover_url || DEFAULT_COVER
    return
  }

  isCoverLoading.value = true
  abortController?.abort()
  abortController = new AbortController()
  const controller = abortController
  try {
    const url = await fetchCoverFromWeb(
      props.song.name,
      props.song.singers || '',
      controller.signal
    )
    if (!controller.signal.aborted) coverSrc.value = url || DEFAULT_COVER
  } catch {
    if (!controller.signal.aborted) coverSrc.value = DEFAULT_COVER
  } finally {
    if (!controller.signal.aborted) isCoverLoading.value = false
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

const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const totalSeconds = Math.floor(seconds)
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
  return () => {}
})
</script>

<template>
  <div class="song-item" @click="onCardClick">
    <div class="song-cover">
      <img
        v-if="coverSrc && coverSrc !== DEFAULT_COVER && !isCoverLoading"
        :alt="song.name"
        :src="coverSrc"
        @error="coverSrc = DEFAULT_COVER"
      />
      <Icon v-else :width="20" class="default-cover" icon="mdi:music-note" />
    </div>

    <div class="song-info">
      <div class="song-name">{{ song.name }}</div>
      <div class="song-artist">{{ song.singers }}</div>
    </div>

    <div class="song-actions">
      <span class="song-duration">{{ formatDuration(song.duration) }}</span>
      <DropdownButton
        v-if="props.showOperations"
        v-model:visible="dropdownVisible"
        :button-icon="'mdi:dots-vertical'"
        :dx="-40"
        :dy="-60"
        :label="$t('common.more')"
        :options="props.operations"
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
  @include list-row;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;

  .song-cover {
    @include cover-thumbnail(var(--radius-sm), 44px);

    .default-cover {
      color: var(--text-tertiary);
    }
  }

  .song-info {
    @include media-info;

    .song-name {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      letter-spacing: -0.005em;
      color: var(--text-color);
      @include text-ellipsis;
    }

    .song-artist {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      @include text-ellipsis;
    }
  }

  .song-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);

    .song-duration {
      font-size: var(--font-size-sm);
      color: var(--text-tertiary);
      font-variant-numeric: tabular-nums;
      font-feature-settings: 'tnum';
      margin-right: var(--space-1);
    }
  }
}
</style>
