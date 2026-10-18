import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAudioPermission,
  checkMediaPermissions,
  requestAudioPermission,
  requestMediaPermissions,
} from '@/utils/permission'
import { mockMethod, resetPlugins } from '../helpers/capacitor'

const mediaStore = (method: string, impl?: any) => mockMethod('CapacitorMediaStore', method, impl)

beforeEach(() => {
  resetPlugins()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requestMediaPermissions', () => {
  it('requests audio, photo and video permissions', async () => {
    const request = mediaStore('requestPermissions', () => ({
      audio: 'granted',
      photo: 'granted',
      video: 'denied',
    }))

    const result = await requestMediaPermissions()

    expect(request).toHaveBeenCalledWith({ types: ['audio', 'photo', 'video'] })
    expect(result).toEqual({ audio: true, photo: true, video: false })
  })

  it('accepts a flat "granted" status for every type', async () => {
    mediaStore('requestPermissions', () => 'granted')
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: true,
      photo: true,
      video: true,
    })
  })

  it('accepts a flat "denied" status', async () => {
    mediaStore('requestPermissions', () => 'denied')
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: false,
      photo: false,
      video: false,
    })
  })

  it('reads a nested read/status fallback', async () => {
    mediaStore('requestPermissions', () => ({ read: 'granted' }))
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: true,
      photo: true,
      video: true,
    })

    mediaStore('requestPermissions', () => ({ status: 'denied' }))
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: false,
      photo: false,
      video: false,
    })
  })

  it('treats unknown shapes as not granted', async () => {
    mediaStore('requestPermissions', () => ({ audio: 'prompt' }))
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: false,
      photo: false,
      video: false,
    })

    mediaStore('requestPermissions', () => null)
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: false,
      photo: false,
      video: false,
    })
  })

  it('reports all denied when the plugin throws', async () => {
    mediaStore('requestPermissions', () => Promise.reject(new Error('boom')))
    await expect(requestMediaPermissions()).resolves.toEqual({
      audio: false,
      photo: false,
      video: false,
    })
  })
})

describe('checkMediaPermissions', () => {
  it('maps the plugin status', async () => {
    mediaStore('checkPermissions', () => ({ audio: 'granted', photo: 'denied' }))
    // With no per-type key, the fallback scan finds a granted audio flag.
    await expect(checkMediaPermissions()).resolves.toEqual({
      audio: true,
      photo: false,
      video: true,
    })
  })

  it('reports all denied when the check throws', async () => {
    mediaStore('checkPermissions', () => Promise.reject(new Error('boom')))
    await expect(checkMediaPermissions()).resolves.toEqual({
      audio: false,
      photo: false,
      video: false,
    })
  })
})

describe('audio helpers', () => {
  it('requestAudioPermission returns only the audio flag', async () => {
    mediaStore('requestPermissions', () => ({ audio: 'granted', photo: 'denied' }))
    await expect(requestAudioPermission()).resolves.toBe(true)
  })

  it('checkAudioPermission returns only the audio flag', async () => {
    mediaStore('checkPermissions', () => ({ audio: 'denied', photo: 'granted' }))
    await expect(checkAudioPermission()).resolves.toBe(false)
  })
})
