<template>
  <ion-page>
    <div class="settings-page">
      <div class="settings-header">
        <div class="header-back" @click="goBack">
          <Icon :width="24" color="var(--text-color)" icon="material-symbols:arrow-back" />
        </div>
        <div class="header-title">{{ $t('settings.accessibility.title') }}</div>
      </div>

      <div class="settings-content">
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon :width="22" class="item-icon" icon="material-symbols-light:language-pinyin" />
              <span class="item-label">{{ $t('settings.accessibility.pinyinSearch') }}</span>
            </div>
            <label class="switch">
              <input :checked="pinyinSearch" type="checkbox" @change="togglePinyinSearch" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">{{ $t('settings.accessibility.pinyinSearchDesc') }}</div>
        </div>
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon :width="22" class="item-icon" icon="ant-design:disconnect-outlined" />
              <span class="item-label">{{
                $t('settings.accessibility.autoPauseOnDisconnect')
              }}</span>
            </div>
            <label class="switch">
              <input
                :checked="autoPauseOnDisconnect"
                type="checkbox"
                @change="toggleAutoPauseOnDisconnect"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">
            {{ $t('settings.accessibility.autoPauseOnDisconnectDesc') }}
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon :width="22" class="item-icon" icon="lets-icons:check-fill" />
              <span class="item-label">{{
                $t('settings.accessibility.autoCleanInvalidSongs')
              }}</span>
            </div>
            <label class="switch">
              <input
                :checked="autoDelInvalidSongs"
                type="checkbox"
                @change="toggleAutoDelInvalidSongs"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">
            {{ $t('settings.accessibility.autoCleanInvalidSongsDesc') }}
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon :width="22" class="item-icon" icon="dashicons:cover-image" />
              <span class="item-label">{{
                $t('settings.accessibility.canFetchCoverFromWeb')
              }}</span>
            </div>
            <label class="switch">
              <input
                :checked="canFetchCoverFromWeb"
                type="checkbox"
                @change="toggleCanFetchCoverFromWeb"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">
            {{ $t('settings.accessibility.canFetchCoverFromWebDesc') }}
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon :width="22" class="item-icon" icon="lucide:focus" />
              <span class="item-label">{{ $t('settings.accessibility.audioFocusPause') }}</span>
            </div>
            <label class="switch">
              <input :checked="audioFocusPause" type="checkbox" @change="toggleAudioFocusPause" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">
            {{ $t('settings.accessibility.audioFocusPauseDesc') }}
          </div>
        </div>
      </div>
    </div>
  </ion-page>
</template>
<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

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
<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
