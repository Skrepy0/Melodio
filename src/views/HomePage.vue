<template>
  <ion-page>
    <div class="header">
      <div class="search-box-container">
        <SearchBox v-model="keyword" autofocus @search="onSearch" size="small" :clearable="false" />
      </div>
      <div class="button-container">
        <CircleButton icon="stash:play-duotone" :size="36" @click="handleClick" />
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
        :songs="songsList"
        @batch-delete="handleBatchDelete"
        @song-click="playSong"
      />
      <PlaylistsList
        v-else-if="selectedCategory === 'play-lists'"
        :playlists="playlists"
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
import { ref, watch } from 'vue'
import { scanAllAudio } from '@/utils/audioScanner'
import { useAppStore } from '@/stores/app'
import { showPrompt } from '@/utils/createPrompt'
import { showConfirm } from '@/utils/createConfirm'
const appStore = useAppStore()
const router = useRouter()
const keyword = ref('')
const onSearch = () => {}
const handleClick = () => {
  toast.success('操作成功！')
}
const operations: DropdownItem[] = [
  { icon: 'ic:baseline-plus', description: '新建播放列表', value: 'new-songs-list' },
  { icon: 'ri:scan-2-line', description: '扫描曲库', value: 'scan-songs' },
  { icon: 'ri:settings-line', description: '设置', value: 'settings' },
]
const selectedCategory = ref(appStore.getSelectedCategory())

const categoryOptions: HorizontalSelectOption[] = [
  { value: 'tracks', label: '曲目', icon: 'streamline:music-folder-song' },
  { value: 'play-lists', label: '播放列表', icon: 'tabler:playlist' },
]

const onCategorySelect = (option: HorizontalSelectOption) => {
  console.log('选中选项:', option)
}
console.log('AllSongs:' + appStore.getAllSongs().length)

const songsList = ref<Song[]>(appStore.getAllSongs())
const loadAllSongs = async () => {
  const result = await scanAllAudio()
  if (result.success) {
    songsList.value = result.songs
    toast.success(`扫描完成，共 ${result.songs.length} 首歌曲`)
    appStore.setAllSongs(songsList.value)
    selectedCategory.value = 'tracks'
  } else {
    toast.error(result.error || '扫描失败，请检查权限')
  }
}

const handleBatchDelete = async (ids: string[]) => {
  const result = await showConfirm({
    title: '提示',
    message: `确定要删除这${ids.length}首歌吗(并不会删除本地文件)？`,
    confirmText: '删除',
    cancelText: '取消',
  })
  if (!result) return
  const list: Song[] = []
  songsList.value.forEach((item) => {
    if (!ids.includes(item.id)) list.push(item)
  })
  songsList.value = list
  appStore.setAllSongs(songsList.value)
  toast.success(`已删除${ids.length}首歌`)
}

const playSong = async (song: Song) => {
  if (songsList.value.length === 0) return
  let index: number = -1
  for (let i = 0; i < songsList.value.length; i++) {
    if (song.id === songsList.value[i].id) {
      index = i
      break
    }
  }
  if (index === -1) {
    toast.error('未找到此歌曲')
    return
  }
  appStore.setIsSwitchingSong(true)
  appStore.setPlayQueue(songsList.value)
  appStore.setCurrentIndex(index)
  appStore.setMockCurrentTime(0)
  let flag = false
  if (appStore.getPlayData().isPlaying) {
    flag = true
  }
  appStore.togglePlay()
  appStore.setIsPlaying(true)
  await appStore.loadCurrentSong()
  setTimeout(() => {
    appStore.setIsSwitchingSong(false)
  }, 100)
  if (flag) {
    setTimeout(() => {
      appStore.togglePlay()
    }, 500)
  }
}
const showFullPlayer = () => {
  router.push('/player-view')
}

const playlists = ref<Playlist[]>([appStore.getLikeList(), ...appStore.getSongLists()])
const onSelectOperation = async (item: DropdownItem) => {
  console.log('选中:', item.description, item.value)
  if (item.value === 'settings') router.push('/settings')
  else if (item.value === 'scan-songs') loadAllSongs()
  else if (item.value === 'new-songs-list') {
    const name = await showPrompt({
      title: '新建播放列表',
      message: '请输入播放列表名称',
      placeholder: '',
      defaultValue: '新建歌单',
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
    } else {
      console.log('用户取消')
    }
  }
}
const handleBatchDeletePlaylists = async (ids: number[]) => {
  console.log('删除播放列表IDs:', ids)
  if (ids.includes(0)) {
    toast.warning('无法对默认收藏夹执行删除操作')
    return
  }
  const result = await showConfirm({
    title: '提示',
    message: `确定要删除这${ids.length}个歌单吗？`,
    confirmText: '删除',
    cancelText: '取消',
  })
  if (!result) return
  ids.forEach((id) => appStore.delectSongListById(id))
  toast.success(`已删除这${ids.length}个歌单`)
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
  },
  { deep: true, immediate: true }
)
watch(selectedCategory, () => {
  appStore.setSelectedCategory(selectedCategory.value)
})
</script>

<style scoped lang="scss">
.body {
  height: 100%;
  width: 100%;
  background-color: var(--bg-color);
}
.header {
  height: 60px;
  width: 100%;
  background-color: var(--bg-header);
  display: flex;
  align-items: center;
  gap: 40px;
}
.search-box-container {
  width: 60%;
  padding: 15px;
}
.button-container {
  display: flex;
  align-items: center;
  gap: 13px;
}
</style>
