<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/settings/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'

const appStore = useAppStore()
const router = useRouter()
const goBack = () => {
  router.back()
}

const autoPauseOnDisconnect = ref(appStore.getAutoPauseOnDisconnect())
const autoDelInvalidSongs = ref(appStore.getAutoDelInvalidSongs())
const audioFocusPause = ref(appStore.getAudioFocusPause())
const canFetchCoverFromWeb = ref(appStore.getCanFetchCoverFromWeb())
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
const toggleCanFetchCoverFromWeb = (e: Event) => {
  const target = e.target as HTMLInputElement
  canFetchCoverFromWeb.value = target.checked
  appStore.setCanFetchCoverFromWeb(canFetchCoverFromWeb.value)
}
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :title="$t('settings.accessibility.title')" :go-back="goBack" />

      <div class="settings-content">
        <FunctionSwitch
          :title="$t('settings.accessibility.pinyinSearch')"
          icon="material-symbols-light:language-pinyin"
          :desc="$t('settings.accessibility.pinyinSearchDesc')"
          :checked="pinyinSearch"
          :change="togglePinyinSearch"
        />
        <FunctionSwitch
          :title="$t('settings.accessibility.autoPauseOnDisconnect')"
          icon="ant-design:disconnect-outlined"
          :desc="$t('settings.accessibility.autoPauseOnDisconnectDesc')"
          :checked="autoPauseOnDisconnect"
          :change="toggleAutoPauseOnDisconnect"
        />
        <FunctionSwitch
          :title="$t('settings.accessibility.autoCleanInvalidSongs')"
          icon="lets-icons:check-fill"
          :desc="$t('settings.accessibility.autoCleanInvalidSongsDesc')"
          :checked="autoDelInvalidSongs"
          :change="toggleAutoDelInvalidSongs"
        />
        <FunctionSwitch
          :title="$t('settings.accessibility.canFetchCoverFromWeb')"
          icon="dashicons:cover-image"
          :desc="$t('settings.accessibility.canFetchCoverFromWebDesc')"
          :checked="canFetchCoverFromWeb"
          :change="toggleCanFetchCoverFromWeb"
        />
        <FunctionSwitch
          :title="$t('settings.accessibility.audioFocusPause')"
          icon="lucide:focus"
          :desc="$t('settings.accessibility.audioFocusPauseDesc')"
          :checked="audioFocusPause"
          :change="toggleAudioFocusPause"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
