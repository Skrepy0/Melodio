<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/settings/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'

const appStore = useAppStore()
const router = useRouter()
const goBack = () => {
  router.back()
}

const isDarkMode = ref(false)
const toggleDarkMode = () => {
  appStore.toggleDarkMode()
  isDarkMode.value = appStore.darkMode
}

const presetColors = ['#1677ff', '#eb5da2', '#fa8c16', '#52c41a', '#722ed1', '#13c2c2']

const currentColor = ref(appStore.getThemeColor())

const selectPresetColor = (color: string) => {
  currentColor.value = color
  appStore.setThemeColor(color)
}

const handleColorPicker = (e: Event) => {
  const target = e.target as HTMLInputElement
  const color = target.value
  if (color) {
    currentColor.value = color
    appStore.setThemeColor(color)
  }
}

watch(
  () => appStore.getThemeColor(),
  (newColor) => {
    if (newColor) currentColor.value = newColor
  }
)

onMounted(() => {
  isDarkMode.value = appStore.darkMode
})
</script>

<template>
  <ion-page>
    <div class="settings-page">
      <PageTitle :go-back="goBack" :title="$t('settings.interface.title')" />

      <div class="settings-content">
        <FunctionSwitch
          :change="toggleDarkMode"
          :checked="isDarkMode"
          :desc="$t('settings.interface.darkModeDesc')"
          :title="$t('settings.interface.darkMode')"
          icon="mdi:weather-night"
        />

        <div class="setting-item theme-color-item">
          <div class="setting-row">
            <div class="item-left">
              <Icon
                :width="22"
                class="item-icon"
                color="var(--primary-color)"
                icon="material-symbols:palette-outline"
              />
              <span class="item-label">{{ $t('settings.interface.themeColor') || '主题色' }}</span>
            </div>
            <div class="color-picker-wrapper">
              <label :style="{ backgroundColor: currentColor }" class="color-picker-trigger">
                <input
                  :value="currentColor"
                  class="color-picker-input"
                  type="color"
                  @input="handleColorPicker"
                />
              </label>
            </div>
          </div>
          <div class="setting-desc">
            {{ $t('settings.interface.themeColorDesc') }}
          </div>
          <div class="preset-colors">
            <div
              v-for="color in presetColors"
              :key="color"
              :class="{ active: currentColor === color }"
              :style="{ backgroundColor: color }"
              class="preset-color-item"
              @click="selectPresetColor(color)"
            >
              <Icon
                v-if="currentColor === color"
                color="#fff"
                icon="material-symbols:check-small"
                width="18"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
@use '../../theme/settings.scss';
.theme-color-item {
  .color-picker-wrapper {
    display: flex;
    align-items: center;
    .color-picker-trigger {
      display: inline-block;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid var(--border-color, #ddd);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      .color-picker-input {
        position: absolute;
        top: -4px;
        left: -4px;
        width: calc(100% + 8px);
        height: calc(100% + 8px);
        opacity: 0;
        cursor: pointer;
        border: none;
        padding: 0;
        margin: 0;
      }
    }
  }

  .preset-colors {
    display: flex;
    gap: 12px;
    margin-top: 12px;
    flex-wrap: wrap;
    justify-content: center;

    .preset-color-item {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        transform: scale(1.1);
        border-color: var(--text-color, #333);
      }

      &.active {
        border-color: var(--text-color, #333);
        box-shadow:
          0 0 0 2px var(--bg-color, #fff),
          0 0 0 4px var(--primary, #1677ff);
      }
    }
  }
  .setting-desc {
    margin-top: 6px;
  }
}
</style>
