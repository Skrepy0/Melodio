<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'
import InputBox from '@/components/settings/InputBox.vue'
import { DEFAULT_LYRICS_RETRY_COUNT } from '@/utils/lyrics'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
import { clearCoverCache } from '@/utils/coverCache'
import { audio } from '@/utils/createAudio'
import { showConfirm } from '@/utils/createConfirm'
import toast from '@/utils/createToast'

const { t } = useI18n()
const appStore = useAppStore()
const router = useRouter()
const goBack = () => {
  router.back()
}

const autoPauseOnDisconnect = ref(appStore.getAutoPauseOnDisconnect())
const autoPlayOnConnect = ref(appStore.getAutoPlayOnConnect())
const autoDelInvalidSongs = ref(appStore.getAutoDelInvalidSongs())
const audioFocusPause = ref(appStore.getAudioFocusPause())
const playQueueRepeat = ref(appStore.getPlayQueueRepeat())
const canFetchCoverFromWeb = ref(appStore.getCanFetchCoverFromWeb())
const lyricsRetryCount = computed({
  get: () => appStore.getLyricsRetryCount(),
  set: (value: string | number) => {
    if (value !== '') appStore.setLyricsRetryCount(Number(value))
  },
})
const searchLyricsOnline = ref(appStore.getSearchLyricsOnline())
const toggleSearchLyricsOnline = (e: Event) => {
  const target = e.target as HTMLInputElement
  searchLyricsOnline.value = target.checked
  appStore.setSearchLyricsOnline(searchLyricsOnline.value)
}
const showLyrics = ref(appStore.getShowLyrics())
const toggleShowLyrics = (e: Event) => {
  const target = e.target as HTMLInputElement
  showLyrics.value = target.checked
  appStore.setShowLyrics(showLyrics.value)
}
const pinyinSearch = ref(appStore.getPinyinSearch())
const togglePinyinSearch = (e: Event) => {
  const target = e.target as HTMLInputElement
  pinyinSearch.value = target.checked
  appStore.setPinyinSearch(pinyinSearch.value)
}
const toggleAutoPauseOnDisconnect = (e: Event) => {
  const target = e.target as HTMLInputElement
  autoPauseOnDisconnect.value = target.checked
  appStore.setAutoPauseOnDisconnect(autoPauseOnDisconnect.value)
}
const toggleAutoPlayOnConnect = (e: Event) => {
  const target = e.target as HTMLInputElement
  appStore.setAutoPlayOnConnect(target.checked)
}
const toggleAutoDelInvalidSongs = (e: Event) => {
  const target = e.target as HTMLInputElement
  autoDelInvalidSongs.value = target.checked
  appStore.setAutoDelInvalidSongs(autoDelInvalidSongs.value)
}
const toggleAudioFocusPause = (e: Event) => {
  const target = e.target as HTMLInputElement
  audioFocusPause.value = target.checked
  appStore.setAudioFocusPause(audioFocusPause.value)
}
const togglePlayQueueRepeat = (e: Event) => {
  const target = e.target as HTMLInputElement
  playQueueRepeat.value = target.checked
  appStore.setPlayQueueRepeat(playQueueRepeat.value)
}
const toggleCanFetchCoverFromWeb = (e: Event) => {
  const target = e.target as HTMLInputElement
  canFetchCoverFromWeb.value = target.checked
  appStore.setCanFetchCoverFromWeb(canFetchCoverFromWeb.value)
}
const clearCovers = async () => {
  const confirmed = await showConfirm({
    title: t('settings.accessibility.clearCoverCache'),
    message: t('settings.accessibility.clearCoverCacheConfirm'),
    confirmText: t('common.confirm'),
    cancelText: t('common.cancel'),
  })
  if (!confirmed) return

  clearCoverCache()
  // The native notification caches decoded artwork separately; clearing only
  // the URL table would leave the old picture on screen.
  try {
    await audio.clearNativeCoverCache()
  } catch {
    // Older builds have no native cache to clear.
  }
  toast.success(t('settings.accessibility.clearCoverCacheSuccess'))
}
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.accessibility.title')" />

      <div class="settings-content">
        <FunctionSwitch
          :change="togglePinyinSearch"
          :checked="pinyinSearch"
          :desc="$t('settings.accessibility.pinyinSearchDesc')"
          :title="$t('settings.accessibility.pinyinSearch')"
          icon="material-symbols-light:language-pinyin"
        />
        <FunctionSwitch
          :change="toggleAutoPauseOnDisconnect"
          :checked="autoPauseOnDisconnect"
          :desc="$t('settings.accessibility.autoPauseOnDisconnectDesc')"
          :title="$t('settings.accessibility.autoPauseOnDisconnect')"
          icon="ant-design:disconnect-outlined"
        />
        <FunctionSwitch
          :change="toggleAutoPlayOnConnect"
          :checked="autoPlayOnConnect"
          :desc="$t('settings.accessibility.autoPlayOnConnectDesc')"
          :title="$t('settings.accessibility.autoPlayOnConnect')"
          icon="akar-icons:play"
        />
        <FunctionSwitch
          :change="toggleAutoDelInvalidSongs"
          :checked="autoDelInvalidSongs"
          :desc="$t('settings.accessibility.autoCleanInvalidSongsDesc')"
          :title="$t('settings.accessibility.autoCleanInvalidSongs')"
          icon="lets-icons:check-fill"
        />
        <FunctionSwitch
          :change="toggleCanFetchCoverFromWeb"
          :checked="canFetchCoverFromWeb"
          :desc="$t('settings.accessibility.canFetchCoverFromWebDesc')"
          :title="$t('settings.accessibility.canFetchCoverFromWeb')"
          icon="dashicons:cover-image"
        />
        <FunctionSwitch
          :change="toggleAudioFocusPause"
          :checked="audioFocusPause"
          :desc="$t('settings.accessibility.audioFocusPauseDesc')"
          :title="$t('settings.accessibility.audioFocusPause')"
          icon="lucide:focus"
        />
        <FunctionSwitch
          :change="togglePlayQueueRepeat"
          :checked="playQueueRepeat"
          :desc="$t('settings.accessibility.playQueueRepeatDesc')"
          :title="$t('settings.accessibility.playQueueRepeat')"
          icon="bi:arrow-repeat"
        />
        <FunctionSwitch
          :change="toggleShowLyrics"
          :checked="showLyrics"
          :desc="$t('settings.accessibility.showLyricsDesc')"
          :title="$t('settings.accessibility.showLyrics')"
          icon="mdi:text"
        />
        <FunctionSwitch
          :change="toggleSearchLyricsOnline"
          :checked="searchLyricsOnline"
          :desc="$t('settings.accessibility.searchLyricsOnlineDesc')"
          :title="$t('settings.accessibility.searchLyricsOnline')"
          icon="mdi:cloud-search-outline"
        />
        <InputBox
          v-model="lyricsRetryCount"
          :default-value="DEFAULT_LYRICS_RETRY_COUNT"
          :min="0"
          :max="10"
          :title="$t('settings.accessibility.lyricsRetryCount')"
          :desc="$t('settings.accessibility.lyricsRetryCountDesc')"
          icon="mdi:reload"
          type="integer"
        />
        <SettingsPageLink
          :click="() => router.push('/settings/accessibility/lyrics-cache')"
          :desc="$t('lyricsCache.desc')"
          :title="$t('lyricsCache.title')"
          icon="mdi:text-box-multiple-outline"
        />
        <SettingsPageLink
          :click="clearCovers"
          :desc="$t('settings.accessibility.clearCoverCacheDesc')"
          :isLink="false"
          :title="$t('settings.accessibility.clearCoverCache')"
          icon="mdi:image-off-outline"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
