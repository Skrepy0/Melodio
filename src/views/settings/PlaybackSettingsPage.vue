<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import PageTitle from '@/components/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'

const appStore = useAppStore()
const router = useRouter()
const goBack = () => router.back()
const checked = (event: Event) => (event.target as HTMLInputElement).checked
</script>
<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.categories.playback.title')" />
      <div class="settings-content">
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.queue') }}</h2>
          <FunctionSwitch
            :checked="appStore.getPlayQueueRepeat()"
            :change="(event: Event) => appStore.setPlayQueueRepeat(checked(event))"
            :title="$t('settings.accessibility.playQueueRepeat')"
            :desc="$t('settings.accessibility.playQueueRepeatDesc')"
            icon="mdi:repeat"
          />
        </section>
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.devices') }}</h2>
          <FunctionSwitch
            :checked="appStore.getAutoPauseOnDisconnect()"
            :change="(event: Event) => appStore.setAutoPauseOnDisconnect(checked(event))"
            :title="$t('settings.accessibility.autoPauseOnDisconnect')"
            :desc="$t('settings.accessibility.autoPauseOnDisconnectDesc')"
            icon="mdi:headphones-off"
          />
          <FunctionSwitch
            :checked="appStore.getAutoPlayOnConnect()"
            :change="(event: Event) => appStore.setAutoPlayOnConnect(checked(event))"
            :title="$t('settings.accessibility.autoPlayOnConnect')"
            :desc="$t('settings.accessibility.autoPlayOnConnectDesc')"
            icon="mdi:headphones"
          />
        </section>
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.interruptions') }}</h2>
          <FunctionSwitch
            :checked="appStore.getAudioFocusPause()"
            :change="(event: Event) => appStore.setAudioFocusPause(checked(event))"
            :title="$t('settings.accessibility.audioFocusPause')"
            :desc="$t('settings.accessibility.audioFocusPauseDesc')"
            icon="mdi:volume-off"
          />
        </section>
      </div>
    </div>
  </ion-page>
</template>
<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
