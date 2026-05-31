import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN.json'
import enUS from '@/locales/en-US.json'

const messages: Record<string, any> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

const savedLocale = localStorage.getItem('appLanguage') || 'zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'zh-CN',
  messages,
})

export function setLanguage(locale: string) {
  if (messages[locale]) {
    i18n.global.locale.value = locale
    localStorage.setItem('appLanguage', locale)
  }
}

export async function loadLocaleMessages(locale: string) {
  setLanguage(locale)
  return Promise.resolve(true)
}

export { i18n }
