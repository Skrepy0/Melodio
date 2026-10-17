import { onUnmounted, ref, watch, type Ref } from 'vue'
import type { Playlist } from '@/utils/interface'
import { DEFAULT_COVER, fetchCoverFromWeb, getCoverSrc, isSafeCoverSource } from '@/utils/functions'
import { useAppStore } from '@/stores/app'

/**
 * Resolve the artwork shown for a playlist.
 *
 * Priority: user-chosen cover → first song with embedded artwork → artwork
 * fetched from the web for the first song → default icon. The resolved value is
 * already converted to a URL the WebView can load.
 */
export function usePlaylistCover(playlist: Ref<Playlist | null | undefined>, enabled = true) {
  const appStore = useAppStore()
  const coverSrc = ref('')
  let abortController: AbortController | null = null

  const resolve = async () => {
    abortController?.abort()
    abortController = null

    const list = playlist.value
    if (!list) {
      coverSrc.value = ''
      return
    }

    // The heart/liked list has its own icon and never shows artwork.
    if (list.id === 0) {
      coverSrc.value = ''
      return
    }

    if (list.coverUrl && list.coverUrl.trim() !== '') {
      // Persisted values may predate the scheme whitelist (or have been
      // tampered with) — never request a disallowed reference.
      coverSrc.value = isSafeCoverSource(list.coverUrl) ? getCoverSrc(list.coverUrl) : DEFAULT_COVER
      return
    }

    const songs = list.data ?? []
    // Playlists hold snapshots of songs, so metadata can be stale; consult the
    // live library entry too before falling back to a web lookup.
    const library = new Map(appStore.getAllSongs().map((song) => [song.id, song]))
    const withArt = songs.find((song) => {
      const uri = (song.albumArtUri || library.get(song.id)?.albumArtUri || '').trim()
      return uri !== '' && isSafeCoverSource(uri)
    })
    if (withArt) {
      const uri = (withArt.albumArtUri || library.get(withArt.id)?.albumArtUri || '').trim()
      coverSrc.value = getCoverSrc(uri)
      return
    }

    if (!enabled || !appStore.getCanFetchCoverFromWeb() || songs.length === 0) {
      coverSrc.value = DEFAULT_COVER
      return
    }

    abortController = new AbortController()
    const controller = abortController
    try {
      const webCover = await fetchCoverFromWeb(
        songs[0].title,
        songs[0].artist || '',
        controller.signal
      )
      if (!controller.signal.aborted) coverSrc.value = webCover || DEFAULT_COVER
    } catch {
      if (!controller.signal.aborted) coverSrc.value = DEFAULT_COVER
    }
  }

  watch(playlist, resolve, { immediate: true, deep: true })

  onUnmounted(() => {
    abortController?.abort()
    abortController = null
  })

  return { coverSrc, resolve }
}
