import { ref, watch, type Ref } from 'vue'

/**
 * Extracts a usable dominant colour from album artwork.
 *
 * The player tints its background with this colour so the screen takes its
 * light from the music rather than from the app chrome. Sampling happens on a
 * tiny offscreen canvas (24×24) and the result is pushed through a small
 * saturation/luminance correction: artwork is often near-black or blown out,
 * and a raw average would wash out to grey in one direction or the other.
 */

const SAMPLE_SIZE = 24
const CACHE_LIMIT = 40

const cache = new Map<string, [number, number, number] | null>()

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Only same-origin/data URLs can be read back without tainting the canvas;
    // remote artwork is fetched through Capacitor's proxy and is fine.
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('cover load failed'))
    img.src = src
  })
}

function toRgb(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  let h = 0
  const l = (max + min) / 2
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
  if (max !== min) {
    const d = max - min
    if (max === r / 255) h = ((g - b) / 255 / d + (g < b ? 6 : 0)) / 6
    else if (max === g / 255) h = ((b - r) / 255 / d + 2) / 6
    else h = ((r - g) / 255 / d + 4) / 6
  }
  // Keep the hue, but put every cover on a similar, usable footing: enough
  // saturation to read as colour, mid lightness so text stays legible on top.
  const sat = Math.min(0.62, Math.max(0.24, s))
  const light = Math.min(0.6, Math.max(0.34, l))
  return hslToRgb(h, sat, light)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
  ]
}

async function sample(src: string): Promise<[number, number, number] | null> {
  if (cache.has(src)) return cache.get(src) ?? null
  if (cache.size > CACHE_LIMIT) cache.clear()

  try {
    const img = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

    let r = 0
    let g = 0
    let b = 0
    let weight = 0
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha < 32) continue
      // Ignore near-white and near-black pixels: they carry the page frame,
      // not the artwork's identity.
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
      if (lum > 0.94 || lum < 0.06) continue
      const w = 0.4 + Math.abs(lum - 0.5)
      r += data[i] * w
      g += data[i + 1] * w
      b += data[i + 2] * w
      weight += w
    }
    if (weight === 0) {
      cache.set(src, null)
      return null
    }
    const result = toRgb(r / weight, g / weight, b / weight)
    cache.set(src, result)
    return result
  } catch {
    cache.set(src, null)
    return null
  }
}

export function useCoverColor(coverSrc: Ref<string>) {
  const rgb = ref<[number, number, number] | null>(null)
  let generation = 0

  watch(
    coverSrc,
    async (src) => {
      const gen = ++generation
      if (!src || src.startsWith('data:image/svg')) {
        rgb.value = null
        return
      }
      const result = await sample(src)
      if (gen !== generation) return
      rgb.value = result
    },
    { immediate: true }
  )

  return { rgb }
}
