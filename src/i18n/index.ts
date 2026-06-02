import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN.json'
import enUS from '@/locales/en-US.json'

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as any

const savedLocale = localStorage.getItem('appLanguage') || 'zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'zh-CN',
  messages,
})

export function setLanguage(locale: string) {
  if (locale === 'zh-CN' || locale === 'en-US') {
    i18n.global.locale.value = locale
    localStorage.setItem('appLanguage', locale)
  }
}

export async function loadLocaleMessages(locale: string) {
  setLanguage(locale)
  return Promise.resolve(true)
}

export { i18n }
