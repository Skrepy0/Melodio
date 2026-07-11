<template>
  <ion-page>
    <div class="settings-page">
      <div class="settings-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">{{ $t('settings.other.title') }}</div>
      </div>

      <div class="settings-content">
        <div class="setting-item clickable" @click="exportData">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="majesticons:data" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.other.exportData') }}</span>
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.other.exportDataDesc') }}</div>
        </div>

        <div class="setting-item clickable" @click="importData">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="pajamas:import" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.other.importData') }}</span>
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.other.importDataDesc') }}</div>
        </div>
      </div>
    </div>
  </ion-page>
</template>
<script setup lang="ts">
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { exportLocalStorage, importLocalStorage } from '@/utils/ioData'
import toast from '@/utils/createToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const goBack = () => {
  router.back()
}

const exportData = async () => {
  try {
    await exportLocalStorage()
    toast.success(t('settings.other.io.successExport'))
  } catch (e) {
    toast.error(t('settings.other.io.exportError', { e: e }))
  }
}
const importData = async () => {
  try {
    await importLocalStorage()
    window.location.reload()
    toast.success(t('settings.other.io.successImport'))
  } catch (e) {
    toast.error(t('settings.other.io.importError', { e: e }))
  }
}
</script>
<style scoped lang="scss">
@use '../../theme/settings.scss';
</style>
