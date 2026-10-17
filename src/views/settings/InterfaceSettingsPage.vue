<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/PageTitle.vue'
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

const presetColors = ['#3d63dd', '#d93a3a', '#c2571a', '#2f8f5b', '#7a4fd1', '#0f8f8f']

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
              <Icon :width="22" class="item-icon" icon="mdi:palette-outline" />
              <span class="item-label">{{ $t('settings.interface.themeColor') }}</span>
            </div>
            <div class="color-picker-wrapper">
              <label
                :aria-label="$t('settings.interface.themeColor')"
                :style="{ backgroundColor: currentColor }"
                class="color-picker-trigger"
              >
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
          <div class="preset-colors" role="radiogroup">
            <button
              v-for="color in presetColors"
              :key="color"
              :aria-checked="currentColor === color"
              :aria-label="color"
              :style="{ '--swatch': color }"
              class="preset-color-item"
              role="radio"
              type="button"
              @click="selectPresetColor(color)"
            >
              <span class="preset-color-dot">
                <Icon v-if="currentColor === color" color="#fff" icon="mdi:check" width="16" />
              </span>
            </button>
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
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      border: 1px solid var(--hairline-strong);
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
    gap: var(--space-3);
    margin-top: var(--space-3);
    padding: 0 var(--space-4) var(--space-2) calc(var(--space-4) + 34px);
    flex-wrap: wrap;

    .preset-color-item {
      width: 40px;
      height: 40px;
      padding: 0;
      border-radius: var(--radius-full);
      cursor: pointer;
      background: transparent;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .preset-color-dot {
        width: 26px;
        height: 26px;
        border-radius: var(--radius-full);
        background-color: var(--swatch);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform var(--duration-fast) ease;
      }

      &:hover .preset-color-dot {
        transform: scale(1.08);
      }

      &[aria-checked='true'] .preset-color-dot {
        box-shadow:
          0 0 0 2px var(--bg-color),
          0 0 0 4px var(--swatch);
      }

      &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: -2px;
      }
    }
  }
  .setting-desc {
    margin-top: 6px;
  }
}
</style>
