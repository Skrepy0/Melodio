<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { exportLocalStorage, importLocalStorage } from '@/utils/ioData'
import toast from '@/utils/createToast'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/settings/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'

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

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :title="$t('settings.other.title')" :go-back="goBack" />
      <div class="settings-content">
        <SettingsPageLink
          :title="$t('settings.other.exportData')"
          :click="exportData"
          icon="majesticons:data"
          :desc="$t('settings.other.exportDataDesc')"
          :isLink="false"
        />
        <SettingsPageLink
          :title="$t('settings.other.importData')"
          :click="importData"
          icon="pajamas:import"
          :desc="$t('settings.other.importDataDesc')"
          :isLink="false"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
