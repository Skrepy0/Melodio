<template>
  <ion-app>
    <div class="router-view-wrapper">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['PlayerView']">
          <transition :name="transitionName" mode="out-in">
            <component :is="Component" />
          </transition>
        </keep-alive>
      </router-view>
    </div>
  </ion-app>
</template>

<script lang="ts" setup>
import { IonApp, useBackButton } from '@ionic/vue'
import { App } from '@capacitor/app'
import { useRoute, useRouter } from 'vue-router'
import { onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { loadLocaleMessages } from './i18n'
import { Capacitor } from '@capacitor/core'

console.log('NativeAudio available:', Capacitor.isPluginAvailable('NativeAudio'))
const appStore = useAppStore()
appStore.init()
const router = useRouter()
const route = useRoute()
const transitionName = ref('zoom')

watch(
  () => route.path,
  (newPath, oldPath) => {
    if (newPath === '/player-view') {
      transitionName.value = 'player-slide'
    } else if (oldPath === '/player-view') {
      transitionName.value = 'player-slide'
    } else {
      transitionName.value = 'zoom'
    }
  },
  { immediate: true }
)

useBackButton(-1, () => {
  if (router.currentRoute.value.path === '/home') {
    App.minimizeApp()
  }
})

watch(
  () => appStore.getLanguage(),
  (newLang) => {
    if (newLang) {
      loadLocaleMessages(newLang)
    }
  },
  { immediate: true }
)
onMounted(() => {
  appStore.initLanguage()
})
</script>

<style>
.router-view-wrapper {
  background-color: var(--bg-color);
  height: 100%;
  overflow: hidden;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: all var(--duration-normal) var(--ease-out-back);
}
.zoom-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.zoom-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

/* Router-level transition for the player sheet. Named separately from the
   shared `.slide-up-*` utilities so the two never fight over declarations. */
.player-slide-enter-active,
.player-slide-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.3s ease;
}
.player-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.player-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
body {
  background-color: var(--bg-color, #1e1e1e); /* 你的深色背景 */
}
</style>
