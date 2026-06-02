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
// const updateStatusBarForTheme = async () => {
//   // 1. 启用边缘到边缘布局（使内容延伸到状态栏下方）
//   await EdgeToEdge.enable();

//   // 2. 设置状态栏背景色为黑色（使用新 API）
//   await EdgeToEdge.setStatusBarColor({ color: '#000000' });

//   // 3. （可选）设置导航栏背景色，如果也需要黑色
//   await EdgeToEdge.setNavigationBarColor({ color: '#000000' });

//   // 4. 设置状态栏图标为白色（Style.Light 表示浅色图标，适合深色背景）
//   await StatusBar.setStyle({ style: Style.Light });

//   // 5. 确保 WebView 内容覆盖状态栏区域（避免出现空白条）
//   await StatusBar.setOverlaysWebView({ overlay: true });
// };
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
// watch(
//   appStore.darkMode.valueOf,
//   () => {
//     updateStatusBarForTheme()
//   },
//   { immediate: true }
// )
watch(
  () => appStore.getLanguage(),
  (newLang) => {
    if (newLang) {
      loadLocaleMessages(newLang)
    }
  },
  { immediate: true } // 立即执行一次，确保 store 中的语言与 i18n 同步
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
/* 全局处理 */
body {
  background-color: var(--bg-color, #1e1e1e); /* 你的深色背景 */
}

/* 固定顶部元素避让状态栏 */
.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

/* 底部元素避让导航栏/Home 指示条 */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
