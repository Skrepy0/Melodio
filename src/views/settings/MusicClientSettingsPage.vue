<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import router from '@/router'
import PageTitle from '@/components/settings/PageTitle.vue'
import MusicClientConfig from '@/components/settings/MusicClientConfig.vue'
import { computed, ref } from 'vue'
import { musicClientsConfig } from '@/config'
import { ClientKey, MusicClientStatus } from '@/utils/interface'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const musicClientStatus = ref<MusicClientStatus>(
  appStore.getMusicClientStatus() as MusicClientStatus
)

const clientEntries = computed(
  () => Object.entries(musicClientsConfig) as [ClientKey, (typeof musicClientsConfig)[ClientKey]][]
)

const toggleClient = (key: ClientKey, checked: boolean) => {
  musicClientStatus.value[key] = checked
  appStore.setMusicClientStatus(musicClientStatus.value)
}

const goBack = () => router.back()
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.online_search.music_client.title')" />
      <div class="settings-content">
        <MusicClientConfig
          v-for="[key, config] in clientEntries"
          :key="key"
          :change="(event) => toggleClient(key, (event.target as HTMLInputElement).checked)"
          :checked="musicClientStatus[key]"
          :icon="config.icon === '' ? 'mingcute:music-line' : config.icon"
          :title="config.name"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
