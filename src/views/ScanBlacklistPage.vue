<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
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
      <div class="page-top">
        <div class="nav-row">
          <button :aria-label="$t('common.back')" class="nav-back" type="button" @click="goBack">
            <Icon :width="24" icon="mdi:chevron-left" />
          </button>

          <Transition mode="out-in" name="fade">
            <div v-if="!isSearchMode" key="normal" class="normal-mode">
              <h1 class="header-title">{{ t('blacklist.title') }}</h1>
              <div class="nav-actions">
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

.page-top {
  flex-shrink: 0;
  padding-top: env(safe-area-inset-top, 0px);
  background-color: var(--bg-color);
}

.nav-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 52px;
  padding: 0 var(--space-2);
}

.nav-back {
  @include icon-button(40px);
  color: var(--text-color);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.nav-action {
  @include icon-button(40px);
}

.normal-mode {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.header-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  @include text-ellipsis;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
  color: var(--text-color);
}

.search-mode {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.search-input-field {
  flex: 1;
  min-width: 0;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  @include custom-scrollbar(3px);
}

.loading-state,
.empty-state {
  @include empty-state;

  p {
    margin: 0;
  }
}

.empty-icon {
  color: var(--text-tertiary);
  opacity: 0.7;
}

.loading-icon {
  animation: spin 1s linear infinite;
  color: var(--text-tertiary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
