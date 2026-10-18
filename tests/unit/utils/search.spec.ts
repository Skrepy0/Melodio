import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useSongSearch, usePlaylistSearchEnhanced } from '@/utils/search'
import { makePlaylist, makeSong } from '../helpers/factories'

const songs = [
  makeSong({ id: '1', title: '夜曲', artist: '周杰伦', album: '十一月的萧邦' }),
  makeSong({ id: '2', title: 'Hello', artist: 'Adele', album: '25' }),
  makeSong({ id: '3', title: '晴天', artist: '周杰伦', album: '叶惠美' }),
  makeSong({ id: '4', title: 'Café del Mar', artist: 'Various', album: 'Chill' }),
]

describe('useSongSearch', () => {
  it('returns the full list for an empty keyword', () => {
    const result = useSongSearch(ref('   '), ref(songs), false)
    expect(result.value).toEqual(songs)
  })

  it('accepts a plain array as well as a ref', () => {
    const result = useSongSearch(ref('hello'), songs, false)
    expect(result.value.map((s) => s.id)).toEqual(['2'])
  })

  it('matches title, artist and album case-insensitively', () => {
    expect(useSongSearch(ref('HELLO'), ref(songs), false).value.map((s) => s.id)).toEqual(['2'])
    expect(useSongSearch(ref('周杰伦'), ref(songs), false).value.map((s) => s.id)).toEqual([
      '1',
      '3',
    ])
    expect(useSongSearch(ref('25'), ref(songs), false).value.map((s) => s.id)).toEqual(['2'])
  })

  it('strips punctuation before comparing', () => {
    const result = useSongSearch(ref('café del mar!'), ref(songs), false)
    expect(result.value.map((s) => s.id)).toEqual(['4'])
  })

  it('normalises full-width characters', () => {
    const result = useSongSearch(ref('ＨＥＬＬＯ'), ref(songs), false)
    expect(result.value.map((s) => s.id)).toEqual(['2'])
  })

  it('uses pinyin matching when enabled', () => {
    const result = useSongSearch(ref('yeqv'), ref(songs), true)
    expect(result.value.map((s) => s.id)).toEqual(['1'])
  })

  it('recomputes when the keyword changes', () => {
    const keyword = ref('')
    const result = useSongSearch(keyword, ref(songs), false)
    expect(result.value).toHaveLength(4)
    keyword.value = '晴天'
    expect(result.value.map((s) => s.id)).toEqual(['3'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(useSongSearch(ref('zzz'), ref(songs), false).value).toEqual([])
  })
})

describe('usePlaylistSearchEnhanced', () => {
  const playlists = [
    makePlaylist({ id: 1, name: 'Road Trip', description: 'highway songs' }),
    makePlaylist({ id: 2, name: '专注', description: '' }),
    makePlaylist({ id: 3, name: 'Sleep', description: 'calm' }),
  ]

  it('returns everything for an empty keyword', () => {
    expect(usePlaylistSearchEnhanced(ref(''), playlists, false).value).toEqual(playlists)
  })

  it('matches the name', () => {
    expect(
      usePlaylistSearchEnhanced(ref('sleep'), ref(playlists), false).value.map((p) => p.id)
    ).toEqual([3])
  })

  it('matches the description', () => {
    expect(
      usePlaylistSearchEnhanced(ref('highway'), ref(playlists), false).value.map((p) => p.id)
    ).toEqual([1])
  })

  it('uses pinyin matching when enabled', () => {
    const result = usePlaylistSearchEnhanced(ref('zhuanzhu'), ref(playlists), true)
    expect(result.value.map((p) => p.id)).toEqual([2])
  })

  it('tolerates playlists without a description', () => {
    const result = usePlaylistSearchEnhanced(
      ref('anything'),
      [makePlaylist({ id: 9, name: 'anything', description: undefined as any })],
      false
    )
    expect(result.value.map((p) => p.id)).toEqual([9])
  })
})
