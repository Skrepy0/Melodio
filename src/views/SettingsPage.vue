<script lang="ts" setup>
import { actionSheetController, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/PageTitle.vue'
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
      <PageTitle :go-back="goBack" :title="$t('settings.title')" />

      <div class="settings-content">
        <SettingsPageLink
          :click="goToInterfaceSettings"
          :desc="$t('settings.interface.desc')"
          :title="$t('settings.interface.title')"
          icon="mdi:theme"
        />
        <SettingsPageLink
          :click="goToOnlineSearchSettings"
          :desc="$t('settings.online_search.desc')"
          :title="$t('settings.online_search.title')"
          icon="ic:baseline-search"
        />
        <SettingsPageLink
          :click="goToAccessibility"
          :desc="$t('settings.accessibility.desc')"
          :title="$t('settings.accessibility.title')"
          icon="material-symbols:accessibility"
        />
        <SettingsPageLink
          :click="goToBlacklist"
          :desc="$t('settings.blacklistDesc')"
          :title="$t('settings.blacklist')"
          icon="mdi:ban"
        />
        <SettingsPageLink
          :click="goToOther"
          :desc="$t('settings.other.desc')"
          :title="$t('settings.other.title')"
          icon="ic:baseline-miscellaneous-services"
        />

        <div class="setting-item clickable" @click="showLanguageSelector">
          <div class="setting-row">
            <div class="item-left">
              <Icon
                :width="22"
                class="item-icon"
                color="var(--primary-color)"
                icon="mdi:translate"
              />
              <span class="item-label">{{ $t('settings.language') }}</span>
            </div>
            <div class="item-right">
              <span class="item-value">{{ currentLanguageName }}</span>
              <Icon :width="20" color="var(--primary-color)" icon="mdi:chevron-left" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.languageDesc') }}</div>
        </div>
        <SettingsPageLink
          :click="goToAbout"
          :desc="$t('settings.aboutDesc')"
          :title="$t('settings.about')"
          icon="mdi:information-outline"
        />
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../theme/settings.scss';
</style>
