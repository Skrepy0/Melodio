<script lang="ts" setup>
// import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/settings/PageTitle.vue'

// const appStore = useAppStore()
const router = useRouter()
const goBack = () => {
  router.back()
}
const goToMusicClientSettings = () => {
  router.push('/settings/online_search/music_client')
}
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :title="$t('settings.online_search.title')" :go-back="goBack" />

      <div class="settings-content">
        <div class="setting-item clickable" @click="goToMusicClientSettings">
          <div class="setting-row">
            <div class="item-left">
              <Icon
                :width="22"
                class="item-icon"
                icon="arcticons:rd-client"
                color="var(--primary-color)"
              />
              <span class="item-label">{{ $t('settings.online_search.music_client.title') }}</span>
            </div>
            <div class="item-right">
              <Icon :width="20" icon="mdi:chevron-right" color="var(--primary-color)" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.online_search.music_client.desc') }}</div>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
