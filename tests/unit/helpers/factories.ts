import type { OnlineSong, Playlist, Song } from '@/utils/interface'

export function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    displayName: 'Song One',
    uri: '/music/song1.mp3',
    size: 1024,
    mimeType: 'audio/mpeg',
    dateAdded: 1000,
    dateModified: 1000,
    mediaType: 'audio',
    duration: 180000,
    title: 'Song One',
    artist: 'Artist One',
    album: 'Album One',
    track: 1,
    year: 2024,
    albumArtUri: '',
    ...overrides,
  }
}

export function makeSongs(count: number, prefix = 'song'): Song[] {
  return Array.from({ length: count }, (_, i) =>
    makeSong({
      id: `${prefix}-${i + 1}`,
      title: `${prefix} ${i + 1}`,
      displayName: `${prefix} ${i + 1}`,
      uri: `/music/${prefix}${i + 1}.mp3`,
      duration: (i + 1) * 60000,
    })
  )
}

export function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 1,
    name: 'Playlist',
    description: '',
    coverUrl: '',
    songCount: 0,
    data: [],
    ...overrides,
  }
}

export function makeOnlineSong(overrides: Partial<OnlineSong> = {}): OnlineSong {
  return {
    source: 'Kuwo',
    name: 'Online Song',
    singers: 'Online Artist',
    album: 'Online Album',
    ext: 'mp3',
    file_size_bytes: 2048,
    duration: 200,
    lyric: null,
    cover_url: 'https://example.com/cover.jpg',
    download_url: 'https://example.com/song.mp3',
    download_url_status: { ok: true, status_code: 200, reason: [] },
    identifier: 'online-1',
    ...overrides,
  }
}
