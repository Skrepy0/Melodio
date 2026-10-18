import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import toast from '@/utils/createToast'
import { showPlaylistSelector } from '@/utils/createPlaylistSelector'
import { makePlaylist, makeSongs } from '../helpers/factories'
import { dialogButtons, flushDom, installDialogContext, queryDialog } from '../helpers/dialogs'

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, fetchCoverFromWeb: vi.fn(async () => null) }
})

beforeEach(() => {
  // The toast helper keeps a module-level singleton, so its host element must
  // stay in the document between tests; dialogs clean themselves up.
  installDialogContext()
})

afterEach(async () => {
  // Let dialog cleanups (which run on their resolved promises) finish.
  await flushDom()
  vi.restoreAllMocks()
})

describe('createToast', () => {
  it('renders the message and hides after the duration', async () => {
    toast.success('Saved', 20)
    await nextTick()

    expect(document.body.querySelector('.toast')?.textContent).toContain('Saved')
    expect(document.body.querySelector('.toast')?.className).toContain('success')

    await flushDom(100)
    expect(document.body.querySelector('.toast')).toBeNull()
  })

  it('reuses the same element for consecutive toasts', async () => {
    toast.info('First', 500)
    await nextTick()
    toast.error('Second', 500)
    await nextTick()

    const toasts = document.body.querySelectorAll('.toast')
    expect(toasts).toHaveLength(1)
    expect(toasts[0].textContent).toContain('Second')
    expect(toasts[0].className).toContain('error')
  })

  it('restarts the timer for a new message', async () => {
    toast.info('First', 120)
    await nextTick()
    await flushDom(80)

    toast.info('Second', 120)
    await nextTick()
    await flushDom(80)
    expect(document.body.querySelector('.toast')?.textContent).toContain('Second')

    await flushDom(100)
    expect(document.body.querySelector('.toast')).toBeNull()
  })

  it('supports every toast type', async () => {
    for (const [method, type] of [
      ['success', 'success'],
      ['error', 'error'],
      ['warning', 'warning'],
      ['info', 'info'],
    ] as const) {
      toast[method]('msg', 500)
      await nextTick()
      expect(document.body.querySelector('.toast')?.className).toContain(type)
    }
  })
})

describe('showPlaylistSelector', () => {
  it('lists the playlists and resolves the chosen one', async () => {
    const playlists = [
      makePlaylist({ id: 0, songCount: 2 }),
      makePlaylist({ id: 1, name: 'Road Trip', description: 'highway', songCount: 4 }),
      makePlaylist({ id: 2, name: 'Focus', description: '', songCount: 3 }),
    ]
    const pending = showPlaylistSelector(playlists, 'Add to', 'Liked', 'Your favourites')
    await nextTick()

    expect(queryDialog('h3')?.textContent).toBe('Add to')
    const rows = document.querySelectorAll('.playlist-selector-item')
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain('Liked')
    expect(rows[0].textContent).toContain('Your favourites')
    expect(rows[1].textContent).toContain('Road Trip')
    expect(rows[1].textContent).toContain('highway')
    ;(rows[1] as HTMLElement).click()
    await expect(pending).resolves.toEqual(playlists[1])
    await flushDom()
    expect(document.body.querySelector('.playlist-selector-container')).toBeNull()
  })

  it('falls back to the song count when a description is missing', async () => {
    void showPlaylistSelector(
      [makePlaylist({ id: 2, name: 'Focus', description: '', songCount: 3 })],
      'Add to',
      'Liked',
      ''
    )
    await nextTick()
    expect(document.querySelector('.playlist-selector-item')?.textContent).toContain('3')
  })

  it('resolves null when closed', async () => {
    const pending = showPlaylistSelector([makePlaylist()], 'Add to', 'Liked', '')
    await nextTick()
    dialogButtons()[0].click()
    await expect(pending).resolves.toBeNull()
  })

  it('resolves null on Escape', async () => {
    const pending = showPlaylistSelector([makePlaylist()], 'Add to', 'Liked', '')
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(pending).resolves.toBeNull()
  })

  it('renders an empty list without crashing', async () => {
    void showPlaylistSelector([], 'Add to', 'Liked', '')
    await nextTick()
    expect(document.querySelectorAll('.playlist-selector-item')).toHaveLength(0)
  })

  it('renders the like list with its icon instead of a cover', async () => {
    void showPlaylistSelector(
      [makePlaylist({ id: 0, data: makeSongs(2), songCount: 2 })],
      'Add to',
      'Liked',
      ''
    )
    await nextTick()
    const row = document.querySelector('.playlist-selector-item')!
    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('svg')).toBeTruthy()
  })
})
