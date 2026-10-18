import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { exportLocalStorage, importLocalStorage } from '@/utils/ioData'
import { audio } from '@/utils/createAudio'
import { useAppStore } from '@/stores/app'
import { freshPinia } from '../helpers/store'

describe('exportLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    freshPinia()
    vi.restoreAllMocks()
  })

  it('returns nothing on the web (no download path is implemented)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    localStorage.setItem('a', JSON.stringify({ x: 1 }))
    await expect(exportLocalStorage()).resolves.toBeUndefined()
  })

  it('serialises parsed values and falls back to raw strings for invalid JSON', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    localStorage.setItem('obj', JSON.stringify({ x: 1 }))
    localStorage.setItem('raw', 'not-json')
    const save = vi.spyOn(audio, 'saveFile').mockResolvedValue('file:///backup.json')

    await exportLocalStorage(['obj', 'raw'], 'backup')

    expect(save).toHaveBeenCalledTimes(1)
    const [fileName, json] = save.mock.calls[0]
    expect(fileName).toBe('backup_1.json')
    expect(JSON.parse(json)).toEqual({ obj: { x: 1 }, raw: 'not-json' })
  })

  it('exports every localStorage key when no list is given', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    localStorage.setItem('one', '"a"')
    localStorage.setItem('two', '2')
    const save = vi.spyOn(audio, 'saveFile').mockResolvedValue('file:///x.json')

    await exportLocalStorage(undefined, 'all')

    const parsed = JSON.parse(save.mock.calls[0][1])
    expect(parsed.one).toBe('a')
    expect(parsed.two).toBe(2)
  })

  it('increments the per-name export counter', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    localStorage.setItem('exportCounter_backup', '3')
    const save = vi.spyOn(audio, 'saveFile').mockResolvedValue('file:///x.json')

    await exportLocalStorage([], 'backup')

    expect(save.mock.calls[0][0]).toBe('backup_4.json')
    expect(localStorage.getItem('exportCounter_backup')).toBe('4')
  })

  it('propagates save failures', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(audio, 'saveFile').mockRejectedValue(new Error('disk full'))

    await expect(exportLocalStorage([], 'backup')).rejects.toThrow('disk full')
  })
})

describe('importLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    freshPinia()
    vi.restoreAllMocks()
  })

  it('restores object values as JSON and primitives as strings', async () => {
    vi.spyOn(audio, 'openFile').mockResolvedValue(
      JSON.stringify({ obj: { a: 1 }, list: [1, 2], str: 'text', num: 5, flag: false })
    )
    const init = vi.spyOn(useAppStore(), 'init').mockResolvedValue(undefined)

    await importLocalStorage()

    expect(JSON.parse(localStorage.getItem('obj')!)).toEqual({ a: 1 })
    expect(JSON.parse(localStorage.getItem('list')!)).toEqual([1, 2])
    expect(localStorage.getItem('str')).toBe('text')
    expect(localStorage.getItem('num')).toBe('5')
    expect(localStorage.getItem('flag')).toBe('false')
    expect(init).toHaveBeenCalled()
  })

  it('rejects and leaves storage untouched for malformed JSON', async () => {
    localStorage.setItem('keep', 'value')
    vi.spyOn(audio, 'openFile').mockResolvedValue('{not json')

    await expect(importLocalStorage()).rejects.toBeInstanceOf(SyntaxError)
    expect(localStorage.getItem('keep')).toBe('value')
  })

  it('rejects when the file picker is cancelled', async () => {
    vi.spyOn(audio, 'openFile').mockRejectedValue(new Error('cancelled'))
    await expect(importLocalStorage()).rejects.toThrow('cancelled')
  })
})
