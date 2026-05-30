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

<script setup lang="ts">
import { IonApp, useBackButton } from '@ionic/vue'
import { App } from '@capacitor/app'
import { useRouter, useRoute } from 'vue-router'
import { ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
appStore.init()
const transitionName = ref('zoom')
watch(
  () => route.path,
  (newPath, oldPath) => {
    if (newPath === '/player-view') {
      transitionName.value = 'slide-up'
    } else if (oldPath === '/player-view') {
      transitionName.value = 'slide-up'
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
</script>

<style>
.router-view-wrapper {
  background-color: var(--bg-color);
  height: 100%;
  overflow: hidden;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: all 0.25s ease;
}
.zoom-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.zoom-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.3s ease;
}
.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
  opacity: 1;
}
</style>
