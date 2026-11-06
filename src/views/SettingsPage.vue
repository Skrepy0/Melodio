<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
const router = useRouter()
const categories = [
  { key: 'appearance', path: '/settings/appearance', icon: 'mdi:theme-light-dark' },
  { key: 'playback', path: '/settings/playback', icon: 'mdi:play-circle-outline' },
  { key: 'lyrics', path: '/settings/lyrics', icon: 'mdi:music-box-outline' },
  { key: 'library', path: '/settings/library', icon: 'iconoven:music-search' },
  { key: 'data', path: '/settings/data', icon: 'mdi:database-outline' },
  { key: 'about', path: '/about', icon: 'mdi:information-outline' },
]
</script>
<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="() => router.back()" :title="$t('settings.title')" />
      <div class="settings-content">
        <SettingsPageLink
          v-for="category in categories"
          :key="category.key"
          :click="() => router.push(category.path)"
          :icon="category.icon"
          :title="$t(`settings.categories.${category.key}.title`)"
          :desc="$t(`settings.categories.${category.key}.desc`)"
        />
      </div>
    </div>
  </ion-page>
</template>
<style lang="scss" scoped>
@use '../theme/settings.scss';
</style>
