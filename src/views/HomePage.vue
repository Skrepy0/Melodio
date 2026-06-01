<template>
  <ion-page v-if="appStore.isI18nReady">
    <div class="header">
      <div class="search-box-container">
        <SearchBox
          v-model="keyword"
          autofocus
          @search="onSearch"
          size="small"
          :clearable="false"
          :placeholder="$t('home.searchPlaceholder')"
        />
      </div>
      <div class="button-container">
        <CircleButton icon="stash:play-duotone" :size="36" @click="playShownSongs" />
        <DropdownButton
          button-icon="mingcute:more-2-line"
          :size="36"
          :options="operations"
          @select="onSelectOperation"
          :dx="-100"
        />
      </div>
    </div>
    <div class="body">
      <div class="select-container">
        <HorizontalSelect
          v-model="selectedCategory"
          :options="categoryOptions"
          icon-size="18"
          @select="onCategorySelect"
        />
      </div>
      <PlayList
        v-if="selectedCategory === 'tracks'"
        :songs="showSongsList"
        @batch-delete="handleBatchDelete"
        @song-click="playSong"
        @delete-song="removeSongFromPlaylist"
      />
      <PlaylistsList
        v-else-if="selectedCategory === 'play-lists'"
        :playlists="showPlaylists"
        @batch-delete="handleBatchDeletePlaylists"
        @playlist-click="onPlaylistClick"
        @menu-select="onPlaylistMenuSelect"
      />
      <NowPlayingBar auto-play @expand="showFullPlayer" />
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage } from '@ionic/vue'
import SearchBox from '@/components/SearchBox.vue'
import CircleButton from '@/components/button/CircleButton.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import HorizontalSelect from '@/components/HorizontalSelect.vue'
import PlayList from '@/components/PlayList.vue'
import PlaylistsList from '@/components/PlaylistsList.vue'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import toast from '@/utils/createToast'
import { useRouter } from 'vue-router'
import { DropdownItem, HorizontalSelectOption, Playlist, Song } from '@/utils/interface'
import { computed, onMounted, ref, watch } from 'vue'
import { scanAllAudio } from '@/utils/audioScanner'
import { useAppStore } from '@/stores/app'
import { showPrompt } from '@/utils/createPrompt'
import { showConfirm } from '@/utils/createConfirm'
import { usePlaylistSearchEnhanced, useSongSearch } from '@/utils/search'
import { checkPlayableUrl, getAccessibleUrl, isInList } from '@/utils/functions'
import { useI18n } from 'vue-i18n'
import { audio } from '@/utils/createAudio'

const { t } = useI18n()
const appStore = useAppStore()
const router = useRouter()
const keyword = ref('')

const playShownSongs = async () => {
  if (showSongsList.value.length === 0) return

  appStore.setPlayQueue(showSongsList.value)
  appStore.setCurrentIndex(0)
  appStore.setMockCurrentTime(0)
  await audio.setPlaylist(
    showSongsList.value.map((s) => ({
      url: getAccessibleUrl(s.uri),
      title: s.title,
      artist: s.artist || 'Unknown',
      album: s.album || '',
      coverUrl: s.albumArtUri || '',
    }))
  )
  await audio.playIndex(0)
  appStore.setIsPlaying(true)
}

const operations = computed<DropdownItem[]>(() => [
  {
    icon: 'ic:baseline-plus',
    description: t('home.operations.newPlaylist'),
    value: 'new-songs-list',
  },
  { icon: 'ri:scan-2-line', description: t('home.operations.scanLibrary'), value: 'scan-songs' },
  { icon: 'ri:settings-line', description: t('home.operations.settings'), value: 'settings' },
])

const selectedCategory = ref(appStore.getSelectedCategory())

const categoryOptions = computed<HorizontalSelectOption[]>(() => [
  { value: 'tracks', label: t('home.categories.tracks'), icon: 'streamline:music-folder-song' },
  { value: 'play-lists', label: t('home.categories.playlists'), icon: 'tabler:playlist' },
])

const onCategorySelect = (option: HorizontalSelectOption) => {
  console.log('选中选项:', option)
}
console.log('AllSongs:' + appStore.getAllSongs().length)

onMounted(async () => {
  if (!appStore.getAutoDelInvalidSongs()) return
  const result = await Promise.all(
    songsList.value.map(async (song) => {
      const exists = await checkPlayableUrl(getAccessibleUrl(song.uri))
      return { song, exists }
    })
  )
  const validSongs = result.filter((item) => item.exists).map((item) => item.song)
  const invalidSongs = result.filter((item) => !item.exists).map((item) => item.song)

  if (invalidSongs.length !== 0) {
    songsList.value = validSongs
    showSongsList.value = validSongs
    appStore.setAllSongs(validSongs)
    const likeList = appStore.getLikeList().data
    appStore.setLikeListData(likeList.filter((song) => !isInList(song.id, invalidSongs)))
    const songLists = appStore.getSongLists()
    for (const list of songLists) {
      list.data = list.data.filter((song) => !isInList(song.id, invalidSongs))
    }
    appStore.setSongLists(songLists)
    let queue = appStore.getPlayQueue()
    queue = queue.filter((song) => !isInList(song.id, invalidSongs))
    appStore.setPlayQueue(queue)
    toast.warning(t('home.toast.invalidSongsCleaned', { count: invalidSongs.length }))
  }
})

const songsList = ref<Song[]>(appStore.getAllSongs())
const showSongsList = ref<Song[]>(songsList.value)

const synchroShowSongsList = () => {
  showSongsList.value = songsList.value
}

const loadAllSongs = async () => {
  const result = await scanAllAudio()
  if (result.success) {
    songsList.value = result.songs
    synchroShowSongsList()
    toast.success(t('home.toast.scanSuccess', { count: result.songs.length }))
    appStore.setAllSongs(songsList.value)
    selectedCategory.value = 'tracks'
  } else {
    toast.error(t('home.toast.scanFailed'))
  }
}

const onSearch = () => {
  if (appStore.getSelectedCategory() === 'tracks') {
    if (keyword.value === '') {
      synchroShowSongsList()
      return
    }
    const result = useSongSearch(keyword, songsList, appStore.getPinyinSearch())
    showSongsList.value = result.value
  } else if (appStore.getSelectedCategory() === 'play-lists') {
    if (keyword.value === '') {
      synchroShowPlaylists()
      return
    }
    const result = usePlaylistSearchEnhanced(keyword, playlists, appStore.getPinyinSearch())
    showPlaylists.value = result.value
  }
}

const handleBatchDelete = async (ids: string[]) => {
  const result = await showConfirm({
    title: t('home.batchDeleteConfirm.title'),
    message: t('home.batchDeleteConfirm.message', { count: ids.length }),
    confirmText: t('home.batchDeleteConfirm.confirm'),
    cancelText: t('home.batchDeleteConfirm.cancel'),
  })
  if (!result) return
  const list: Song[] = []
  songsList.value.forEach((item) => {
    if (!ids.includes(item.id)) list.push(item)
  })
  songsList.value = list
  synchroShowSongsList()
  appStore.setAllSongs(songsList.value)
  toast.success(t('home.toast.deleteSongsSuccess', { count: ids.length }))
}
const removeSongFromPlaylist = async (song: Song) => {
  const result = await showConfirm({
    title: t('songList.confirm.title'),
    message: t('songList.confirm.message', { count: 1 }),
    confirmText: t('songList.confirm.confirm'),
    cancelText: t('songList.confirm.cancel'),
  })
  if (!result) return
  const newList = songsList.value.filter((item) => item.id !== song.id)
  showSongsList.value = newList
  songsList.value = newList
  appStore.setAllSongs(newList)
  toast.success(t('songList.toast.removeSuccess', { count: 1 }))
}
const playSong = async (song: Song) => {
  if (songsList.value.length === 0) return

  const index = songsList.value.findIndex((s) => s.id === song.id)
  if (index === -1) {
    toast.error(t('home.toast.songNotFound'))
    return
  }

  appStore.setPlayQueue(songsList.value)
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)

  await audio.setPlaylist(
    songsList.value.map((s) => ({
      url: getAccessibleUrl(s.uri),
      title: s.title,
      artist: s.artist || 'Unknown',
      album: s.album || '',
      coverUrl: s.albumArtUri || '',
    }))
  )

  await audio.playIndex(index)
  appStore.setIsPlaying(true)

  appStore.setIsSwitchingSong(true)
  setTimeout(() => {
    appStore.setIsSwitchingSong(false)
  }, 100)
}

const showFullPlayer = () => {
  router.push('/player-view')
}

const playlists = ref<Playlist[]>([appStore.getLikeList(), ...appStore.getSongLists()])
const showPlaylists = ref<Playlist[]>(playlists.value)

const synchroShowPlaylists = () => {
  showPlaylists.value = playlists.value
}

const onSelectOperation = async (item: DropdownItem) => {
  console.log('选中:', item.description, item.value)
  if (item.value === 'settings') router.push('/settings')
  else if (item.value === 'scan-songs') loadAllSongs()
  else if (item.value === 'new-songs-list') {
    const name = await showPrompt({
      title: t('home.newPlaylistPrompt.title'),
      message: t('home.newPlaylistPrompt.message'),
      placeholder: '',
      defaultValue: t('home.newPlaylistPrompt.default'),
      confirmContent: t('common.confirm'),
      cancelContent: t('common.cancel'),
    })
    if (name) {
      const data = {
        id: appStore.getSongLists().length + 1,
        name: name,
        description: '',
        coverUrl: '',
        songCount: 0,
        data: [],
      }
      appStore.addSongList(data)
      playlists.value.push(data)
      synchroShowPlaylists()
      selectedCategory.value = 'play-lists'
      appStore.setSelectedCategory('play-lists')
    } else {
      console.log('用户取消')
    }
  }
}

const handleBatchDeletePlaylists = async (ids: number[]) => {
  console.log('删除播放列表IDs:', ids)
  if (ids.includes(0)) {
    toast.warning(t('home.playlistDefault.cannotDeleteDefault'))
    return
  }
  const result = await showConfirm({
    title: t('home.deletePlaylistConfirm.title'),
    message: t('home.deletePlaylistConfirm.message', { count: ids.length }),
    confirmText: t('home.deletePlaylistConfirm.confirm'),
    cancelText: t('home.deletePlaylistConfirm.cancel'),
  })
  if (!result) return
  ids.forEach((id) => appStore.delectSongListById(id))
  toast.success(t('home.toast.deletePlaylistsSuccess', { count: ids.length }))
}

const onPlaylistClick = (playlist: Playlist) => {
  console.log('点击播放列表:', playlist)
  appStore.setCurrentPlayListIndex(playlist.id)
  router.push('/song-list')
}

const onPlaylistMenuSelect = (action: any, playlist: Playlist) => {
  console.log('对播放列表操作:', action, playlist)
}

watch(
  () => [appStore.getLikeList(), ...appStore.getSongLists()],
  (newVal) => {
    playlists.value = newVal
    synchroShowPlaylists()
  },
  { deep: true, immediate: true }
)

watch(selectedCategory, () => {
  appStore.setSelectedCategory(selectedCategory.value)
})
</script>
<style scoped lang="scss">
.header {
  height: 64px;
  width: 100%;
  background: rgba(var(--bg-header-rgb), 0.8);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 16px;
  border-bottom: 1px solid var(--header-border-bottom);
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-box-container {
  flex: 1;
  max-width: 500px;
  min-width: 200px;
}

.button-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .header {
    padding: 0 12px;
    gap: 12px;
  }
  .search-box-container {
    flex: 1;
  }
  .button-container {
    gap: 8px;
  }
}
.body {
  flex: 1;
  height: 100%;
  width: 100%;
  overflow-y: auto;
  background-color: var(--bg-color);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-color) transparent;

  &::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--webkit-scrollbar-thumb);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--webkit-scrollbar-thumb-hover);
  }
}
</style>
