/**
 * Persistent cache of resolved cover URLs.
 *
 * <p>Cover lookups are the slowest part of rendering a queue: three providers,
 * each with its own timeout. Remembering the answer across restarts keeps a
 * library that is already fully resolved from re-querying every track, and a
 * short-lived negative entry keeps offline starts from walking the provider
 * chain for every song.</p>
 *
 * <p>Entries live in an LRU map so a large library cannot grow the cache
 * without bound, and are mirrored to localStorage in batches — writing on every
 * lookup would stringify the whole table on the main thread for each song.</p>
 */

/** localStorage key holding the persisted table. */
export const COVER_CACHE_STORAGE_KEY = 'coverUrlCache'

/** Maximum number of entries kept in memory and on disk. */
export const COVER_CACHE_MAX_ENTRIES = 500

/** How long a successfully resolved URL stays valid. */
export const COVER_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * How long a "no provider knows this track" answer is trusted. Short enough
 * that a track added to a provider later still gets picked up, long enough to
 * cover repeated offline sessions.
 */
export const COVER_CACHE_NEGATIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000

/** Delay before the in-memory table is flushed to localStorage. */
const FLUSH_DELAY_MS = 800

export interface CoverCacheEntry {
  /** Resolved cover URL; an empty string marks a negative (not found) entry. */
  url: string
  /** Epoch milliseconds when the entry was written. */
  ts: number
}

type Table = Map<string, CoverCacheEntry>

let table: Table | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let hideListenerBound = false

/**
 * Flush pending writes when the app is backgrounded or closed. A track that
 * resolves a cover and is then killed within the throttle window would
 * otherwise be looked up again on the next launch.
 */
function bindHideListener() {
  if (hideListenerBound || typeof document === 'undefined') return
  hideListenerBound = true
  const flush = () => {
    if (flushTimer !== null) flushCoverCache()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

const cacheKeyFor = (title: string, artist: string) =>
  `${(title || '').trim().toLowerCase()}\u0000${(artist || '').trim().toLowerCase()}`

const ttlFor = (entry: CoverCacheEntry) =>
  entry.url ? COVER_CACHE_TTL_MS : COVER_CACHE_NEGATIVE_TTL_MS

const isExpired = (entry: CoverCacheEntry, now: number) => now - entry.ts >= ttlFor(entry)

function readStorage(): Table {
  const map: Table = new Map()
  let raw: string | null = null
  try {
    raw = localStorage.getItem(COVER_CACHE_STORAGE_KEY)
  } catch {
    // Private mode / disabled storage: run from memory only.
    return map
  }
  if (!raw) return map

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return map
  }
  if (!parsed || typeof parsed !== 'object') return map

  const now = Date.now()
  const entries = Object.entries(parsed as Record<string, unknown>)
    .filter(([, value]) => {
      if (!value || typeof value !== 'object') return false
      const candidate = value as Partial<CoverCacheEntry>
      return typeof candidate.url === 'string' && typeof candidate.ts === 'number'
    })
    // Drop legacy data-URL entries written by older versions.
    .filter(([, value]) => {
      const url = (value as CoverCacheEntry).url.trim().toLowerCase()
      return !url.startsWith('data:')
    })
    .map(([key, value]) => [key, value as CoverCacheEntry] as const)
    .filter(([, entry]) => !isExpired(entry, now))
    // Newest first, so trimming keeps the most recently written entries.
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, COVER_CACHE_MAX_ENTRIES)

  // Insert oldest first: Map iteration order then matches LRU order.
  for (const [key, entry] of entries.reverse()) {
    map.set(key, entry)
  }
  return map
}

function getTable(): Table {
  if (!table) {
    table = readStorage()
    bindHideListener()
  }
  return table
}

function scheduleFlush() {
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushCoverCache()
  }, FLUSH_DELAY_MS)
  // Do not keep a Node/jsdom process alive just to persist the cache.
  ;(flushTimer as unknown as { unref?: () => void })?.unref?.()
}

/** Writes the table to localStorage now, cancelling any pending flush. */
export function flushCoverCache(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!table) return
  const payload: Record<string, CoverCacheEntry> = {}
  for (const [key, entry] of table) payload[key] = entry
  try {
    localStorage.setItem(COVER_CACHE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded: drop the least recently used half and try once more.
    const keys = [...table.keys()]
    for (const key of keys.slice(0, Math.ceil(keys.length / 2))) table.delete(key)
    try {
      const retry: Record<string, CoverCacheEntry> = {}
      for (const [key, entry] of table) retry[key] = entry
      localStorage.setItem(COVER_CACHE_STORAGE_KEY, JSON.stringify(retry))
    } catch {
      /* still too large — keep the in-memory table only */
    }
  }
}

/** Moves a key to the most-recently-used end. */
function touch(map: Table, key: string): CoverCacheEntry {
  const entry = map.get(key)!
  map.delete(key)
  map.set(key, entry)
  return entry
}

/**
 * Looks a track up in the persistent cache.
 *
 * @returns the cover URL when one is cached, `null` when a still-valid
 *          negative entry says no provider has artwork, and `undefined` when
 *          nothing is known (the caller should query the network).
 */
export function lookupCoverUrl(title: string, artist: string): string | null | undefined {
  const map = getTable()
  const key = cacheKeyFor(title, artist)
  const entry = map.get(key)
  if (!entry) return undefined
  if (isExpired(entry, Date.now())) {
    map.delete(key)
    scheduleFlush()
    return undefined
  }
  touch(map, key)
  return entry.url || null
}

/**
 * The resolved URL for a track, or an empty string. Negative entries and cache
 * misses are indistinguishable here — callers that need the distinction should
 * use {@link lookupCoverUrl}.
 */
export function getCoverUrl(title: string, artist: string): string {
  return lookupCoverUrl(title, artist) || ''
}

/**
 * Records a lookup result. An empty {@code url} stores a negative entry with
 * the shorter TTL.
 */
export function rememberCoverUrl(title: string, artist: string, url: string): void {
  // base64 不 worth 占 localStorage 配额
  const normalized = url.trim().toLowerCase()
  if (normalized.startsWith('data:')) return
  const map = getTable()
  const key = cacheKeyFor(title, artist)
  map.delete(key)
  map.set(key, { url, ts: Date.now() })
  while (map.size > COVER_CACHE_MAX_ENTRIES) {
    const oldest = map.keys().next()
    if (oldest.done) break
    map.delete(oldest.value)
  }
  scheduleFlush()
}

/** Removes every entry, in memory and in storage. */
export function clearCoverCache(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  table = new Map()
  try {
    localStorage.removeItem(COVER_CACHE_STORAGE_KEY)
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/** Number of entries currently held (used by tests and the settings page). */
export function coverCacheSize(): number {
  return getTable().size
}

/** Drops the in-memory table so the next access re-reads storage. */
export function resetCoverCacheForTests(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  table = null
}
