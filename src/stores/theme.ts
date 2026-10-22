import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getContrastText, hexToRgb, mixColors } from '@/utils/color'

import { Directory, Filesystem } from '@capacitor/filesystem'
import { getDominantColor } from '@/utils/dominantColor'
import { SystemBar } from './native'
/** How the wallpaper is fitted to the viewport. */
export type WallpaperFit = 'cover' | 'contain' | 'stretch'
/**
 * The wallpaper lives at a fixed filename under `Directory.Data`; the renderable
 * URL is resolved at runtime via `Filesystem.getUri` + `getCoverSrc`. Data URLs
 * and remote URLs are no longer accepted — they end up in a CSS `url()` and in
 * localStorage.
 */
const WALLPAPER_FILENAME_RE = /^wallpaper\.jpg$/i
const isWallpaperFilename = (value: string) => WALLPAPER_FILENAME_RE.test(value)
const clampNumber = (raw: string | null, min: number, max: number, fallback: number) => {
  const value = Number(raw)
  if (raw === null || raw === '' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export const useThemeStore = defineStore('theme', () => {
  const wallpaperFilename = ref<string>('')
  const darkMode = ref(localStorage.getItem('darkMode') === 'true')

  // Matches the default accent in theme.scss: a muted cobalt that reads as
  // part of the neutral shell rather than as a system-blue leftover.
  const themeColor = ref<string>('#3d63dd')

  // Wallpaper: the image itself, plus how much of it the interface lets
  // through, how soft it is, and how it is fitted to the viewport.
  const wallpaper = ref<string>('')

  const wallpaperTransparency = ref(25)

  const wallpaperBlur = ref(0)

  const wallpaperFit = ref<WallpaperFit>('cover')

  function initThemeColor() {
    setThemeColor(localStorage.getItem('theme_color') ?? themeColor.value)
  }

  function setThemeColor(val: string) {
    themeColor.value = val
    localStorage.setItem('theme_color', val)
    applyThemeColor()
  }

  function applyThemeColor() {
    const color = themeColor.value
    const [r, g, b] = hexToRgb(color)
    document.documentElement.style.setProperty('--primary-color', color)
    // In dark mode a lighter companion reads better against the dark surface;
    // in light mode the companion needs to be darker for gradients to hold up.
    document.documentElement.style.setProperty(
      '--primary-color-dark',
      darkMode.value ? mixColors(color, '#fff', 0.2) : mixColors(color, '#000', 0.2)
    )
    document.documentElement.style.setProperty('--primary-color-rgb', `${r}, ${g}, ${b}`)
    // Type sitting on a filled accent surface has to follow the accent's own
    // lightness, or a pale user colour would leave white text unreadable.
    document.documentElement.style.setProperty('--on-primary-color', getContrastText(color))
  }

  function getThemeColor() {
    return themeColor.value
  }

  // auto System Bar color
  let sysBarColorGeneration = 0

  /**
   * Drive the native status/navigation bar icon polarity.
   *
   * The bars themselves are transparent (see SystemBarPlugin: the page ground
   * paints through them). What still needs deciding is whether the icons are
   * dark or light, and that depends on how bright the effective page ground is:
   * the theme tint (`--bg-color-rgb`) alpha-composited with the wallpaper's
   * dominant colour at `--wallpaper-ground-alpha`. Without a wallpaper, or when
   * sampling fails, the theme ground alone is used.
   *
   * A bright composite gets `mode: 'light'` (dark icons); a dark one gets
   * `mode: 'dark'` (light icons).
   */
  async function applySystemBarColor() {
    // 现在只关心图标极性
    const generation = ++sysBarColorGeneration
    const style = window.getComputedStyle(document.documentElement)

    // 计算合成色（用于亮度判定）
    const bgParts = style.getPropertyValue('--bg-color-rgb').trim()
    const bgRgb = bgParts ? bgParts.split(',').map((p) => Number.parseInt(p.trim(), 10)) : [0, 0, 0]
    let [r, g, b] = bgRgb

    if (wallpaper.value) {
      const dominant = await getDominantColor(wallpaper.value)
      if (generation !== sysBarColorGeneration) return
      if (dominant) {
        const alphaRaw = style.getPropertyValue('--wallpaper-ground-alpha').trim()
        const parsed = alphaRaw ? Number.parseFloat(alphaRaw) : 1
        const groundAlpha = Number.isFinite(parsed) ? parsed : 1
        r = Math.round(bgRgb[0] * groundAlpha + dominant[0] * (1 - groundAlpha))
        g = Math.round(bgRgb[1] * groundAlpha + dominant[1] * (1 - groundAlpha))
        b = Math.round(bgRgb[2] * groundAlpha + dominant[2] * (1 - groundAlpha))
      }
    }

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    const mode = luminance > 128 ? 'light' : 'dark'

    // 只切换图标极性
    SystemBar.setTheme({ mode }).catch(() => {})
  }

  // ----- Wallpaper -----
  // The interface ground is translucent over the wallpaper, never the wallpaper
  // itself: text and hairlines keep their contrast because every page still
  // paints `--bg-color`, just at an alpha.
  const WALLPAPER_MIN_GROUND_ALPHA = 0.08

  async function resolveWallpaperSrc(filename: string): Promise<string> {
    if (!filename) return ''
    try {
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Data })
      if (!uri) return ''
      // The WebView cannot fetch `file://` directly. Capacitor's local server
      // exposes the file at `/_capacitor_file_/data/...`; build that path by hand
      // rather than calling `Capacitor.convertFileSrc`, which depends on platform
      // config being initialised (notably under jsdom). A relative URL resolves
      // against the WebView's `https://localhost` origin on device, so it works
      // there unchanged.
      if (uri.startsWith('file://')) {
        return `/_capacitor_file_${uri.replace(/^file:\/\/+/, '/')}`
      }
      return uri
    } catch (error) {
      console.error('[wallpaper] resolveWallpaperSrc failed', error)
      return ''
    }
  }

  async function refreshWallpaperUrl(cacheBust = false) {
    const url = await resolveWallpaperSrc(wallpaperFilename.value)
    wallpaper.value = cacheBust && url ? `${url}?v=${Date.now()}` : url
    applyWallpaper()
  }

  function applyWallpaper() {
    const root = document.documentElement
    const hasWallpaper = !!wallpaper.value
    if (hasWallpaper) root.classList.add('has-wallpaper')
    else root.classList.remove('has-wallpaper')
    const open = Math.min(100, Math.max(0, wallpaperTransparency.value)) / 100
    const alpha = hasWallpaper ? Math.max(WALLPAPER_MIN_GROUND_ALPHA, 1 - open) : 1
    root.style.setProperty('--wallpaper-ground-alpha', alpha.toFixed(3))
    root.style.setProperty('--wallpaper-blur', `${wallpaperBlur.value}px`)
    root.style.setProperty(
      '--wallpaper-fit',
      wallpaperFit.value === 'stretch' ? '100% 100%' : wallpaperFit.value
    )
    root.style.setProperty('--wallpaper-image', hasWallpaper ? `url("${wallpaper.value}")` : 'none')
    // The composite brightness just changed; refresh the icon polarity.
    void applySystemBarColor()
  }

  async function setWallpaper(filename: string): Promise<boolean> {
    if (!isWallpaperFilename(filename)) return false
    try {
      localStorage.setItem('wallpaper', filename)
    } catch {
      wallpaperFilename.value = filename
      await refreshWallpaperUrl(true) // ← cache-bust
      return false
    }
    wallpaperFilename.value = filename
    await refreshWallpaperUrl(true) // ← cache-bust
    return true
  }

  function removeWallpaper() {
    const previous = wallpaperFilename.value
    wallpaperFilename.value = ''
    wallpaper.value = ''
    try {
      localStorage.removeItem('wallpaper')
    } catch {
      /* storage unavailable — the in-memory state is already cleared */
    }
    applyWallpaper()
    if (previous) {
      Filesystem.deleteFile({ path: previous, directory: Directory.Data }).catch(() => {})
    }
  }

  function getWallpaper() {
    // Returns the renderable URL, not the filename. Empty while the async
    // resolution is still in flight (or when no wallpaper is set).
    return wallpaper.value
  }

  function initWallpaper() {
    const stored = localStorage.getItem('wallpaper') ?? ''
    if (stored && !isWallpaperFilename(stored)) {
      localStorage.removeItem('wallpaper')
      wallpaperFilename.value = ''
      wallpaper.value = ''
    } else {
      wallpaperFilename.value = stored
    }
    wallpaperTransparency.value = clampNumber(
      localStorage.getItem('wallpaperTransparency'),
      0,
      100,
      25
    )
    wallpaperBlur.value = clampNumber(localStorage.getItem('wallpaperBlur'), 0, 40, 0)
    const fit = localStorage.getItem('wallpaperFit')
    wallpaperFit.value = fit === 'contain' || fit === 'stretch' ? fit : 'cover'

    // Apply the non-image variables right away so transparency/blur/fit take
    // effect on first paint; the image itself lands when the async URI resolves.
    const root = document.documentElement
    const open = Math.min(100, Math.max(0, wallpaperTransparency.value)) / 100
    root.style.setProperty('--wallpaper-ground-alpha', (1 - open).toFixed(3))
    root.style.setProperty('--wallpaper-blur', `${wallpaperBlur.value}px`)
    root.style.setProperty(
      '--wallpaper-fit',
      wallpaperFit.value === 'stretch' ? '100% 100%' : wallpaperFit.value
    )

    if (wallpaperFilename.value) void refreshWallpaperUrl()
  }

  function setWallpaperTransparency(value: number) {
    wallpaperTransparency.value = clampNumber(String(value), 0, 100, 25)
    localStorage.setItem('wallpaperTransparency', String(wallpaperTransparency.value))
    applyWallpaper()
  }

  function getWallpaperTransparency() {
    return wallpaperTransparency.value
  }

  function setWallpaperBlur(value: number) {
    wallpaperBlur.value = clampNumber(String(value), 0, 40, 0)
    localStorage.setItem('wallpaperBlur', String(wallpaperBlur.value))
    applyWallpaper()
  }

  function getWallpaperBlur() {
    return wallpaperBlur.value
  }

  function setWallpaperFit(value: WallpaperFit) {
    if (value !== 'cover' && value !== 'contain' && value !== 'stretch') return
    wallpaperFit.value = value
    localStorage.setItem('wallpaperFit', value)
    applyWallpaper()
  }

  function getWallpaperFit() {
    return wallpaperFit.value
  }

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
    applyDarkMode()
    localStorage.setItem('darkMode', String(darkMode.value))
  }

  function applyDarkMode() {
    const root = document.documentElement
    // Animate colour swaps only while the theme is changing.
    root.classList.add('theme-transition')
    if (darkMode.value) root.classList.add('dark')
    else root.classList.remove('dark')
    applyThemeColor()
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
    // Theme ground changed → the icon polarity has to be recomputed from the
    // new composite. Resolve it after the class swap so `--bg-color-rgb` is
    // current.
    void applySystemBarColor()
  }

  function loadInitialDarkMode() {
    const saved = localStorage.getItem('darkMode')
    if (saved === 'true') {
      darkMode.value = true
    } else if (saved === 'false') {
      darkMode.value = false
    } else {
      darkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyDarkMode()
  }
  return {
    darkMode,
    themeColor,
    wallpaper,
    wallpaperTransparency,
    wallpaperBlur,
    wallpaperFit,
    initThemeColor,
    setThemeColor,
    applyThemeColor,
    getThemeColor,
    applySystemBarColor,
    WALLPAPER_MIN_GROUND_ALPHA,
    resolveWallpaperSrc,
    refreshWallpaperUrl,
    applyWallpaper,
    setWallpaper,
    removeWallpaper,
    getWallpaper,
    initWallpaper,
    setWallpaperTransparency,
    getWallpaperTransparency,
    setWallpaperBlur,
    getWallpaperBlur,
    setWallpaperFit,
    getWallpaperFit,
    toggleDarkMode,
    applyDarkMode,
    loadInitialDarkMode,
  }
})
