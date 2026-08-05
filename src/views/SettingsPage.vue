<script lang="ts" setup>
import { actionSheetController, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/settings/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'

const { t } = useI18n()
const appStore = useAppStore()
const router = useRouter()

const currentLanguage = computed(() => appStore.getLanguage())
const currentLanguageName = computed(() => {
  switch (currentLanguage.value) {
    case 'zh-CN':
      return '简体中文'
    case 'en-US':
      return 'English'
    default:
      return currentLanguage.value
  }
})

const showLanguageSelector = async () => {
  const actionSheet = await actionSheetController.create({
    header: t('settings.languageSelectorHeader'),
    buttons: [
      {
        text: '简体中文',
        handler: () => changeLanguage('zh-CN'),
      },
      {
        text: 'English',
        handler: () => changeLanguage('en-US'),
      },
      {
        text: t('common.cancel', '取消'),
        role: 'cancel',
      },
    ],
  })
  await actionSheet.present()
}

const changeLanguage = (lang: string) => {
  appStore.setLanguage(lang)
}

const goBack = () => {
  router.back()
}

const goToAbout = () => {
  router.push('/about')
}
const goToBlacklist = () => {
  router.push('/blacklist')
}
const goToInterfaceSettings = () => {
  router.push('/settings/interface')
}
const goToOnlineSearchSettings = () => {
  router.push('/settings/online_search')
}
const goToAccessibility = () => {
  router.push('/settings/accessibility')
}
const goToOther = () => {
  router.push('/settings/other')
}
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :title="$t('settings.title')" :go-back="goBack" />

      <div class="settings-content">
        <SettingsPageLink
          :title="$t('settings.interface.title')"
          :click="goToInterfaceSettings"
          icon="mdi:theme"
          :desc="$t('settings.interface.desc')"
        />
        <SettingsPageLink
          :title="$t('settings.online_search.title')"
          :click="goToOnlineSearchSettings"
          icon="ic:baseline-search"
          :desc="$t('settings.online_search.desc')"
        />
        <SettingsPageLink
          :title="$t('settings.accessibility.title')"
          :click="goToAccessibility"
          icon="material-symbols:accessibility"
          :desc="$t('settings.accessibility.desc')"
        />
        <SettingsPageLink
          :title="$t('settings.blacklist')"
          :click="goToBlacklist"
          icon="mdi:ban"
          :desc="$t('settings.blacklistDesc')"
        />
        <SettingsPageLink
          :title="$t('settings.other.title')"
          :click="goToOther"
          icon="ic:baseline-miscellaneous-services"
          :desc="$t('settings.other.desc')"
        />

        <div class="setting-item clickable" @click="showLanguageSelector">
          <div class="setting-row">
            <div class="item-left">
              <Icon
                :width="22"
                class="item-icon"
                icon="mdi:translate"
                color="var(--primary-color)"
              />
              <span class="item-label">{{ $t('settings.language') }}</span>
            </div>
            <div class="item-right">
              <span class="item-value">{{ currentLanguageName }}</span>
              <Icon :width="20" icon="mdi:chevron-left" color="var(--primary-color)" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.languageDesc') }}</div>
        </div>
        <SettingsPageLink
          :title="$t('settings.about')"
          :click="goToAbout"
          icon="mdi:information-outline"
          :desc="$t('settings.aboutDesc')"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../theme/settings.scss';
</style>
