import { computed, ComputedRef, Ref } from 'vue'
import { Playlist, Song } from './interface'
import PinyinMatch from 'pinyin-match'

function normalizeString(str: string, removePunctuation: boolean = true): string {
  if (!str) return ''
  let normalized = str.replace(/[\uff01-\uff5e]/g, (ch) => {
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  })
  normalized = normalized.toLowerCase()
  if (removePunctuation) {
    normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, '')
  }
  return normalized
}

export function useSongSearch(
  keywords: Ref<string>,
  songs: Ref<Song[]> | Song[],
  usePinyin: boolean
): ComputedRef<Song[]> {
  return computed(() => {
    const rawKw = keywords.value.trim()
    if (!rawKw) return Array.isArray(songs) ? songs : songs.value

    const songList = Array.isArray(songs) ? songs : songs.value

    if (usePinyin) {
      return songList.filter((song) => {
        return (
          PinyinMatch.match(song.title, rawKw) ||
          PinyinMatch.match(song.artist, rawKw) ||
          PinyinMatch.match(song.album, rawKw)
        )
      })
    } else {
      const kw = normalizeString(rawKw)
      return songList.filter((song) => {
        return (
          normalizeString(song.title).includes(kw) ||
          normalizeString(song.artist).includes(kw) ||
          normalizeString(song.album).includes(kw)
        )
      })
    }
  })
}

export function usePlaylistSearchEnhanced(
  keyword: Ref<string>,
  playlists: Ref<Playlist[]> | Playlist[],
  usePinyin: boolean
): ComputedRef<Playlist[]> {
  return computed(() => {
    const rawKw = keyword.value.trim()
    if (!rawKw) return Array.isArray(playlists) ? playlists : playlists.value

    const list = Array.isArray(playlists) ? playlists : playlists.value

    if (usePinyin) {
      return list.filter((playlist) => {
        return (
          PinyinMatch.match(playlist.name, rawKw) ||
          (playlist.description && PinyinMatch.match(playlist.description, rawKw))
        )
      })
    } else {
      const kw = normalizeString(rawKw)
      return list.filter((playlist) => {
        return (
          normalizeString(playlist.name).includes(kw) ||
          (playlist.description && normalizeString(playlist.description).includes(kw))
        )
      })
    }
  })
}
