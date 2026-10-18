import { describe, expect, it } from 'vitest'
import { getContrastText, hexToRgb, mixColors } from '@/utils/color'

describe('hexToRgb', () => {
  it('parses 6-digit hex with and without the leading #', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0])
    expect(hexToRgb('ff8800')).toEqual([255, 136, 0])
  })

  it('is case-insensitive', () => {
    expect(hexToRgb('#AABBCC')).toEqual([170, 187, 204])
  })

  it('returns black for malformed input instead of throwing', () => {
    for (const bad of ['', '#fff', 'not-a-color', '#gggggg', '#12345', '#1234567']) {
      expect(hexToRgb(bad)).toEqual([0, 0, 0])
    }
  })
})

describe('mixColors', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('blends halfway between two colours', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixColors('#ff0000', '#0000ff', 0.5)).toBe('#800080')
  })

  it('rounds to whole channel values', () => {
    expect(mixColors('#000000', '#ffffff', 0.25)).toBe('#404040')
  })

  it('treats unparseable colours as black', () => {
    expect(mixColors('nope', '#ffffff', 0.5)).toBe('#808080')
  })

  it('clamps values outside 0..1', () => {
    expect(mixColors('#000000', '#ffffff', -1)).toBe('#000000')
    expect(mixColors('#000000', '#ffffff', 2)).toBe('#ffffff')
  })
})

describe('getContrastText', () => {
  it('uses black text on light colours', () => {
    expect(getContrastText('#ffffff')).toBe('#000000')
    expect(getContrastText('#f5f5f5')).toBe('#000000')
  })

  it('uses white text on dark colours', () => {
    expect(getContrastText('#000000')).toBe('#ffffff')
    expect(getContrastText('#3d63dd')).toBe('#ffffff')
  })

  it('treats invalid input as black (white text)', () => {
    expect(getContrastText('bogus')).toBe('#ffffff')
  })
})
