<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import router from '@/router'
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { DropdownItem, Playlist, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import PlayList from '@/components/PlayList.vue'
import toast from '@/utils/createToast'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import { showConfirm } from '@/utils/createConfirm'
import { useI18n } from 'vue-i18n'
import { audio } from '@/utils/createAudio'
import { getAccessibleUrl, getNativeCoverUrl } from '@/utils/functions'
import SearchBox from '@/components/SearchBox.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import PlaylistCoverImage from '@/components/lists/PlaylistCoverImage.vue'
import { useSongSearch } from '@/utils/search'
import { showPrompt } from '@/utils/createPrompt'
import { showPlaylistCoverPicker } from '@/utils/createPlaylistCoverPicker'

const { t } = useI18n()
const appStore = useAppStore()

const songsList = ref<Song[]>([])
const showSongsList = ref<Song[]>([])
const keyword = ref('')
const title = ref<string>(t('songList.defaultTitle'))
const isLoading = ref(false)

const isSearchMode = ref(false)

const operations = computed<DropdownItem[]>(() => [
  { icon: 'mdi:image-edit', description: t('playlist.menu.cover'), value: 'cover' },
  { icon: 'material-symbols:sort', description: t('songList.operations.sort'), value: 'sort' },
  { icon: 'mdi:pencil', description: t('songList.operations.edit_name'), value: 'edit_name' },
  { icon: 'mdi:delete', description: t('songList.operations.delete_all'), value: 'delete_all' },
])

/** The playlist this page is showing, kept reactive so a new cover shows at once. */
const currentPlaylist = computed<Playlist | null>(() => {
  const index = appStore.getCurrentPlayListIndex()
  if (index === 0) return appStore.getLikeList()
  return appStore.getSongLists()[index - 1] ?? null
})

const synchroShowSongsList = () => {
  showSongsList.value = songsList.value
}

if (appStore.getCurrentPlayListIndex() === 0) {
  const likeList = appStore.getLikeList()
  songsList.value = likeList.data
  synchroShowSongsList()
  title.value = t('playList.like.title')
} else {
  const list: Playlist = appStore.getSongLists()[appStore.getCurrentPlayListIndex() - 1]
  songsList.value = list.data
  synchroShowSongsList()
  title.value = list.name
}

const saveSongList = () => {
  const index = appStore.getCurrentPlayListIndex()
  if (index === 0) {
    appStore.setLikeListData(songsList.value)
  } else {
    appStore.setSongListDataById(index, songsList.value)
  }
}

const goBack = () => router.back()
const showFullPlayer = () => router.push('/player-view')

/** Play the whole visible list from the top. */
const playAll = async () => {
  if (showSongsList.value.length === 0) return
  const first = showSongsList.value[0]
  // Tapping play-all on the track that is already loaded should resume it,
  // not restart the queue.
  if (
    appStore.currentSong?.id === first.id &&
    appStore.getPlayQueue().length === songsList.value.length
  ) {
    if (!appStore.getPlayData().isPlaying) await appStore.togglePlay()
    return
  }
  await playSong(first)
}

const handleBatchDelete = async (ids: string[]) => {
  const result = await showConfirm({
    title: t('songList.confirm.title'),
    message: t('songList.confirm.message', { count: ids.length }),
    confirmText: t('songList.confirm.confirm'),
    cancelText: t('songList.confirm.cancel'),
  })
  if (!result) return
  const list: Song[] = []
  songsList.value.forEach((item) => {
    if (!ids.includes(item.id)) list.push(item)
  })
  songsList.value = list
  synchroShowSongsList()
  saveSongList()
  toast.success(t('songList.toast.removeSuccess', { count: ids.length }))
}

const removeSongFromPlaylist = async (song: Song) => {
  const result = await showConfirm({
    title: t('songList.confirm.title'),
    message: t('songList.confirm.message', { count: 1 }),
    confirmText: t('songList.confirm.confirm'),
    cancelText: t('songList.confirm.cancel'),
  })
  if (!result) return
  songsList.value = songsList.value.filter((item) => item.id !== song.id)
  synchroShowSongsList()
  saveSongList()
  toast.success(t('songList.toast.removeSuccess', { count: 1 }))
}

const playSong = async (song: Song) => {
  if (songsList.value.length === 0) return
  const index = songsList.value.findIndex((s) => s.id === song.id)
  if (index === -1) {
    toast.error(t('songList.toast.songNotFound'))
    return
  }
  const playData = appStore.getPlayData()
  const currentIndex = playData.currentIndex
  const currentQueue = appStore.getPlayQueue()
  if (
    index === currentIndex &&
    currentQueue.length > 0 &&
    currentQueue[currentIndex]?.id === song.id // 同一首歌
  ) {
    appStore.togglePlay()
    return // 暂停播放
  }
  // 不是同一首
  if (playData.isPlaying) {
    appStore.togglePlay() // 先暂停
  }
  // 设置队列信息
  appStore.setIsSwitchingSong(true)
  appStore.setPlayQueue([...songsList.value])
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)
  try {
    const queue = appStore.getPlayQueue()
    await audio.setPlaylist(
      queue.map((s) => ({
        url: getAccessibleUrl(s.uri),
        title: s.title,
        artist: s.artist || 'Unknown',
        album: s.album || '',
        coverUrl: getNativeCoverUrl(s, appStore.getCanFetchCoverFromWeb()),
      }))
    )
    await appStore.playIndex(index)
    appStore.setIsPlaying(true)
  } catch (error) {
    console.error('播放失败:', error)
    toast.error(t('common.playFailed'))
  } finally {
    // Playback state is owned by the native songChanged listener; toggling it
    // here raced with that listener and produced an audible pause/play blip.
    appStore.setIsSwitchingSong(false)
  }
}

const onSelectOperation = async (item: DropdownItem) => {
  if (item.value === 'cover') {
    const index = appStore.getCurrentPlayListIndex()
    if (index === 0) {
      toast.warning(t('playlist.warning.defaultPlaylist'))
      return
    }
    const list = currentPlaylist.value
    if (!list) return
    const cover = await showPlaylistCoverPicker(list)
    if (cover === undefined) return
    const newList = { ...list, coverUrl: cover ?? '' }
    appStore.setSongListById(index, newList)
    toast.success(cover ? t('playlist.success.coverUpdated') : t('playlist.success.coverReset'))
  } else if (item.value === 'edit_name') {
    const index = appStore.getCurrentPlayListIndex()
    if (index === 0) {
      toast.warning(t('playlist.warning.defaultPlaylist'))
      return
    }
    const name = await showPrompt({
      title: t('playlist.editPrompt.title'),
      message: t('playlist.editPrompt.message'),
      placeholder: '',
      defaultValue: title.value,
      confirmContent: t('common.confirm'),
      cancelContent: t('common.cancel'),
    })
    if (name) {
      if (name === title.value) {
        toast.warning(t('playlist.warning.sameName'))
      } else {
        const newList = appStore.getSongLists()[index - 1]
        newList.name = name
        appStore.setSongListById(newList.id, newList)
        toast.success(t('playlist.success.renamed'))
        title.value = name
      }
    }
  } else if (item.value === 'delete_all') {
    const result = await showConfirm({
      title: t('songList.deleteAllSongs.title'),
      message: t('songList.deleteAllSongs.message', { name: title.value }),
      confirmText: t('songList.deleteAllSongs.confirm'),
      cancelText: t('songList.deleteAllSongs.cancel'),
    })
    if (result) {
      if (songsList.value.length !== 0) {
        const index = appStore.getCurrentPlayListIndex()
        songsList.value = []
        synchroShowSongsList()
        if (index === 0) {
          appStore.setLikeListData(songsList.value)
        } else {
          appStore.setSongListDataById(index, songsList.value)
        }
        toast.success(t('songList.deleteAllSongs.result.success'))
      } else {
        toast.warning(t('songList.deleteAllSongs.result.emptyList'))
      }
    }
  } else if (item.value === 'sort') {
    appStore.setToBeSortedSongListIndex(appStore.getCurrentPlayListIndex())
    router.push('/sort-song')
  }
}

const enterSearchMode = () => {
  isSearchMode.value = true
  keyword.value = ''
}

const exitSearchMode = () => {
  isSearchMode.value = false
  keyword.value = ''
  synchroShowSongsList()
}

const onSearch = () => {
  if (!isSearchMode.value) return
  if (keyword.value.trim() === '') {
    synchroShowSongsList()
  } else {
    const result = useSongSearch(keyword, songsList, appStore.getPinyinSearch())
    showSongsList.value = result.value
  }
}
</script>

<template>
  <ion-page>
    <div class="song-list-page">
      <div class="page-top">
        <div class="nav-row">
          <button :aria-label="$t('common.back')" class="nav-back" type="button" @click="goBack">
            <Icon :width="24" icon="mdi:chevron-left" />
          </button>

          <Transition mode="out-in" name="fade">
            <div v-if="!isSearchMode" key="normal" class="nav-actions">
              <button
                :aria-label="$t('common.search')"
                class="nav-action"
                type="button"
                @click="enterSearchMode"
              >
                <Icon :width="22" icon="mdi:magnify" />
              </button>
              <DropdownButton
                :dx="-100"
                :label="$t('common.more')"
                :options="operations"
                :size="40"
                button-icon="mdi:dots-horizontal"
                @select="onSelectOperation"
              />
            </div>

            <div v-else key="search" class="search-mode">
              <SearchBox
                v-model="keyword"
                :clearable="true"
                :placeholder="$t('home.searchPlaceholder')"
                autofocus
                class="search-input-field"
                size="small"
                @search="onSearch"
              />
              <button
                :aria-label="$t('common.close')"
                class="nav-action"
                type="button"
                @click="exitSearchMode"
              >
                <Icon :width="22" icon="mdi:close" />
              </button>
            </div>
          </Transition>
        </div>

        <div class="identity">
          <PlaylistCoverImage
            v-if="currentPlaylist"
            :icon-size="40"
            :playlist="currentPlaylist"
            :size="96"
            radius="var(--radius-md)"
          />
          <div class="identity-text">
            <h1 class="title">{{ title }}</h1>
            <p class="subtitle">{{ $t('playlist.songCount', { count: songsList.length }) }}</p>
          </div>
        </div>

        <div class="play-row">
          <button class="play-all" type="button" @click="playAll">
            <Icon :width="18" icon="mdi:play" />
            <span>{{ $t('home.a11y.playAll') }}</span>
          </button>
        </div>
      </div>

      <div class="content-body">
        <div v-if="isLoading" class="loading-state">
          <Icon :width="24" class="loading-icon" icon="mdi:loading" />
          <span>{{ $t('songList.loading') }}</span>
        </div>
        <div v-else-if="songsList.length === 0" class="empty-state">
          <Icon :width="32" class="empty-icon" icon="mdi:music-note-off-outline" />
          <p>{{ $t('songList.empty') }}</p>
        </div>
        <div v-else-if="showSongsList.length === 0" class="empty-state">
          <Icon :width="32" class="empty-icon" icon="mdi:magnify-close" />
          <p>{{ $t('songList.notFound') }}</p>
        </div>
        <PlayList
          v-else
          :songs="showSongsList"
          @batch-delete="handleBatchDelete"
          @song-click="playSong"
          @delete-song="removeSongFromPlaylist"
        />
      </div>

      <NowPlayingBar @expand="showFullPlayer" />
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.song-list-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

// A playlist opens as a page, not a toolbar: navigation sits above a large
// cover + title pair, and the list scrolls beneath them.
.page-top {
  flex-shrink: 0;
  padding-top: env(safe-area-inset-top, 0px);
  background-color: var(--bg-color);
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0 var(--space-2);
  gap: var(--space-2);
}

.nav-back {
  @include icon-button(40px);
  color: var(--text-color);

  &:hover {
    color: var(--text-color);
  }
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.nav-action {
  @include icon-button(40px);
  color: var(--text-color);

  &:hover {
    color: var(--text-color);
  }
}

.search-mode {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.search-input-field {
  flex: 1;
  min-width: 0;
}

.identity {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4) var(--space-4);
}

.identity-text {
  flex: 1;
  min-width: 0;
  padding-bottom: var(--space-1);
}

.title {
  margin: 0 0 var(--space-1);
  font-size: 28px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.play-row {
  padding: 0 var(--space-4) var(--space-3);
}

.play-all {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 9px 20px 9px 16px;
  border: none;
  border-radius: var(--radius-pill);
  background-color: var(--primary-color);
  color: var(--on-primary-color);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    opacity var(--duration-fast) ease,
    transform var(--duration-fast) ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.97);
  }
}

.content-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  @include custom-scrollbar(3px);
}

.loading-state,
.empty-state {
  @include empty-state;
}

.loading-state {
  flex-direction: row;
  gap: var(--space-2);
}

.empty-icon {
  color: var(--text-tertiary);
  opacity: 0.7;
}

.empty-state p {
  margin: 0;
}

.fade-leave-active {
  transition: opacity var(--duration-fast) ease;
}

.fade-enter-active {
  transition: opacity var(--duration-normal) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
