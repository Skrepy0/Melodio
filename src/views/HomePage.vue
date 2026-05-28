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
      <NowPlayingBar :song="currentSong" auto-play @expand="showFullPlayer" />
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
import { ref } from 'vue'
import { scanAllAudio } from '@/utils/audioScanner'
import { useAppStore } from '@/stores/app'
const appStore = useAppStore()
const router = useRouter()
const keyword = ref('')
appStore.init()
const onSearch = () => {}
const handleClick = () => {
  toast.success('操作成功！')
}
const operations: DropdownItem[] = [
  { icon: 'ic:baseline-plus', description: '新建播放列表', value: 'new-songs-list' },
  { icon: 'ri:scan-2-line', description: '扫描曲库', value: 'scan-songs' },
  { icon: 'ri:settings-line', description: '设置', value: 'settings' },
]

const onSelectOperation = (item: DropdownItem) => {
  console.log('选中:', item.description, item.value)
  if (item.value === 'settings') router.push('/settings')
  else if (item.value === 'scan-songs') loadAllSongs()
}
const selectedCategory = ref('tracks')

const categoryOptions: HorizontalSelectOption[] = [
  { value: 'tracks', label: '曲目', icon: 'streamline:music-folder-song' },
  { value: 'play-lists', label: '播放列表', icon: 'tabler:playlist' },
]

const onCategorySelect = (option: HorizontalSelectOption) => {
  console.log('选中选项:', option)
}

const songsList = ref<Song[]>(appStore.getAllSongs())
const loadAllSongs = async () => {
  const result = await scanAllAudio()
  if (result.success) {
    songsList.value = result.songs
    toast.success(`扫描完成，共 ${result.songs.length} 首歌曲`)
    appStore.setAllSongs(songsList.value)
    appStore.saveAllSongs()
    selectedCategory.value = 'tracks'
  } else {
    toast.error(result.error || '扫描失败，请检查权限')
  }
}
const handleBatchDelete = (ids: any) => {
  console.log('删除歌曲 IDs:', ids)
  // 调用 API 删除，并更新本地列表
}

const playSong = (song: Song) => {
  console.log('播放歌曲:', song)
}
const currentSong = ref({
  id: 1,
  name: 'Blinding Lights',
  artist: 'The Weeknd',
  coverUrl: 'https://...',
  audioUrl: '',
})
const showFullPlayer = () => {
  router.push('/player-view')
}

const playlists = ref([
  { id: 1, name: '我喜欢的音乐', description: '全部红心歌曲', songCount: 42, coverUrl: '' },
  { id: 2, name: '跑步歌单', description: '节奏明快', songCount: 18, coverUrl: '' },
  { id: 3, name: '深夜安静', songCount: 9 },
  { id: 4, name: '深夜安静', songCount: 9 },
  { id: 5, name: '深夜安静', songCount: 9 },
  { id: 6, name: '深夜安静', songCount: 9 },
  { id: 7, name: '深夜安静', songCount: 9 },
  { id: 8, name: '深夜安静', songCount: 9 },
  { id: 9, name: '深夜安静', songCount: 9 },
])

const handleBatchDeletePlaylists = (ids: any) => {
  console.log('删除播放列表IDs:', ids)
  // 更新 playlists 数据
}

const onPlaylistClick = (playlist: Playlist) => {
  console.log('点击播放列表:', playlist)
  // 可能跳转详情或播放全部
}

const onPlaylistMenuSelect = (action: any, playlist: Playlist) => {
  console.log('对播放列表操作:', action, playlist)
}
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
