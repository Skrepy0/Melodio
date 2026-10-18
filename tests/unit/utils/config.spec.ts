import { describe, expect, it } from 'vitest'
import { USER_AGENT, musicClients, musicClientsConfig } from '@/config'

describe('config', () => {
  it('exposes a versioned user agent', () => {
    expect(USER_AGENT).toMatch(
      /^Melodio\/\d+\.\d+\.\d+ \(https:\/\/github\.com\/Skrepy0\/Melodio\)$/
    )
  })

  it('maps every configured client to its backend class name', () => {
    const keys = Object.keys(musicClientsConfig)
    expect(keys.length).toBeGreaterThan(0)
    expect(Object.keys(musicClients).sort()).toEqual(keys.sort())
    for (const key of keys) {
      const config = (musicClientsConfig as any)[key]
      expect(musicClients[key as keyof typeof musicClients]).toBe(config.name)
      expect(config.displayName['zh-CN']).toBeTruthy()
      expect(config.displayName['en-US']).toBeTruthy()
    }
  })

  it('ships the known client set', () => {
    expect(musicClients.Kugou).toBe('KugouMusicClient')
    expect(musicClients.Netease).toBe('NeteaseMusicClient')
    expect(musicClients.Migu).toBe('MiguMusicClient')
  })
})
