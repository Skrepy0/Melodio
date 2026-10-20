import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Song } from '@/utils/interface'
import { useAppStore } from '@/stores/app'
import { DEFAULT_COVER, fetchCoverFromWeb, resolveLocalCover } from '@/utils/functions'

// resolveLocalCover 需要 uri/id 才能从音频文件提取内嵌封面。
type CoverSong = Pick<Song, 'title' | 'artist' | 'albumArtUri' | 'uri' | 'id'>

/**
 * Resolve the artwork for a song in two stages:
 *
 * 1. Resolve the local cover through {@link resolveLocalCover}: a `data:` /
 *    `https:` / `file:` reference is used as-is, otherwise the embedded artwork
 *    is extracted from the audio file. Best-effort — a MediaStore album-art URI
 *    can point at a missing entry.
 * 2. If no local cover is available (or the resolved image fails to decode) and
 *    online lookup is enabled, query the web providers; only when that also
 *    fails does the default icon appear.
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
  // Bumped by every resolve(); async results that arrive after the track
  // switched are discarded instead of overwriting the new cover.
  let resolveSeq = 0

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

  const resolve = async (target: CoverSong | null | undefined) => {
    abortPending()
    const seq = ++resolveSeq
    triedWebFallback = false
    isCoverLoading.value = false
    // Drop the previous track's artwork so it cannot flash while resolving.
    coverSrc.value = ''

    if (!target) {
      coverSrc.value = DEFAULT_COVER
      return
    }

    // First stage: local cover (direct reference or embedded artwork).
    // resolveLocalCover only reads title/artist/albumArtUri/uri/id — all present
    // on CoverSong — so the assertion is safe.
    let local = ''
    try {
      local = await resolveLocalCover(target as Song)
    } catch {
      local = ''
    }
    if (seq !== resolveSeq) return // stale: track changed during resolve
    if (local) {
      coverSrc.value = local
      return
    }

    if (!canFetchFromWeb()) {
      coverSrc.value = DEFAULT_COVER
      return
    }

    // No local artwork — look it up online right away.
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
    (target) => {
      void resolve(target)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    abortPending()
    // Invalidate any in-flight resolve so it cannot write after unmount.
    resolveSeq++
  })

  return { coverSrc, isCoverLoading, onCoverError, resolve }
}
