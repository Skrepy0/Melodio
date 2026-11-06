<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
import InputBox from '@/components/settings/InputBox.vue'
import { computed } from 'vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'

const appStore = useAppStore()
const router = useRouter()
const musicClientLimitation = computed({
  get: () => appStore.getMusicClientLimitation(),
  set: (value: string | number) => {
    if (value !== '') appStore.setMusicClientLimitation(Number(value))
  },
})
const fetchTimeOut = computed({
  get: () => appStore.getFetchTimeOut(),
  set: (value: string | number) => {
    if (value !== '') appStore.setFetchTimeOut(Number(value))
  },
})
const eachSongAveTimeOut = computed({
  get: () => appStore.getEachSongAveTimeOut(),
  set: (value: string | number) => {
    if (value !== '') appStore.setEachSongAveTimeOut(Number(value))
  },
})
const goBack = () => {
  router.back()
}
const goToMusicClientSettings = () => {
  router.push('/settings/library/music-sources')
}

const checked = (event: Event) => (event.target as HTMLInputElement).checked
</script>
<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.categories.library.title')" />
      <div class="settings-content">
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.localLibrary') }}</h2>
          <FunctionSwitch
            :checked="appStore.getPinyinSearch()"
            :change="(event: Event) => appStore.setPinyinSearch(checked(event))"
            :title="$t('settings.accessibility.pinyinSearch')"
            :desc="$t('settings.accessibility.pinyinSearchDesc')"
            icon="mdi:alphabetical"
          />
          <FunctionSwitch
            :checked="appStore.getAutoDelInvalidSongs()"
            :change="(event: Event) => appStore.setAutoDelInvalidSongs(checked(event))"
            :title="$t('settings.accessibility.autoCleanInvalidSongs')"
            :desc="$t('settings.accessibility.autoCleanInvalidSongsDesc')"
            icon="mdi:playlist-remove"
          />
          <SettingsPageLink
            :click="() => router.push('/blacklist')"
            :title="$t('settings.blacklist')"
            :desc="$t('settings.blacklistDesc')"
            icon="mdi:ban"
          />
        </section>
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.onlineSearch') }}</h2>
          <SettingsPageLink
            :click="goToMusicClientSettings"
            :desc="$t('settings.online_search.music_client.desc')"
            :title="$t('settings.online_search.music_client.title')"
            icon="fluent:sound-source-24-regular"
          />
        </section>
        <details class="settings-group advanced-settings">
          <summary class="group-title">{{ $t('settings.sections.advanced') }}</summary>
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
        </details>
      </div>
    </div>
  </ion-page>
</template>
<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
