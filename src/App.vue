<template>
  <ion-app>
    <div v-if="appStore.wallpaper" aria-hidden="true" class="wallpaper" />
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
/* The wallpaper sits behind every page. Pages keep painting `--bg-color`; when
   a wallpaper is set that token turns into the theme ground at an alpha, so the
   image reads through one uniform layer instead of fighting each surface. */
.wallpaper {
  position: fixed;
  /* Overscan by the blur radius so the soft edge never shows. */
  inset: calc(var(--wallpaper-blur, 0px) * -2);
  z-index: 0;
  pointer-events: none;
  background-image: var(--wallpaper-image, none);
  background-position: center;
  background-repeat: no-repeat;
  background-size: var(--wallpaper-fit, cover);
  filter: blur(var(--wallpaper-blur, 0px));
}

.router-view-wrapper {
  position: relative;
  z-index: 1;
  /* One ground for the whole app. Pages paint `--bg-color` themselves, which is
     transparent under a wallpaper, so the tint lands here exactly once. */
  background-color: var(--bg-page);
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
  background-color: var(--bg-solid, #1e1e1e);
}
</style>
