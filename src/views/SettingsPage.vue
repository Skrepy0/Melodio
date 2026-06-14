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
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:weather-night" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.darkMode') }}</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="isDarkMode" @change="toggleDarkMode" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">{{ $t('settings.darkModeDesc') }}</div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="material-symbols-light:language-pinyin" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.pinyinSearch') }}</span>
            </div>
            <label class="switch">
              <input type="checkbox" :checked="pinyinSearch" @change="togglePinyinSearch" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">{{ $t('settings.pinyinSearchDesc') }}</div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="ant-design:disconnect-outlined" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.autoPauseOnDisconnect') }}</span>
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
          <div class="setting-desc">{{ $t('settings.autoPauseOnDisconnectDesc') }}</div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="lets-icons:check-fill" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.autoCleanInvalidSongs') }}</span>
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
          <div class="setting-desc">{{ $t('settings.autoCleanInvalidSongsDesc') }}</div>
        </div>

        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="dashicons:cover-image" :width="22" class="item-icon" />
              <span class="item-label">{{ $t('settings.canFetchCoverFromWeb') }}</span>
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
          <div class="setting-desc">{{ $t('settings.canFetchCoverFromWebDesc') }}</div>
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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appStore = useAppStore()
const router = useRouter()

const isDarkMode = ref(false)
const pinyinSearch = ref(appStore.getPinyinSearch())
const autoPauseOnDisconnect = ref(appStore.getAutoPauseOnDisconnect())
const autoDelInvalidSongs = ref(appStore.getAutoDelInvalidSongs())
const canFetchCoverFromWeb = ref(appStore.getCanFetchCoverFromWeb())

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

const toggleDarkMode = () => {
  appStore.toggleDarkMode()
  isDarkMode.value = appStore.darkMode
}

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
const goToAbout = () => {
  router.push('/about')
}
const goToBlacklist = () => {
  router.push('/blacklist')
}
onMounted(() => {
  isDarkMode.value = appStore.darkMode
})
</script>

<style scoped lang="scss">
.back-icon {
  opacity: 0.8;
  transition: opacity 0.2s;
  &:hover {
    opacity: 1;
  }
}
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}
.settings-header {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);
  gap: 16px;
  flex-shrink: 0;
}
.header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
  &:hover {
    background-color: var(--header-back-hover);
  }
}
.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.setting-item {
  display: flex;
  flex-direction: column;
  padding: 14px 0;
  border-bottom: 1px solid var(--setting-border);
  background-color: transparent;
  transition: background 0.2s;
  &.clickable {
    cursor: pointer;
    &:hover {
      background-color: var(--setting-hover-bg);
    }
  }
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.item-icon {
  color: var(--text-secondary);
  width: 22px;
}
.item-label {
  font-size: 16px;
  color: var(--text-color);
}
.item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}
.item-value {
  color: var(--text-secondary);
}
.setting-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  padding-left: 34px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--switch-bg-off);
  transition: 0.2s;
  border-radius: 34px;
}
.slider:before {
  position: absolute;
  content: '';
  height: 22px;
  width: 22px;
  left: 2px;
  bottom: 2px;
  background-color: var(--switch-handle-color);
  transition: 0.2s;
  border-radius: 50%;
}
input:checked + .slider {
  background-color: var(--primary-color);
}
input:checked + .slider:before {
  transform: translateX(22px);
}
</style>
