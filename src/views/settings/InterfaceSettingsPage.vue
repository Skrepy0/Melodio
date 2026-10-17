<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'
import HorizontalSelect from '@/components/HorizontalSelect.vue'
import type { HorizontalSelectOption } from '@/utils/interface'
import toast from '@/utils/createToast'

/** The wallpaper is stored as a data URL, so it is downscaled before saving. */
const MAX_WALLPAPER_SIZE = 1600
const JPEG_QUALITY = 0.82

const { t } = useI18n()
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

// ----- Wallpaper -----
const wallpaper = ref(appStore.getWallpaper())
const wallpaperTransparency = ref(appStore.getWallpaperTransparency())
const wallpaperBlur = ref(appStore.getWallpaperBlur())
const wallpaperFit = ref(appStore.getWallpaperFit())
const isReadingWallpaper = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const hasWallpaper = computed(() => !!wallpaper.value)

const fitOptions = computed<HorizontalSelectOption[]>(() => [
  { value: 'cover', label: t('settings.interface.wallpaperFitCover') },
  { value: 'contain', label: t('settings.interface.wallpaperFitContain') },
  { value: 'stretch', label: t('settings.interface.wallpaperFitStretch') },
])

const openFilePicker = () => {
  fileInputRef.value?.click()
}

/** Downscale and re-encode so the data URL fits comfortably in localStorage. */
const readImageAsWallpaper = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('decode failed'))
      image.onload = () => {
        const scale = Math.min(1, MAX_WALLPAPER_SIZE / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('canvas unavailable'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })

const onWallpaperChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error(t('settings.interface.wallpaperInvalidImage'))
    return
  }
  isReadingWallpaper.value = true
  try {
    const dataUrl = await readImageAsWallpaper(file)
    if (appStore.setWallpaper(dataUrl)) {
      wallpaper.value = appStore.getWallpaper()
    } else {
      toast.error(t('settings.interface.wallpaperTooLarge'))
    }
  } catch {
    toast.error(t('settings.interface.wallpaperReadFailed'))
  } finally {
    isReadingWallpaper.value = false
  }
}

const removeWallpaper = () => {
  appStore.removeWallpaper()
  wallpaper.value = ''
}

const onTransparencyInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  wallpaperTransparency.value = value
  appStore.setWallpaperTransparency(value)
}

const onBlurInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  wallpaperBlur.value = value
  appStore.setWallpaperBlur(value)
}

const selectFit = (value: string) => {
  wallpaperFit.value = value as typeof wallpaperFit.value
  appStore.setWallpaperFit(wallpaperFit.value)
}

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

        <div class="settings-group">
          <div class="group-title">{{ $t('settings.interface.wallpaperGroup') }}</div>

          <div class="setting-item wallpaper-item">
            <div class="setting-row">
              <div class="item-left">
                <Icon :width="22" class="item-icon" icon="mdi:image-outline" />
                <span class="item-label">{{ $t('settings.interface.wallpaper') }}</span>
              </div>
              <div class="item-right">
                <button
                  v-if="hasWallpaper"
                  class="text-action"
                  type="button"
                  @click="removeWallpaper"
                >
                  {{ $t('settings.interface.wallpaperRemove') }}
                </button>
                <button
                  :disabled="isReadingWallpaper"
                  class="text-action primary"
                  type="button"
                  @click="openFilePicker"
                >
                  {{
                    isReadingWallpaper
                      ? $t('settings.interface.wallpaperReading')
                      : hasWallpaper
                        ? $t('settings.interface.wallpaperReplace')
                        : $t('settings.interface.wallpaperUpload')
                  }}
                </button>
              </div>
            </div>
            <div class="setting-desc">{{ $t('settings.interface.wallpaperDesc') }}</div>

            <div v-if="hasWallpaper" class="wallpaper-preview">
              <div class="wallpaper-thumb" :style="{ backgroundImage: `url('${wallpaper}')` }" />
              <div class="wallpaper-controls">
                <label class="range-row">
                  <span class="range-label">{{
                    $t('settings.interface.wallpaperTransparency')
                  }}</span>
                  <span class="range-value tabular">{{ wallpaperTransparency }}%</span>
                  <input
                    :aria-label="$t('settings.interface.wallpaperTransparency')"
                    :value="wallpaperTransparency"
                    class="range-input"
                    max="100"
                    min="0"
                    step="1"
                    type="range"
                    @input="onTransparencyInput"
                  />
                </label>
                <label class="range-row">
                  <span class="range-label">{{ $t('settings.interface.wallpaperBlur') }}</span>
                  <span class="range-value tabular">{{ wallpaperBlur }}px</span>
                  <input
                    :aria-label="$t('settings.interface.wallpaperBlur')"
                    :value="wallpaperBlur"
                    class="range-input"
                    max="40"
                    min="0"
                    step="1"
                    type="range"
                    @input="onBlurInput"
                  />
                </label>
              </div>
            </div>

            <div v-if="hasWallpaper" class="wallpaper-fit">
              <span class="range-label">{{ $t('settings.interface.wallpaperFit') }}</span>
              <HorizontalSelect
                :model-value="wallpaperFit"
                :options="fitOptions"
                @update:model-value="selectFit"
              />
            </div>

            <input
              ref="fileInputRef"
              accept="image/*"
              class="file-input"
              type="file"
              @change="onWallpaperChange"
            />
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
          0 0 0 2px var(--bg-solid),
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

// ----- Wallpaper -----
// The control reads as a row first and only unfolds into a small editor once
// an image exists, so the page stays a list rather than a form.
.text-action {
  padding: 6px 2px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border-radius: var(--radius-xs);

  &.primary {
    color: var(--primary-color);
  }

  &:disabled {
    color: var(--text-disabled);
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
}

.wallpaper-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4) var(--space-3);
}

.wallpaper-thumb {
  flex-shrink: 0;
  width: 64px;
  height: 96px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-placeholder);
  background-position: center;
  background-size: cover;
  box-shadow: inset 0 0 0 1px var(--hairline);
}

.wallpaper-controls {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.range-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px var(--space-2);
  min-width: 0;
}

.range-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.range-value {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

// The browser's own range styling follows `accent-color`, which the theme sets
// globally; only the track height needs nudging for touch.
.range-input {
  grid-column: 1 / -1;
  width: 100%;
  margin: 0;
  height: 28px;
  background: transparent;
  cursor: pointer;
}

.wallpaper-fit {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4);
}

.file-input {
  display: none;
}
</style>
