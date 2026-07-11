<template>
  <ion-page>
    <div class="settings-page">
      <div class="settings-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">{{ $t('settings.title') }}</div>
      </div>

      <div class="settings-content">
        <div class="setting-item clickable" @click="goToInterfaceSettings">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:theme" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.interface.title') }}</span>
            </div>
            <div class="item-right">
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.interface.desc') }}</div>
        </div>
        <div class="setting-item clickable" @click="goToAccessibility">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="material-symbols:accessibility" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.accessibility.title') }}</span>
            </div>
            <div class="item-right">
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.accessibility.desc') }}</div>
        </div>

        <div class="setting-item clickable" @click="goToBlacklist">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:ban" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.blacklist') }}</span>
            </div>
            <div class="item-right">
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.blacklistDesc') }}</div>
        </div>

        <div class="setting-item clickable" @click="goToOther">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="ic:baseline-miscellaneous-services" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.other.title') }}</span>
            </div>
            <div class="item-right">
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.other.desc') }}</div>
        </div>

        <div class="setting-item clickable" @click="showLanguageSelector">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:translate" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.language') }}</span>
            </div>
            <div class="item-right">
              <span class="item-value">{{ currentLanguageName }}</span>
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.languageDesc') }}</div>
        </div>

        <div class="setting-item clickable" @click="goToAbout">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:information-outline" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.about') }}</span>
            </div>
            <div class="item-right">
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">{{ $t('settings.aboutDesc') }}</div>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { actionSheetController, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

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
const goToAccessibility = () => {
  router.push('/settings/accessibility')
}
const goToOther = () => {
  router.push('/settings/other')
}
</script>

<style scoped lang="scss">
@use '../theme/settings.scss';
</style>
