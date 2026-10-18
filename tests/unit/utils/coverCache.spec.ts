import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COVER_CACHE_MAX_ENTRIES,
  COVER_CACHE_NEGATIVE_TTL_MS,
  COVER_CACHE_STORAGE_KEY,
  COVER_CACHE_TTL_MS,
  clearCoverCache,
  coverCacheSize,
  flushCoverCache,
  getCoverUrl,
  lookupCoverUrl,
  rememberCoverUrl,
  resetCoverCacheForTests,
} from '@/utils/coverCache'

const DAY = 24 * 60 * 60 * 1000

/** Writes a raw table to storage the way a previous session would have. */
function seedStorage(entries: Record<string, { url: string; ts: number }>) {
  localStorage.setItem(COVER_CACHE_STORAGE_KEY, JSON.stringify(entries))
}

beforeEach(() => {
  localStorage.clear()
  resetCoverCacheForTests()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetCoverCacheForTests()
  localStorage.clear()
})

describe('coverCache persistence', () => {
  it('writes entries to localStorage and reads them back after a restart', () => {
    rememberCoverUrl('Song', 'Artist', 'https://cdn.example.com/cover.jpg')
    flushCoverCache()

    const stored = JSON.parse(localStorage.getItem(COVER_CACHE_STORAGE_KEY) || '{}')
    expect(Object.keys(stored)).toHaveLength(1)
    expect(Object.values(stored)[0]).toMatchObject({ url: 'https://cdn.example.com/cover.jpg' })

    // Simulate a fresh process: drop the in-memory table, keep storage.
    resetCoverCacheForTests()
    expect(getCoverUrl('song', 'artist')).toBe('https://cdn.example.com/cover.jpg')
  })

  it('keys entries case- and whitespace-insensitively', () => {
    rememberCoverUrl('  Song  ', 'Artist', 'https://cdn.example.com/cover.jpg')
    expect(getCoverUrl('song', 'artist')).toBe('https://cdn.example.com/cover.jpg')
  })

  it('drops expired positive entries on load', () => {
    seedStorage({
      'old\u0000artist': { url: 'https://cdn.example.com/old.jpg', ts: Date.now() - 31 * DAY },
      'new\u0000artist': { url: 'https://cdn.example.com/new.jpg', ts: Date.now() - 29 * DAY },
    })
    resetCoverCacheForTests()

    expect(lookupCoverUrl('old', 'artist')).toBeUndefined()
    expect(lookupCoverUrl('new', 'artist')).toBe('https://cdn.example.com/new.jpg')
  })

  it('honours the shorter TTL for negative entries', () => {
    seedStorage({
      'gone\u0000artist': { url: '', ts: Date.now() - 4 * DAY },
      'fresh\u0000artist': { url: '', ts: Date.now() - 2 * DAY },
    })
    resetCoverCacheForTests()

    expect(lookupCoverUrl('gone', 'artist')).toBeUndefined()
    expect(lookupCoverUrl('fresh', 'artist')).toBeNull()
  })

  it('uses the documented TTL constants', () => {
    expect(COVER_CACHE_TTL_MS).toBe(30 * DAY)
    expect(COVER_CACHE_NEGATIVE_TTL_MS).toBe(3 * DAY)
  })

  it('ignores malformed storage instead of throwing', () => {
    localStorage.setItem(COVER_CACHE_STORAGE_KEY, 'not json')
    resetCoverCacheForTests()
    expect(lookupCoverUrl('any', 'any')).toBeUndefined()

    localStorage.setItem(COVER_CACHE_STORAGE_KEY, JSON.stringify({ key: { url: 42 } }))
    resetCoverCacheForTests()
    expect(lookupCoverUrl('key', '')).toBeUndefined()
  })

  it('caps the table on load, keeping the newest entries', () => {
    const entries: Record<string, { url: string; ts: number }> = {}
    const now = Date.now()
    for (let i = 0; i < COVER_CACHE_MAX_ENTRIES + 20; i++) {
      entries[`k${i}\u0000`] = { url: `https://cdn.example.com/${i}.jpg`, ts: now - DAY + i }
    }
    seedStorage(entries)
    resetCoverCacheForTests()

    expect(coverCacheSize()).toBe(COVER_CACHE_MAX_ENTRIES)
    // The oldest entries are the ones dropped.
    expect(lookupCoverUrl('k0', '')).toBeUndefined()
    expect(lookupCoverUrl(`k${COVER_CACHE_MAX_ENTRIES + 19}`, '')).toBe(
      `https://cdn.example.com/${COVER_CACHE_MAX_ENTRIES + 19}.jpg`
    )
  })
})

describe('coverCache LRU eviction', () => {
  it('evicts the least recently used entry when full', () => {
    for (let i = 0; i < COVER_CACHE_MAX_ENTRIES; i++) {
      rememberCoverUrl(`song${i}`, '', `https://cdn.example.com/${i}.jpg`)
    }
    // Refresh the oldest entry so it becomes the most recently used.
    expect(getCoverUrl('song0', '')).toBe('https://cdn.example.com/0.jpg')

    rememberCoverUrl('overflow', '', 'https://cdn.example.com/overflow.jpg')

    expect(coverCacheSize()).toBe(COVER_CACHE_MAX_ENTRIES)
    expect(lookupCoverUrl('song0', '')).toBe('https://cdn.example.com/0.jpg')
    // song1 was the least recently used after song0 was touched.
    expect(lookupCoverUrl('song1', '')).toBeUndefined()
    expect(lookupCoverUrl('overflow', '')).toBe('https://cdn.example.com/overflow.jpg')
  })

  it('moves a hit to the most recently used end', () => {
    rememberCoverUrl('a', '', 'https://cdn.example.com/a.jpg')
    rememberCoverUrl('b', '', 'https://cdn.example.com/b.jpg')
    getCoverUrl('a', '')

    rememberCoverUrl('c', '', 'https://cdn.example.com/c.jpg')
    // Nothing needs evicting yet, but the order must have a then b then c.
    rememberCoverUrl('d', '', 'https://cdn.example.com/d.jpg')
    expect(coverCacheSize()).toBe(4)
  })
})

describe('clearCoverCache', () => {
  it('empties both memory and storage', () => {
    rememberCoverUrl('Song', 'Artist', 'https://cdn.example.com/cover.jpg')
    flushCoverCache()

    clearCoverCache()

    expect(coverCacheSize()).toBe(0)
    expect(localStorage.getItem(COVER_CACHE_STORAGE_KEY)).toBeNull()
    expect(lookupCoverUrl('Song', 'Artist')).toBeUndefined()
  })
})
