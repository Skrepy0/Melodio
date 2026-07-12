<script lang="ts" setup>
import router from '@/router'
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { DropdownItem, Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import PlayList from '@/components/PlayList.vue'
import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import { useI18n } from 'vue-i18n'
import SearchBox from '@/components/SearchBox.vue'
import DropdownButton from '@/components/button/DropdownButton.vue'
import CircleButton from '@/components/button/CircleButton.vue'
import { useSongSearch } from '@/utils/search'

const { t } = useI18n()
const appStore = useAppStore()

const songsList = ref<Song[]>([])
const showSongsList = ref<Song[]>([])
const keyword = ref('')
const isLoading = ref(false)

const isSearchMode = ref(false)

const operations = computed<DropdownItem[]>(() => [
  { icon: 'mdi:delete', description: t('blacklist.operations.delete_all'), value: 'delete_all' },
])

const synchroShowSongsList = () => {
  showSongsList.value = songsList.value
}

songsList.value = appStore.getBlacklist()
synchroShowSongsList()

const saveSongList = () => {
  appStore.setBlacklist(songsList.value)
}

const goBack = () => router.back()

const handleBatchDelete = async (ids: string[]) => {
  const result = await showConfirm({
    title: t('blacklist.confirm.title'),
    message: t('blacklist.confirm.message', { count: ids.length }),
    confirmText: t('blacklist.confirm.confirm'),
    cancelText: t('blacklist.confirm.cancel'),
  })
  if (!result) return
  const list: Song[] = []
  songsList.value.forEach((item) => {
    if (!ids.includes(item.id)) list.push(item)
  })
  songsList.value = list
  synchroShowSongsList()
  saveSongList()
  toast.success(t('blacklist.toast.removeSuccess', { count: ids.length }))
}

const onSelectOperation = async (item: DropdownItem) => {
  console.log('选中:', item.description, item.value)
  if (item.value === 'delete_all') {
    const result = await showConfirm({
      title: t('blacklist.deleteAllSongs.title'),
      message: t('blacklist.deleteAllSongs.message'),
      confirmText: t('blacklist.deleteAllSongs.confirm'),
      cancelText: t('blacklist.deleteAllSongs.cancel'),
    })
    if (result) {
      if (songsList.value.length !== 0) {
        songsList.value = []
        synchroShowSongsList()
        appStore.setBlacklist([])
        toast.success(t('blacklist.deleteAllSongs.result.success'))
      } else {
        toast.warning(t('blacklist.deleteAllSongs.result.emptyList'))
      }
    }
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
    <div class="blacklist-page">
      <div class="blacklist-header">
        <div class="header-back" @click="goBack">
          <Icon :width="24" color="var(--text-color)" icon="material-symbols:arrow-back" />
        </div>

        <Transition mode="out-in" name="fade">
          <div v-if="!isSearchMode" key="normal" class="normal-mode">
            <div class="header-title">{{ t('blacklist.title') }}</div>
            <div class="button-container">
              <CircleButton :size="36" icon="mdi:magnify" @click="enterSearchMode" />
              <DropdownButton
                :dx="-100"
                :options="operations"
                :size="36"
                button-icon="mingcute:more-2-line"
                @select="onSelectOperation"
              />
            </div>
          </div>

          <div v-else key="search" class="search-mode">
            <div class="search-wrapper">
              <SearchBox
                v-model="keyword"
                :clearable="true"
                :placeholder="$t('home.searchPlaceholder')"
                autofocus
                class="search-input-field"
                size="medium"
                @search="onSearch"
              />
              <CircleButton
                :size="36"
                bg-color="transparent"
                icon="mdi:close"
                icon-color="var(--text-color)"
                @click="exitSearchMode"
              />
            </div>
          </div>
        </Transition>
      </div>

      <div class="content-body">
        <div v-if="isLoading" class="loading-state">
          <Icon :width="32" class="loading-icon" icon="mdi:loading" />
          <span>{{ $t('songList.loading') }}</span>
        </div>
        <div v-if="!isLoading && songsList.length === 0" class="empty-state">
          <Icon :width="48" color="var(--text-secondary)" icon="mdi:music-off" />
          <p>{{ $t('songList.empty') }}</p>
        </div>
        <div
          v-if="!isLoading && songsList.length !== 0 && showSongsList.length === 0"
          class="empty-state"
        >
          <Icon :width="48" color="var(--text-secondary)" icon="mdi:music-off" />
          <p>{{ $t('songList.notFound') }}</p>
        </div>
        <PlayList
          v-else
          :show-operations="false"
          :songs="showSongsList"
          :visibility="{
            selectAll: true,
            clear: true,
            addToQueue: false,
            addToPlaylist: false,
            delete: true,
            ban: false,
            close: true,
          }"
          @batch-delete="handleBatchDelete"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.blacklist-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

.blacklist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 60px;
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);
  flex-shrink: 0;
}

.header-back {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
  &:hover {
    background-color: var(--header-back-hover);
  }
}

.header-title {
  flex: 1;
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.button-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 12px;
}

.search-input-field {
  flex: 1;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 5px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--text-secondary);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.header-title,
.button-container,
.search-wrapper {
  transition: all 0.25s ease;
}
.normal-mode {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fade-leave-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fade-enter-active {
  transition: all 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}
.fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
