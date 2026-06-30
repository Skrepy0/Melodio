<template>
  <ion-page>
    <div class="settings-page">
      <div class="settings-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">{{ $t('settings.accessibility.title') }}</div>
      </div>

      <div class="settings-content">
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="material-symbols-light:language-pinyin" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.accessibility.pinyinSearch') }}</span>
            </div>
            <label class="switch">
              <input type="checkbox" :checked="pinyinSearch" @change="togglePinyinSearch" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">{{ $t('settings.accessibility.pinyinSearchDesc') }}</div>
        </div>
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="ant-design:disconnect-outlined" :width="22" class="item-icon" />
              <span class="item-label">{{
                $t('settings.accessibility.autoPauseOnDisconnect')
              }}</span>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                :checked="autoPauseOnDisconnect"
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
              <Icon icon="lets-icons:check-fill" :width="22" class="item-icon" />
              <span class="item-label">{{
                $t('settings.accessibility.autoCleanInvalidSongs')
              }}</span>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                :checked="autoDelInvalidSongs"
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
              <Icon icon="dashicons:cover-image" :width="22" class="item-icon" />
              <span class="item-label">{{
                $t('settings.accessibility.canFetchCoverFromWeb')
              }}</span>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                :checked="canFetchCoverFromWeb"
                @change="toggleCanFetchCoverFromWeb"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">
            {{ $t('settings.accessibility.canFetchCoverFromWebDesc') }}
          </div>
        </div>
      </div>
    </div>
  </ion-page>
</template>
<script setup lang="ts">
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

const toggleCanFetchCoverFromWeb = (e: Event) => {
  const target = e.target as HTMLInputElement
  canFetchCoverFromWeb.value = target.checked
  appStore.setCanFetchCoverFromWeb(canFetchCoverFromWeb.value)
}
</script>
<style scoped lang="scss">
@use '../../theme/settings.scss';
</style>
