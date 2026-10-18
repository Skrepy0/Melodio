import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { showSongInfo } from '@/utils/createInfo'
import { showPlaylistCoverPicker } from '@/utils/createPlaylistCoverPicker'
import { useAppStore } from '@/stores/app'
import { makeOnlineSong, makePlaylist, makeSong } from '../helpers/factories'
import { resetPlugins } from '../helpers/capacitor'
import { dialogButtons, flushDom, installDialogContext, queryDialog } from '../helpers/dialogs'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('@/utils/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/functions')>()
  return { ...actual, fetchCoverFromWeb: vi.fn(async () => null) }
})

import toast from '@/utils/createToast'
import { fetchCoverFromWeb } from '@/utils/functions'

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
  vi.mocked(fetchCoverFromWeb).mockResolvedValue(null)
  installDialogContext()
})

afterEach(async () => {
  await flushDom()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function openInfo(song: any) {
  const pending = showSongInfo(song)
  return pending
}

describe('InfoDialog (showSongInfo)', () => {
  it('lists local song metadata', async () => {
    void openInfo(
      makeSong({
        title: '夜曲',
        artist: '周杰伦',
        album: '十一月的萧邦',
        track: 3,
        year: 2005,
        duration: 225000,
        size: 5 * 1024 * 1024,
        mediaType: 'audio',
      })
    )
    await nextTick()

    expect(queryDialog('.info-title')).toBeTruthy()
    const text = queryDialog('.info-body')?.textContent ?? ''
    expect(text).toContain('夜曲')
    expect(text).toContain('周杰伦')
    expect(text).toContain('十一月的萧邦')
    expect(text).toContain('3:45')
    expect(text).toContain('5.0 MB')
    expect(text).toContain('audio')
  })

  it('lists online song metadata', async () => {
    void openInfo(makeOnlineSong({ name: 'Online', singers: 'Singer', duration: 200 }))
    await nextTick()

    const text = queryDialog('.info-body')?.textContent ?? ''
    expect(text).toContain('Online')
    expect(text).toContain('Singer')
    expect(text).toContain('3:20')
    expect(text).toContain('2.0 KB')
    expect(text).toContain('mp3')
  })

  it('uses placeholders for missing values', async () => {
    void openInfo(makeSong({ title: '', displayName: '', artist: '', album: '' }))
    await nextTick()
    expect(queryDialog('.info-body')?.textContent).toBeTruthy()
  })

  it('formats durations over an hour', async () => {
    void openInfo(makeSong({ duration: 3_725_000 }))
    await nextTick()
    expect(queryDialog('.info-body')?.textContent).toContain('1:02:05')
  })

  it('closes from the footer button', async () => {
    const pending = openInfo(makeSong())
    await nextTick()

    const footer = Array.from(
      queryDialog('.info-footer')?.querySelectorAll('button') ?? []
    ) as HTMLButtonElement[]
    footer[0].click()
    await expect(pending).resolves.toBe(true)
    await flushDom()
    expect(document.body.querySelector('.info-card')).toBeNull()
  })

  it('closes on Escape', async () => {
    const pending = openInfo(makeSong())
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(pending).resolves.toBe(true)
  })

  it('closes when the overlay is clicked', async () => {
    const pending = openInfo(makeSong())
    await nextTick()

    queryDialog('.info-overlay')!.click()
    await expect(pending).resolves.toBe(true)
  })
})

describe('PlaylistCoverPicker (showPlaylistCoverPicker)', () => {
  function picker(playlist = makePlaylist({ id: 1, name: 'A', data: [] })) {
    return showPlaylistCoverPicker(playlist)
  }

  it('shows an empty state without song artwork', async () => {
    const pending = picker(makePlaylist({ data: [] }))
    await nextTick()

    expect(queryDialog('.cover-picker-container')).toBeTruthy()
    expect(queryDialog('.empty-hint')).toBeTruthy()
    pending.then(() => {})
    dialogButtons()
      .find((b) => b.classList.contains('cancel'))!
      .click()
    await expect(pending).resolves.toBeUndefined()
  })

  it('offers embedded artwork from songs', async () => {
    const store = useAppStore()
    store.setCanFetchCoverFromWeb(false)
    const song = makeSong({ albumArtUri: 'https://cdn.example.com/art.jpg' })
    const pending = picker(makePlaylist({ data: [song] }))
    await nextTick()

    const rows = queryDialog('.song-cover-list')?.querySelectorAll('.song-cover-row') ?? []
    expect(rows).toHaveLength(1)
    expect((rows[0] as HTMLButtonElement).disabled).toBe(false)
    ;(rows[0] as HTMLButtonElement).click()
    await expect(pending).resolves.toBe('https://cdn.example.com/art.jpg')
  })

  it('falls back to the live library artwork', async () => {
    const store = useAppStore()
    store.setCanFetchCoverFromWeb(false)
    const song = makeSong({ id: 's1', albumArtUri: '' })
    store.setAllSongs([makeSong({ id: 's1', albumArtUri: 'https://cdn.example.com/live.jpg' })])

    const pending = picker(makePlaylist({ data: [song] }))
    await nextTick()

    const row = queryDialog('.song-cover-row') as HTMLButtonElement
    expect(row.disabled).toBe(false)
    row.click()
    await expect(pending).resolves.toBe('https://cdn.example.com/live.jpg')
  })

  it('marks rows without a cover as unavailable', async () => {
    const store = useAppStore()
    store.setCanFetchCoverFromWeb(false)
    const pending = picker(makePlaylist({ data: [makeSong({ albumArtUri: '' })] }))
    await nextTick()

    const row = queryDialog('.song-cover-row') as HTMLButtonElement
    expect(row.disabled).toBe(true)
    expect(queryDialog('.song-cover-list')?.textContent).toContain('暂无封面')
    pending.then(() => {})
    dialogButtons()
      .find((b) => b.classList.contains('cancel'))!
      .click()
    await expect(pending).resolves.toBeUndefined()
  })

  it('resolves with a web lookup result', async () => {
    const store = useAppStore()
    store.setCanFetchCoverFromWeb(true)
    vi.mocked(fetchCoverFromWeb).mockResolvedValue('https://web.example.com/c.jpg')

    const pending = picker(makePlaylist({ data: [makeSong({ albumArtUri: '' })] }))
    await vi.waitFor(() => {
      const row = queryDialog('.song-cover-row') as HTMLButtonElement
      expect(row?.disabled).toBe(false)
    })
    ;(queryDialog('.song-cover-row') as HTMLButtonElement).click()
    await expect(pending).resolves.toBe('https://web.example.com/c.jpg')
  })

  it('resets the cover to the default', async () => {
    const pending = picker(
      makePlaylist({ data: [], coverUrl: 'https://cdn.example.com/custom.jpg' })
    )
    await nextTick()

    const reset = dialogButtons().find((b) => b.classList.contains('reset'))!
    reset.click()
    await expect(pending).resolves.toBeNull()
  })

  it('hides the reset button without a custom cover', async () => {
    const pending = picker(makePlaylist({ data: [], coverUrl: '' }))
    await nextTick()
    expect(dialogButtons().find((b) => b.classList.contains('reset'))).toBeUndefined()
    pending.then(() => {})
    dialogButtons()
      .find((b) => b.classList.contains('cancel'))!
      .click()
    await pending
  })

  it('cancels from the close button', async () => {
    const pending = picker()
    await nextTick()
    ;(queryDialog('.close-btn') as HTMLButtonElement).click()
    await expect(pending).resolves.toBeUndefined()
  })

  it('cancels on overlay click', async () => {
    const pending = picker()
    await nextTick()
    ;(document.body.querySelector('.cover-picker-overlay') as HTMLElement).click()
    await expect(pending).resolves.toBeUndefined()
  })

  it('rejects non-image uploads', async () => {
    const pending = picker()
    await nextTick()

    const input = queryDialog('.file-input') as HTMLInputElement
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change'))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())

    dialogButtons()
      .find((b) => b.classList.contains('cancel'))!
      .click()
    await pending
  })

  it('reads an uploaded image into a data URL', async () => {
    const pending = picker()
    await nextTick()

    // jsdom has neither FileReader decoding nor Image loading; stub both so the
    // downscale path resolves deterministically.
    class FakeReader {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      result = 'data:image/png;base64,AAA'
      readAsDataURL() {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('FileReader', FakeReader)

    class FakeImage {
      width = 512
      height = 256
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const drawImage = vi.fn()
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,SMALL')
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as any
    HTMLCanvasElement.prototype.toDataURL = toDataURL

    try {
      const input = queryDialog('.file-input') as HTMLInputElement
      const file = new File(['img'], 'a.png', { type: 'image/png' })
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      input.dispatchEvent(new Event('change'))

      await expect(pending).resolves.toBe('data:image/jpeg;base64,SMALL')
      expect(drawImage).toHaveBeenCalled()
      expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85)
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      vi.unstubAllGlobals()
    }
  })
})
