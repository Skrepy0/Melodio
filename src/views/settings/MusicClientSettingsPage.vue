<script setup lang="ts">
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import router from '@/router'
import PageTitle from '@/components/settings/PageTitle.vue'

const goBack = () => {
  router.back()
}
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :title="$t('settings.online_search.music_client.title')" :go-back="goBack" />
      <div class="settings-content"></div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
