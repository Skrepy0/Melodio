<script lang="ts" setup>
import { IonPage } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { exportLocalStorage, importLocalStorage } from '@/utils/ioData'
import toast from '@/utils/createToast'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
import { clearCoverCache } from '@/utils/coverCache'
import { audio } from '@/utils/createAudio'
import { showConfirm } from '@/utils/createConfirm'

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
    toast.success(t('settings.other.io.successImport'))
    // Give the toast a beat to render before the reload wipes the page.
    window.setTimeout(() => window.location.reload(), 900)
  } catch (e) {
    toast.error(t('settings.other.io.importError', { e: e }))
  }
}
const clearCovers = async () => {
  const confirmed = await showConfirm({
    title: t('settings.accessibility.clearCoverCache'),
    message: t('settings.accessibility.clearCoverCacheConfirm'),
    confirmText: t('common.confirm'),
    cancelText: t('common.cancel'),
  })
  if (!confirmed) return

  clearCoverCache()
  // The native notification caches decoded artwork separately; clearing only
  // the URL table would leave the old picture on screen.
  try {
    await audio.clearNativeCoverCache()
  } catch {
    // Older builds have no native cache to clear.
  }
  toast.success(t('settings.accessibility.clearCoverCacheSuccess'))
}
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.categories.data.title')" />
      <div class="settings-content">
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.cache') }}</h2>
          <SettingsPageLink
            :click="() => router.push('/settings/data/lyrics-cache')"
            :desc="$t('lyricsCache.desc')"
            :title="$t('lyricsCache.title')"
            icon="mdi:text-box-multiple-outline"
          />
          <SettingsPageLink
            :click="clearCovers"
            :desc="$t('settings.accessibility.clearCoverCacheDesc')"
            :isLink="false"
            :title="$t('settings.accessibility.clearCoverCache')"
            icon="mdi:image-off-outline"
          />
        </section>
        <section class="settings-group">
          <h2 class="group-title">{{ $t('settings.sections.backup') }}</h2>
          <SettingsPageLink
            :click="exportData"
            :desc="$t('settings.other.exportDataDesc')"
            :isLink="false"
            :title="$t('settings.other.exportData')"
            icon="majesticons:data"
          />
          <SettingsPageLink
            :click="importData"
            :desc="$t('settings.other.importDataDesc')"
            :isLink="false"
            :title="$t('settings.other.importData')"
            icon="pajamas:import"
          />
        </section>
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
</style>
