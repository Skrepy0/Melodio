import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { IonicVue } from '@ionic/vue'

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css'

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */
/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css'

/* Theme variables */
import './theme/variables.css'
import './theme/theme.scss'

import toast from './utils/createToast'
import { audio } from './utils/createAudio'
import { showPrompt } from './utils/createPrompt'
import { showConfirm } from './utils/createConfirm'
import { addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'
import { i18n } from './i18n'

const app = createApp(App).use(IonicVue).use(router)
app.use(createPinia())
app.use(i18n)
app.config.globalProperties.$toast = toast
app.config.globalProperties.$audio = audio
app.config.globalProperties.$prompt = showPrompt
app.config.globalProperties.$createConfirm = showConfirm
router.isReady().then(() => {
  app.mount('#app')
})
addCollection(mdiIcons)
