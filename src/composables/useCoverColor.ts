import { ref, watch, type Ref } from 'vue'
import { getDominantColor, type Rgb } from '@/utils/dominantColor'

/**
 * Resolve the dominant colour of a cover URL and keep it in sync as the cover
 * changes. The sampling itself lives in `utils/dominantColor` so store-side
 * callers can reuse the same cache without pulling in a composable.
 */
export function useCoverColor(coverSrc: Ref<string>) {
  const rgb = ref<Rgb | null>(null)
  let generation = 0

  watch(
    coverSrc,
    async (src) => {
      const gen = ++generation
      if (!src || src.startsWith('data:image/svg')) {
        rgb.value = null
        return
      }
      const result = await getDominantColor(src)
      if (gen !== generation) return
      rgb.value = result
    },
    { immediate: true }
  )

  return { rgb }
}
