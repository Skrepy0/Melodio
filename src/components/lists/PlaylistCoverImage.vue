<script lang="ts" setup>
import { toRef } from 'vue'
import { Icon } from '@iconify/vue'
import type { Playlist } from '@/utils/interface'
import { DEFAULT_COVER } from '@/utils/functions'
import { usePlaylistCover } from '@/composables/usePlaylistCover'

interface Props {
  playlist: Playlist
  size?: number
  radius?: string
  iconSize?: number
  /** Disable the online cover lookup (e.g. for a quick picker list). */
  allowWebCover?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 48,
  radius: '12px',
  iconSize: 40,
  allowWebCover: true,
})

const { coverSrc } = usePlaylistCover(toRef(props, 'playlist'), props.allowWebCover)
</script>

<template>
  <div
    class="playlist-cover-image"
    :style="{ width: `${size}px`, height: `${size}px`, borderRadius: radius }"
  >
    <template v-if="playlist.id === 0">
      <Icon :width="iconSize" class="like-icon" icon="mdi:heart" />
    </template>
    <template v-else>
      <img
        v-if="coverSrc && coverSrc !== DEFAULT_COVER"
        :alt="playlist.name"
        :src="coverSrc"
        @error="coverSrc = DEFAULT_COVER"
      />
      <Icon v-else :width="iconSize" class="default-cover" icon="mdi:playlist-music" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.playlist-cover-image {
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-placeholder);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-cover {
    color: var(--text-tertiary);
  }

  .like-icon {
    color: var(--danger-color);
  }
}
</style>
