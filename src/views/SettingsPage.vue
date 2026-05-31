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
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:weather-night" :width="22" class="item-icon" />
              <span class="item-label">深色模式</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="isDarkMode" @change="toggleDarkMode" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">开启后界面将切换为深色主题。</div>
        </div>

        <!-- 接收通知 -->
        <div class="setting-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="material-symbols-light:language-pinyin" :width="22" class="item-icon" />
              <span class="item-label">拼音搜索</span>
            </div>
            <label class="switch">
              <input type="checkbox" :checked="pinyinSearch" @change="togglePinyinSearch" />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-desc">
            开启后,所有搜索功能都会用拼音搜索处理(无法通过字母和单词进行搜索)
          </div>
        </div>

        <!-- 关于 -->
        <div class="setting-item clickable" @click="goToAbout">
          <div class="setting-row">
            <div class="item-left">
              <Icon icon="mdi:information-outline" :width="22" class="item-icon" />
              <span class="item-label">关于(todo)</span>
            </div>
            <div class="item-right">
              <Icon icon="mdi:chevron-right" :width="20" />
            </div>
          </div>
          <div class="setting-desc">查看应用的有关信息。</div>
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

const isDarkMode = ref(false)
const pinyinSearch = ref(appStore.getPinyinSearch())

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
  console.log(pinyinSearch.value)
}

const goToAbout = () => {
  router.push('/about')
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
