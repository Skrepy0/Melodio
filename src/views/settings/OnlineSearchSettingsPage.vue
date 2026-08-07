<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
import InputBox from '@/components/settings/InputBox.vue'
import { ref, watch } from 'vue'

const appStore = useAppStore()
const router = useRouter()
const musicClientLimitation = ref<number>(appStore.getMusicClientLimitation())
const fetchTimeOut = ref<number>(appStore.getFetchTimeOut())
const eachSongAveTimeOut = ref<number>(appStore.getEachSongAveTimeOut())
const goBack = () => {
  router.back()
}
const goToMusicClientSettings = () => {
  router.push('/settings/online_search/music_client')
}

watch(musicClientLimitation, () => {
  appStore.setMusicClientLimitation(musicClientLimitation.value)
})
watch(fetchTimeOut, () => {
  appStore.setFetchTimeOut(fetchTimeOut.value)
})
watch(eachSongAveTimeOut, () => {
  appStore.setEachSongAveTimeOut(eachSongAveTimeOut.value)
})
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.online_search.title')" />

      <div class="settings-content">
        <SettingsPageLink
          :click="goToMusicClientSettings"
          :desc="$t('settings.online_search.music_client.desc')"
          :title="$t('settings.online_search.music_client.title')"
          icon="fluent:sound-source-24-regular"
        />
        <InputBox
          v-model="musicClientLimitation"
          :default-value="5"
          :desc="$t('settings.online_search.music_client.client_limit_desc')"
          :max="99"
          :min="1"
          :placeholder="$t('input_box.placeholder')"
          :title="$t('settings.online_search.music_client.client_limit')"
          icon="hugeicons:limitation"
          type="integer"
        />
        <InputBox
          v-model="fetchTimeOut"
          :default-value="30"
          :desc="$t('settings.online_search.fetch_timeout_desc')"
          :max="600"
          :min="1"
          :placeholder="$t('input_box.placeholder')"
          :title="$t('settings.online_search.fetch_timeout')"
          icon="eos-icons:timeout"
          type="integer"
        />
        <InputBox
          v-model="eachSongAveTimeOut"
          :default-value="10"
          :desc="$t('settings.online_search.each_song_ave_timeout_desc')"
          :max="60"
          :min="1"
          :placeholder="$t('input_box.placeholder')"
          :title="$t('settings.online_search.each_song_ave_timeout')"
          icon="mingcute:time-line"
          type="integer"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
