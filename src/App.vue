<template>
  <ion-app>
    <div class="router-view-wrapper">
      <router-view v-slot="{ Component }">
        <transition name="zoom" mode="in-out">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, useBackButton } from '@ionic/vue'
import { App } from '@capacitor/app'
import { useRouter } from 'vue-router'

const router = useRouter()

useBackButton(-1, () => {
  if (router.currentRoute.value.path === '/home') {
    App.exitApp()
  }
})
</script>

<style>
.router-view-wrapper {
  background-color: var(--bg-color);
  height: 100%;
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
</style>
