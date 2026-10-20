import { describe, expect, it } from 'vitest'

// Eagerly load every locale file so newly added languages are covered automatically.
const localeModules = import.meta.glob('@/locales/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

describe('locales', () => {
  const locales = Object.entries(localeModules).map(([path, messages]) => ({
    // ".../en-US.json" -> "en-US"
    name: path.match(/([^/]+)\.json$/)![1],
    keys: new Set(flattenKeys(messages)),
  }))

  it('has at least one locale file', () => {
    expect(locales.length).toBeGreaterThan(0)
  })

  it('every locale contains all keys in the union of all locales', () => {
    const union = new Set<string>()
    for (const locale of locales) {
      for (const key of locale.keys) union.add(key)
    }

    for (const locale of locales) {
      const missing = [...union].filter((key) => !locale.keys.has(key))
      expect(missing, `${locale.name} is missing keys`).toEqual([])
    }
  })
})
