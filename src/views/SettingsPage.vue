<template>
  <ion-page>
    <div class="settings-page">
      <!-- 自定义头部 -->
      <div class="settings-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">设置</div>
      </div>

      <!-- 设置内容区域 -->
      <div class="settings-content">
        <!-- 深色模式 -->
        <div class="setting-item">
          <div class="item-left">
            <Icon icon="mdi:weather-night" :width="22" class="item-icon" />
            <span class="item-label">深色模式</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="isDarkMode" @change="toggleDarkMode" />
            <span class="slider round"></span>
          </label>
        </div>

        <!-- 接收通知 -->
        <div class="setting-item">
          <div class="item-left">
            <Icon icon="mdi:bell-outline" :width="22" class="item-icon" />
            <span class="item-label">接收通知</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="notificationsEnabled" @change="toggleNotifications" />
            <span class="slider round"></span>
          </label>
        </div>

        <!-- 显示歌词 -->
        <div class="setting-item">
          <div class="item-left">
            <Icon icon="mdi:music-note" :width="22" class="item-icon" />
            <span class="item-label">显示歌词</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="showLyrics" @change="toggleLyrics" />
            <span class="slider round"></span>
          </label>
        </div>

        <!-- 音质选择 -->
        <div class="setting-item clickable" @click="selectQuality">
          <div class="item-left">
            <Icon icon="mdi:quality-high" :width="22" class="item-icon" />
            <span class="item-label">音质选择</span>
          </div>
          <div class="item-right">
            <span class="item-value">{{ currentQuality }}</span>
            <Icon icon="mdi:chevron-right" :width="20" />
          </div>
        </div>

        <!-- 清理缓存 -->
        <div class="setting-item clickable" @click="clearCache">
          <div class="item-left">
            <Icon icon="mdi:delete-outline" :width="22" class="item-icon" />
            <span class="item-label">清理缓存</span>
          </div>
          <div class="item-right">
            <span class="item-value">{{ cacheSize }}</span>
          </div>
        </div>

        <!-- 关于 -->
        <div class="setting-item clickable" @click="goToAbout">
          <div class="item-left">
            <Icon icon="mdi:information-outline" :width="22" class="item-icon" />
            <span class="item-label">关于</span>
          </div>
          <div class="item-right">
            <Icon icon="mdi:chevron-right" :width="20" />
          </div>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage } from '@ionic/vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app'
const appStore = useAppStore()
const router = useRouter()

// 状态
const isDarkMode = ref(false)
const notificationsEnabled = ref(true)
const showLyrics = ref(true)
const currentQuality = ref('标准')
const cacheSize = ref('128MB')

// 返回上一页
const goBack = () => {
  router.back()
}

// 深色模式切换
const toggleDarkMode = () => {
  appStore.toggleDarkMode()
}

const toggleNotifications = () => {
  console.log('通知开关:', notificationsEnabled.value)
}

const toggleLyrics = () => {
  console.log('显示歌词:', showLyrics.value)
}

const selectQuality = () => {
  console.log('打开音质选择弹窗')
}

const clearCache = () => {
  console.log('清理缓存')
  cacheSize.value = '0MB'
}

const goToAbout = () => {
  router.push('/about')
}

// 初始化深色模式
onMounted(() => {
  const savedDarkMode = localStorage.getItem('darkMode')
  if (savedDarkMode === 'true') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark')
  } else if (savedDarkMode === 'false') {
    isDarkMode.value = false
    document.documentElement.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDarkMode.value = prefersDark
    if (prefersDark) document.documentElement.classList.add('dark')
  }
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

/* 自定义头部 */
.settings-header {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  background-color: var(--bg-header);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
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
    background-color: rgba(0, 0, 0, 0.05);
  }
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

/* 内容区域，可滚动 */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  background-color: transparent;
  transition: background 0.2s;
}

.setting-item.clickable {
  cursor: pointer;
  &:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-icon {
  color: var(--text-secondary, #666);
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
  color: var(--text-secondary, #666);
  font-size: 14px;
}

.item-value {
  color: var(--text-secondary, #666);
}

/* 自定义开关样式（模拟 iOS 风格） */
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
  background-color: #ccc;
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
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color, #007aff);
}

input:checked + .slider:before {
  transform: translateX(22px);
}

/* 暗色模式适配（如果全局有 .dark 类，这里也自动生效） */
.dark .settings-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}
.dark .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}
.dark .setting-item.clickable:hover {
  background-color: rgba(255, 255, 255, 0.03);
}
</style>
