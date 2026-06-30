<template>
  <ion-page>
    <div class="settings-page">
      <div class="settings-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">{{ $t('settings.interface.title') }}</div>
      </div>

      <div class="settings-content">
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:weather-night" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.interface.darkMode') }}</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="isDarkMode" @change="toggleDarkMode" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">{{ $t('settings.interface.darkModeDesc') }}</div>
        </div>
      </div>
    </div>
  </ion-page>
</template>
<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const appStore = useAppStore()
const router = useRouter()
const goBack = () => {
  router.back()
}

const isDarkMode = ref(false)
const toggleDarkMode = () => {
  appStore.toggleDarkMode()
  isDarkMode.value = appStore.darkMode
}
onMounted(() => {
  isDarkMode.value = appStore.darkMode
})
</script>
<style scoped lang="scss">
@use '../../theme/settings.scss';
</style>
