import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import { DEFAULT_COVER, fetchCoverFromWeb, getCoverSrc, isSafeCoverSource } from '@/utils/functions'

type CoverSong = Pick<Song, 'title' | 'artist' | 'albumArtUri'>

/**
 * Resolve the artwork for a song in two stages:
 *
 * 1. Render the embedded `albumArtUri` directly (a MediaStore album-art URI can
 *    point at a missing entry, so this is only a best-effort first attempt).
 * 2. If the image fails to load and online lookup is enabled, query the web
 *    providers; only when that also fails does the default icon appear.
 *
 * The returned `onCoverError` must be wired to the `<img>`'s error event.
 */
export function useCoverSrc(song: MaybeRefOrGetter<CoverSong | null | undefined>) {
  const appStore = useAppStore()
  const coverSrc = ref('')
  const isCoverLoading = ref(false)
  let abortController: AbortController | null = null
  // Reset whenever the song changes so each track gets one web attempt.
  let triedWebFallback = false

  const canFetchFromWeb = () => appStore.getCanFetchCoverFromWeb()

  const abortPending = () => {
    abortController?.abort()
    abortController = null
  }

  async function fetchFromWeb(target: CoverSong) {
    abortPending()
    abortController = new AbortController()
    const signal = abortController.signal
    isCoverLoading.value = true
    try {
      const url = await fetchCoverFromWeb(target.title, target.artist || '', signal)
      if (!signal.aborted) coverSrc.value = url || DEFAULT_COVER
    } catch {
      if (!signal.aborted) coverSrc.value = DEFAULT_COVER
    } finally {
      if (!signal.aborted) isCoverLoading.value = false
    }
  }

  const resolve = (target: CoverSong | null | undefined) => {
    abortPending()
    triedWebFallback = false
    isCoverLoading.value = false
    // Drop the previous track's artwork so it cannot flash while resolving.
    coverSrc.value = ''

    if (!target) {
      coverSrc.value = DEFAULT_COVER
      return
    }

    const local = isSafeCoverSource(target.albumArtUri) ? getCoverSrc(target.albumArtUri || '') : ''
    if (local) {
      coverSrc.value = local
      return
    }

    if (!canFetchFromWeb()) {
      coverSrc.value = DEFAULT_COVER
      return
    }

    // No embedded artwork at all — look it up online right away.
    triedWebFallback = true
    void fetchFromWeb(target)
  }

  /**
   * Called when the `<img>` fails to decode. A broken local cover triggers the
   * online lookup; a failed lookup (or one already attempted) falls back to the
   * default icon.
   */
  const onCoverError = () => {
    const target = toValue(song)
    if (!target || triedWebFallback || !canFetchFromWeb()) {
      coverSrc.value = DEFAULT_COVER
      return
    }
    triedWebFallback = true
    // Clear the broken image first so the placeholder shows while we search.
    coverSrc.value = DEFAULT_COVER
    void fetchFromWeb(target)
  }

  watch(
    () => toValue(song),
    (target) => resolve(target),
    { immediate: true }
  )

  onUnmounted(() => {
    abortPending()
  })

  return { coverSrc, isCoverLoading, onCoverError, resolve }
}
