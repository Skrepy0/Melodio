import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useCoverColor } from '@/composables/useCoverColor'

const PIXELS = new Uint8ClampedArray(24 * 24 * 4)

class FakeImage {
  crossOrigin = ''
  decoding = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''
  set src(value: string) {
    this._src = value
    // Resolve on the next tick so the composable's await sees it.
    queueMicrotask(() => {
      if (value.includes('broken')) this.onerror?.()
      else this.onload?.()
    })
  }
  get src() {
    return this._src
  }
}

const context2d = {
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: PIXELS })),
}

function mountColor(cover: ReturnType<typeof ref<string>>) {
  let api: ReturnType<typeof useCoverColor>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCoverColor(cover as any)
        return () => h('div')
      },
    })
  )
  return { wrapper, api: api! }
}

function fill(r: number, g: number, b: number, alpha = 255) {
  for (let i = 0; i < PIXELS.length; i += 4) {
    PIXELS[i] = r
    PIXELS[i + 1] = g
    PIXELS[i + 2] = b
    PIXELS[i + 3] = alpha
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context2d as any)
  context2d.drawImage.mockClear()
  context2d.getImageData.mockClear()
  fill(120, 40, 200)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useCoverColor', () => {
  it('extracts a colour from the artwork', async () => {
    const { api } = mountColor(ref('https://cdn.example.com/cover-a.jpg'))
    await vi.waitFor(() => expect(api.rgb.value).not.toBeNull())

    const [r, g, b] = api.rgb.value!
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(255)
    expect([r, g, b]).not.toEqual([120, 40, 200])
    expect(context2d.drawImage).toHaveBeenCalled()
  })

  it('returns null for an empty source', async () => {
    const { api } = mountColor(ref(''))
    await nextTick()
    expect(api.rgb.value).toBeNull()
    expect(context2d.drawImage).not.toHaveBeenCalled()
  })

  it('skips SVG data URLs', async () => {
    const { api } = mountColor(ref('data:image/svg+xml,<svg/>'))
    await nextTick()
    expect(api.rgb.value).toBeNull()
    expect(context2d.drawImage).not.toHaveBeenCalled()
  })

  it('returns null when every pixel is near-white or near-black', async () => {
    fill(255, 255, 255)
    const { api } = mountColor(ref('https://cdn.example.com/white.jpg'))
    await vi.waitFor(() => expect(context2d.getImageData).toHaveBeenCalled())
    await nextTick()
    expect(api.rgb.value).toBeNull()
  })

  it('ignores transparent pixels', async () => {
    fill(120, 40, 200, 0)
    const { api } = mountColor(ref('https://cdn.example.com/transparent.jpg'))
    await vi.waitFor(() => expect(context2d.getImageData).toHaveBeenCalled())
    await nextTick()
    expect(api.rgb.value).toBeNull()
  })

  it('returns null when the image fails to load', async () => {
    const { api } = mountColor(ref('https://cdn.example.com/broken.jpg'))
    await vi.waitFor(() => expect(api.rgb.value).toBeNull())
    expect(context2d.drawImage).not.toHaveBeenCalled()
  })

  it('caches results per source', async () => {
    const first = mountColor(ref('https://cdn.example.com/shared.jpg'))
    await vi.waitFor(() => expect(first.api.rgb.value).not.toBeNull())
    context2d.drawImage.mockClear()

    const second = mountColor(ref('https://cdn.example.com/shared.jpg'))
    await vi.waitFor(() => expect(second.api.rgb.value).toEqual(first.api.rgb.value))
    expect(context2d.drawImage).not.toHaveBeenCalled()
  })

  it('recomputes when the source changes', async () => {
    const src = ref('https://cdn.example.com/one.jpg')
    const { api } = mountColor(src)
    await vi.waitFor(() => expect(api.rgb.value).not.toBeNull())
    const first = api.rgb.value

    fill(30, 200, 90)
    src.value = 'https://cdn.example.com/two.jpg'
    await vi.waitFor(() => expect(api.rgb.value).not.toEqual(first))
  })
})
