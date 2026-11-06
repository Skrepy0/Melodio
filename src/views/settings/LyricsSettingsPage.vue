<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import PageTitle from '@/components/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'

import { computed } from 'vue'
import InputBox from '@/components/settings/InputBox.vue'
import { DEFAULT_LYRICS_RETRY_COUNT } from '@/utils/lyrics'

const appStore = useAppStore()
const router = useRouter()
const goBack = () => router.back()
const checked = (event: Event) => (event.target as HTMLInputElement).checked
const lyricsRetryCount = computed({
  get: () => appStore.getLyricsRetryCount(),
  set: (value: string | number) => {
    if (value !== '') appStore.setLyricsRetryCount(Number(value))
  },
})
</script>
<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.categories.lyrics.title')" />
      <div class="settings-content">
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.lyrics') }}</h2>
          <FunctionSwitch
            :checked="appStore.getShowLyrics()"
            :change="(event: Event) => appStore.setShowLyrics(checked(event))"
            :title="$t('settings.accessibility.showLyrics')"
            :desc="$t('settings.accessibility.showLyricsDesc')"
            icon="mdi:text"
          />
          <FunctionSwitch
            :checked="appStore.getSearchLyricsOnline()"
            :change="(event: Event) => appStore.setSearchLyricsOnline(checked(event))"
            :title="$t('settings.accessibility.searchLyricsOnline')"
            :desc="$t('settings.accessibility.searchLyricsOnlineDesc')"
            icon="mdi:cloud-search-outline"
          />
        </section>
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.cover') }}</h2>
          <FunctionSwitch
            :checked="appStore.getCanFetchCoverFromWeb()"
            :change="(event: Event) => appStore.setCanFetchCoverFromWeb(checked(event))"
            :title="$t('settings.accessibility.canFetchCoverFromWeb')"
            :desc="$t('settings.accessibility.canFetchCoverFromWebDesc')"
            icon="mdi:image-outline"
          />
        </section>
        <details class="settings-group advanced-settings">
          <summary class="group-title">{{ $t('settings.sections.advanced') }}</summary>
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
        </details>
      </div>
    </div>
  </ion-page>
</template>
<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
