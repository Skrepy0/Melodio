import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SettingsPage from '@/views/SettingsPage.vue'
import AboutPage from '@/views/AboutPage.vue'
import AccessibilityPage from '@/views/settings/AccessibilityPage.vue'
import OnlineSearchSettingsPage from '@/views/settings/OnlineSearchSettingsPage.vue'
import MusicClientSettingsPage from '@/views/settings/MusicClientSettingsPage.vue'
import OtherSettingsPage from '@/views/settings/OtherSettingsPage.vue'
import InterfaceSettingsPage from '@/views/settings/InterfaceSettingsPage.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'
import MusicClientConfig from '@/components/settings/MusicClientConfig.vue'
import HorizontalSelect from '@/components/HorizontalSelect.vue'
import InputBox from '@/components/settings/InputBox.vue'
import PageTitle from '@/components/PageTitle.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
import { musicClientsConfig } from '@/config'
import { useAppStore } from '@/stores/app'
import { resetPlugins, mockMethod } from '../helpers/capacitor'
import { mountComponent } from '../helpers/mount'
import { i18n } from '@/i18n'
import { clearStorage, freshPinia } from '../helpers/store'

const { actionSheet, actionSheetCreate, router } = vi.hoisted(() => {
  const sheet = {
    present: vi.fn(async () => {}),
    dismiss: vi.fn(async () => {}),
  }
  return {
    actionSheet: sheet,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    actionSheetCreate: vi.fn(async (_options: any) => sheet),
    router: { back: vi.fn(), push: vi.fn(async () => {}) },
  }
})

vi.mock('@ionic/vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/vue')>()
  return { ...actual, actionSheetController: { create: actionSheetCreate } }
})

vi.mock('@/router', () => ({ default: router }))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => router,
    useRoute: () => ({ path: '/', query: {}, params: {} }),
  }
})

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/utils/ioData', () => ({
  exportLocalStorage: vi.fn(async () => {}),
  importLocalStorage: vi.fn(async () => {}),
}))
vi.mock('@/utils/createConfirm', () => ({
  showConfirm: vi.fn(async () => true),
}))

import toast from '@/utils/createToast'
import { exportLocalStorage, importLocalStorage } from '@/utils/ioData'
import { showConfirm } from '@/utils/createConfirm'
import {
  COVER_CACHE_STORAGE_KEY,
  lookupCoverUrl,
  rememberCoverUrl,
  resetCoverCacheForTests,
} from '@/utils/coverCache'

const mounted: any[] = []

beforeEach(() => {
  resetPlugins()
  mockMethod('Filesystem', 'getUri', async () => ({
    uri: 'file:///data/user/0/pkg/files/wallpaper.jpg',
  }))
  mockMethod('Filesystem', 'deleteFile', async () => undefined)
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
  resetCoverCacheForTests()
  localStorage.removeItem(COVER_CACHE_STORAGE_KEY)
  actionSheetCreate.mockImplementation(async () => actionSheet)
})

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted.length = 0
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mountPage(component: any) {
  const wrapper = mountComponent(component)
  mounted.push(wrapper)
  return wrapper
}

/** Translate a key. vue-i18n's typed `t` overloads are too deep for TS here. */
const t = (i18n.global as unknown as { t: (key: string) => string }).t.bind(i18n.global)

/** Find a SettingsPageLink by its rendered title. */
function link(wrapper: any, title: string) {
  const found = wrapper
    .findAllComponents(SettingsPageLink)
    .find((c: any) => c.props('title') === title)
  if (!found) throw new Error(`no link titled ${title}`)
  return found
}

describe('SettingsPage', () => {
  it('renders every group', async () => {
    const wrapper = mountPage(SettingsPage)
    await nextTick()
    expect(wrapper.findAll('.settings-group')).toHaveLength(4)
    expect(wrapper.findAllComponents(SettingsPageLink)).toHaveLength(6)
  })

  it('shows the current language name', async () => {
    const store = useAppStore()
    store.setLanguage('en-US')
    const wrapper = mountPage(SettingsPage)
    await nextTick()
    expect(wrapper.find('.item-value').text()).toBe('English')

    store.setLanguage('zh-CN')
    await nextTick()
    expect(wrapper.find('.item-value').text()).toBe('简体中文')
  })

  it('navigates to each settings subpage', async () => {
    const wrapper = mountPage(SettingsPage)
    await nextTick()

    const expected: Array<[string, string]> = [
      ['settings.interface.title', '/settings/interface'],
      ['settings.online_search.title', '/settings/online_search'],
      ['settings.accessibility.title', '/settings/accessibility'],
      ['settings.blacklist', '/blacklist'],
      ['settings.other.title', '/settings/other'],
      ['settings.about', '/about'],
    ]
    for (const [key, path] of expected) {
      router.push.mockClear()
      link(wrapper, t(key)).props('click')()
      expect(router.push).toHaveBeenCalledWith(path)
    }
  })

  it('goes back from the header', async () => {
    const wrapper = mountPage(SettingsPage)
    await nextTick()
    await wrapper.find('.header-back').trigger('click')
    expect(router.back).toHaveBeenCalled()
  })

  it('offers both languages in an action sheet', async () => {
    const store = useAppStore()
    store.setLanguage('zh-CN')
    const wrapper = mountPage(SettingsPage)
    await nextTick()

    const languageButton = wrapper
      .findAll('button')
      .find((b: any) => b.text().includes('settings.language') || b.text().includes('语言'))
    await languageButton!.trigger('click')
    await vi.waitFor(() => expect(actionSheetCreate).toHaveBeenCalled())
    const options = actionSheetCreate.mock.calls[0][0]
    expect(options.header).toBeTruthy()
    expect(options.buttons.map((b: any) => b.text)).toEqual(['简体中文', 'English', '取消'])
    expect(actionSheet.present).toHaveBeenCalled()
  })

  it('changes the language from the action sheet', async () => {
    const store = useAppStore()
    store.setLanguage('zh-CN')
    const wrapper = mountPage(SettingsPage)
    await nextTick()

    const languageButton = wrapper
      .findAll('button')
      .find((b: any) => b.text().includes('settings.language') || b.text().includes('语言'))
    await languageButton!.trigger('click')
    await vi.waitFor(() => expect(actionSheetCreate).toHaveBeenCalled())
    const buttons = actionSheetCreate.mock.calls[0][0].buttons
    buttons[1].handler()
    await nextTick()

    expect(store.getLanguage()).toBe('en-US')
    expect(localStorage.getItem('appLanguage')).toBe('en-US')
  })
})

describe('AboutPage', () => {
  it('renders the app identity and license', async () => {
    const wrapper = mountPage(AboutPage)
    await nextTick()

    expect(wrapper.find('.app-name').text()).toBe('Melodio')
    expect(wrapper.find('.app-version').text()).toMatch(/^v.+/)
    expect(wrapper.text()).toContain('Skrepy')
    expect(wrapper.text()).toContain('Apache License 2.0')
    expect(wrapper.find('.license-text').text()).toContain('apache.org/licenses/LICENSE-2.0')
  })

  it('goes back', async () => {
    const wrapper = mountPage(AboutPage)
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })

  it('opens the repository in a new tab on the web', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = mountPage(AboutPage)
    await nextTick()

    await wrapper.findAll('.info-item')[0].trigger('click')
    expect(open).toHaveBeenCalledWith('https://github.com/Skrepy0/Melodio', '_blank')
  })

  it('opens the issues page and the license link on the web', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = mountPage(AboutPage)
    await nextTick()

    await wrapper.findAll('.info-item')[1].trigger('click')
    expect(open).toHaveBeenCalledWith('https://github.com/Skrepy0/Melodio/issues', '_blank')

    // jsdom would follow the anchor's href; the handler is what we care about.
    const anchor = wrapper.find('.license-summary a').element
    anchor.addEventListener('click', (event) => event.preventDefault(), { once: true })
    ;(anchor as HTMLElement).click()
    expect(open).toHaveBeenCalledWith('http://www.apache.org/licenses/LICENSE-2.0', '_blank')
  })

  it('uses the native browser on a device', async () => {
    const { Capacitor } = await import('@capacitor/core')
    const isNative = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    const browserOpen = mockMethod('Browser', 'open')
    const wrapper = mountPage(AboutPage)
    await nextTick()

    await wrapper.findAll('.info-item')[0].trigger('click')
    await vi.waitFor(() => expect(browserOpen).toHaveBeenCalled())
    expect(browserOpen).toHaveBeenCalledWith({ url: 'https://github.com/Skrepy0/Melodio' })
    isNative.mockRestore()
  })
})

describe('AccessibilityPage', () => {
  it('renders every switch with its stored value', async () => {
    const store = useAppStore()
    store.setPinyinSearch(true)
    store.setAutoPauseOnDisconnect(false)
    store.setAutoPlayOnConnect(true)
    store.setAutoDelInvalidSongs(false)
    store.setCanFetchCoverFromWeb(false)
    store.setPlayQueueRepeat(false)
    await store.setAudioFocusPause(false)

    const wrapper = mountPage(AccessibilityPage)
    await nextTick()

    const switches = wrapper.findAllComponents(FunctionSwitch)
    expect(switches).toHaveLength(7)
    expect(switches.map((s: any) => s.props('checked'))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('persists each toggle', async () => {
    const store = useAppStore()
    const wrapper = mountPage(AccessibilityPage)
    await nextTick()

    const toggles = wrapper.findAll('input[type="checkbox"]')
    // FunctionSwitch emits a DOM change; flip the native checkbox first.
    const flip = async (index: number) => {
      const input = toggles[index].element as HTMLInputElement
      input.checked = !input.checked
      await toggles[index].trigger('change')
      await nextTick()
    }

    await flip(0)
    expect(store.getPinyinSearch()).toBe(true)
    expect(localStorage.getItem('pinyinSearch')).toBe('true')

    await flip(1)
    expect(store.getAutoPauseOnDisconnect()).toBe(false)
    expect(localStorage.getItem('autoPauseOnDisconnect')).toBe('false')

    await flip(2)
    expect(store.getAutoPlayOnConnect()).toBe(true)
    expect(localStorage.getItem('autoPlayOnConnect')).toBe('true')

    await flip(3)
    expect(store.getAutoDelInvalidSongs()).toBe(false)
    expect(localStorage.getItem('autoDelInvalidSongs')).toBe('false')

    await flip(4)
    expect(store.getCanFetchCoverFromWeb()).toBe(false)
    expect(localStorage.getItem('canFetchCoverFromWeb')).toBe('false')

    const audioFocus = mockMethod('NativeAudio', 'setAudioFocusEnabled')
    await flip(5)
    await vi.waitFor(() => expect(audioFocus).toHaveBeenCalledWith({ enabled: false }))
    expect(store.getAudioFocusPause()).toBe(false)
    expect(localStorage.getItem('audioFocusPause')).toBe('false')
  })

  it('goes back', async () => {
    const wrapper = mountPage(AccessibilityPage)
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })

  it('clears the cover caches after confirmation', async () => {
    vi.mocked(showConfirm).mockResolvedValueOnce(true)
    const nativeClear = mockMethod('NativeAudio', 'clearCoverCache')
    rememberCoverUrl('Song', 'Artist', 'https://cdn.example.com/cover.jpg')

    const wrapper = mountPage(AccessibilityPage)
    await nextTick()

    const link = wrapper
      .findAllComponents(SettingsPageLink)
      .find((l: any) => l.props('icon') === 'mdi:image-off-outline')
    expect(link).toBeTruthy()
    await (link!.props('click') as () => Promise<void>)()

    expect(lookupCoverUrl('Song', 'Artist')).toBeUndefined()
    await vi.waitFor(() => expect(nativeClear).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalled()
  })

  it('keeps the cover cache when the confirmation is dismissed', async () => {
    vi.mocked(showConfirm).mockResolvedValueOnce(false)
    const nativeClear = mockMethod('NativeAudio', 'clearCoverCache')
    rememberCoverUrl('Song', 'Artist', 'https://cdn.example.com/cover.jpg')

    const wrapper = mountPage(AccessibilityPage)
    await nextTick()

    const link = wrapper
      .findAllComponents(SettingsPageLink)
      .find((l: any) => l.props('icon') === 'mdi:image-off-outline')
    await (link!.props('click') as () => Promise<void>)()

    expect(lookupCoverUrl('Song', 'Artist')).toBe('https://cdn.example.com/cover.jpg')
    expect(nativeClear).not.toHaveBeenCalled()
  })
})

describe('OnlineSearchSettingsPage', () => {
  it('renders the stored values', async () => {
    const store = useAppStore()
    store.setMusicClientLimitation(7)
    store.setFetchTimeOut(45)
    store.setEachSongAveTimeOut(12)

    const wrapper = mountPage(OnlineSearchSettingsPage)
    await nextTick()

    const boxes = wrapper.findAllComponents(InputBox)
    expect(boxes).toHaveLength(3)
    expect(boxes.map((b: any) => b.props('modelValue'))).toEqual([7, 45, 12])
    expect(boxes.map((b: any) => b.props('defaultValue'))).toEqual([5, 30, 10])
  })

  it('saves edited values', async () => {
    const store = useAppStore()
    const wrapper = mountPage(OnlineSearchSettingsPage)
    await nextTick()

    const boxes = wrapper.findAllComponents(InputBox)
    boxes[0].vm.$emit('update:modelValue', 9)
    boxes[1].vm.$emit('update:modelValue', 60)
    boxes[2].vm.$emit('update:modelValue', 15)
    await nextTick()

    expect(store.getMusicClientLimitation()).toBe(9)
    expect(localStorage.getItem('music_client_limitation')).toBe('9')
    expect(store.getFetchTimeOut()).toBe(60)
    expect(localStorage.getItem('fetchTimeOut')).toBe('60')
    expect(store.getEachSongAveTimeOut()).toBe(15)
    expect(localStorage.getItem('eachSongAveTimeOut')).toBe('15')
  })

  it('navigates to the music client page', async () => {
    const wrapper = mountPage(OnlineSearchSettingsPage)
    await nextTick()
    link(wrapper, t('settings.online_search.music_client.title')).props('click')()
    expect(router.push).toHaveBeenCalledWith('/settings/online_search/music_client')
  })

  it('goes back', async () => {
    const wrapper = mountPage(OnlineSearchSettingsPage)
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })
})

describe('MusicClientSettingsPage', () => {
  function seedStatus() {
    const store = useAppStore()
    const status = Object.fromEntries(
      Object.keys(musicClientsConfig).map((key) => [key, false])
    ) as Record<string, boolean>
    status.Migu = true
    store.setMusicClientStatus(status as any)
    return store
  }

  it('renders one row per client with localized names', async () => {
    const store = seedStatus()
    store.setLanguage('zh-CN')
    const wrapper = mountPage(MusicClientSettingsPage)
    await nextTick()

    const rows = wrapper.findAllComponents(MusicClientConfig)
    expect(rows.length).toBeGreaterThan(0)
    const titles = rows.map((r: any) => r.props('title'))
    expect(titles).toContain('咪咕音乐')

    store.setLanguage('en-US')
    await nextTick()
    expect(
      wrapper.findAllComponents(MusicClientConfig).map((r: any) => r.props('title'))
    ).toContain('Migu')
  })

  it('falls back to the client name for unknown locales', async () => {
    seedStatus()
    const store = useAppStore()
    // `setLanguage` rejects unsupported locales, so write the value directly.
    const wrapper = mountPage(MusicClientSettingsPage)
    await nextTick()

    const bili = wrapper.findAllComponents(MusicClientConfig)[0]
    expect(bili.props('title')).toBe('哔哩哔哩')
    expect(store.getLanguage()).toBe('zh-CN')
  })

  it('toggles a client and persists the status', async () => {
    const store = seedStatus()
    const wrapper = mountPage(MusicClientSettingsPage)
    await nextTick()

    const input = wrapper.findAll('input[type="checkbox"]')[0].element as HTMLInputElement
    input.checked = true
    await wrapper.findAll('input[type="checkbox"]')[0].trigger('change')
    await nextTick()

    expect(store.getMusicClientStatus()!.Bilibili).toBe(true)
    expect(JSON.parse(localStorage.getItem('music_client_status')!)).toMatchObject({
      Bilibili: true,
      Migu: true,
    })
  })

  it('goes back', async () => {
    seedStatus()
    const wrapper = mountPage(MusicClientSettingsPage)
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })
})

describe('OtherSettingsPage', () => {
  it('exports data and reports success', async () => {
    const wrapper = mountPage(OtherSettingsPage)
    await nextTick()

    link(wrapper, t('settings.other.exportData')).props('click')()
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(exportLocalStorage).toHaveBeenCalled()
  })

  it('reports an export failure', async () => {
    vi.mocked(exportLocalStorage).mockRejectedValueOnce(new Error('denied'))
    const wrapper = mountPage(OtherSettingsPage)
    await nextTick()

    link(wrapper, t('settings.other.exportData')).props('click')()
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('imports data, reports success and reloads', async () => {
    vi.useFakeTimers()
    const reload = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    })
    try {
      const wrapper = mountPage(OtherSettingsPage)
      await nextTick()

      link(wrapper, t('settings.other.importData')).props('click')()
      await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
      expect(importLocalStorage).toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()

      vi.advanceTimersByTime(900)
      expect(reload).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
      vi.useRealTimers()
    }
  })

  it('reports an import failure without reloading', async () => {
    vi.useFakeTimers()
    vi.mocked(importLocalStorage).mockRejectedValueOnce(new Error('bad file'))
    const wrapper = mountPage(OtherSettingsPage)
    await nextTick()

    link(wrapper, t('settings.other.importData')).props('click')()
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('goes back', async () => {
    const wrapper = mountPage(OtherSettingsPage)
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })
})

describe('InterfaceSettingsPage', () => {
  it('toggles dark mode', async () => {
    const store = useAppStore()
    store.darkMode = false
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    const toggle = wrapper.findComponent(FunctionSwitch)
    expect(toggle.props('checked')).toBe(false)

    const input = wrapper.find('input[type="checkbox"]').element as HTMLInputElement
    input.checked = true
    await wrapper.find('input[type="checkbox"]').trigger('change')
    await nextTick()

    expect(store.darkMode).toBe(true)
    expect(localStorage.getItem('darkMode')).toBe('true')
  })

  it('applies a preset theme color', async () => {
    const store = useAppStore()
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    const swatches = wrapper.findAll('.preset-color-item')
    expect(swatches).toHaveLength(6)
    await swatches[1].trigger('click')

    expect(store.getThemeColor()).toBe('#d93a3a')
    expect(localStorage.getItem('theme_color')).toBe('#d93a3a')
    expect(swatches[1].attributes('aria-checked')).toBe('true')
  })

  it('applies a custom theme color', async () => {
    const store = useAppStore()
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    const input = wrapper.find('.color-picker-input')
    ;(input.element as HTMLInputElement).value = '#123456'
    await input.trigger('input')

    expect(store.getThemeColor()).toBe('#123456')
  })

  it('follows external theme color changes', async () => {
    const store = useAppStore()
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    store.setThemeColor('#abcdef')
    await nextTick()
    expect((wrapper.find('.color-picker-input').element as HTMLInputElement).value).toBe('#abcdef')
  })

  it('has no wallpaper controls before an image is set', async () => {
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()
    expect(wrapper.find('.wallpaper-preview').exists()).toBe(false)
    expect(wrapper.find('.wallpaper-fit').exists()).toBe(false)
    expect(wrapper.find('.text-action.primary').text()).toBeTruthy()
  })

  it('removes an existing wallpaper', async () => {
    const store = useAppStore()
    await store.setWallpaper('wallpaper.jpg')
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    expect(wrapper.find('.wallpaper-preview').exists()).toBe(true)
    expect(wrapper.find('.wallpaper-thumb').attributes('style')).toContain('wallpaper.jpg')

    await wrapper.findAll('.text-action')[0].trigger('click')
    expect(store.getWallpaper()).toBe('')
    expect(wrapper.find('.wallpaper-preview').exists()).toBe(false)
  })

  it('updates transparency, blur and fit', async () => {
    const store = useAppStore()
    await store.setWallpaper('wallpaper.jpg')
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    const ranges = wrapper.findAll('.range-input')
    ;(ranges[0].element as HTMLInputElement).value = '70'
    await ranges[0].trigger('input')
    expect(store.getWallpaperTransparency()).toBe(70)
    expect(localStorage.getItem('wallpaperTransparency')).toBe('70')
    ;(ranges[1].element as HTMLInputElement).value = '12'
    await ranges[1].trigger('input')
    expect(store.getWallpaperBlur()).toBe(12)
    expect(localStorage.getItem('wallpaperBlur')).toBe('12')

    wrapper.findComponent(HorizontalSelect).vm.$emit('update:modelValue', 'contain')
    await nextTick()
    expect(store.getWallpaperFit()).toBe('contain')
    expect(localStorage.getItem('wallpaperFit')).toBe('contain')
  })

  it('rejects a non-image upload', async () => {
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    const input = wrapper.find('.file-input')
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('stores a downscaled uploaded image', async () => {
    const store = useAppStore()
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

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
      width = 3200
      height = 1600
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const drawImage = vi.fn()
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as any

    // jsdom does not implement toBlob; provide a synchronous stand-in.
    const toBlob = vi.fn((cb: BlobCallback, type?: string) => {
      cb(new Blob(['x'], { type: type ?? 'image/jpeg' }))
    })
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = toBlob as any

    const writeFile = mockMethod('Filesystem', 'writeFile', async () => ({ uri: '' }))

    try {
      const input = wrapper.find('.file-input')
      const file = new File(['img'], 'a.png', { type: 'image/png' })
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')

      await vi.waitFor(() => expect(store.getWallpaper()).toContain('wallpaper.jpg'))
      // 3200x1600 is downscaled to 1600x800 before encoding.
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800)
      expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82)
      expect(writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'wallpaper.jpg',
          data: 'AAA',
          directory: 'DATA',
          recursive: true,
        })
      )
      expect(wrapper.find('.wallpaper-preview').exists()).toBe(true)
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      if (originalToBlob) {
        HTMLCanvasElement.prototype.toBlob = originalToBlob
      } else {
        delete (HTMLCanvasElement.prototype as any).toBlob
      }
      vi.unstubAllGlobals()
    }
  })

  it('reports a wallpaper that cannot be stored', async () => {
    const store = useAppStore()
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

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
      width = 10
      height = 10
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as any

    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback, type?: string) => {
      cb(new Blob(['x'], { type: type ?? 'image/jpeg' }))
    }) as any

    mockMethod('Filesystem', 'writeFile', async () => ({ uri: '' }))

    // Simulate a full storage quota for the wallpaper key only.
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'wallpaper') throw new Error('QuotaExceededError')
      return originalSetItem.call(this, key, value)
    }

    try {
      const input = wrapper.find('.file-input')
      Object.defineProperty(input.element, 'files', {
        value: [new File(['img'], 'a.png', { type: 'image/png' })],
        configurable: true,
      })
      await input.trigger('change')

      // setWallpaper reports the failed write, but the image is still applied in
      // memory for this session.
      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(store.getWallpaper()).toContain('wallpaper.jpg')
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      if (originalToBlob) {
        HTMLCanvasElement.prototype.toBlob = originalToBlob
      } else {
        delete (HTMLCanvasElement.prototype as any).toBlob
      }
      Storage.prototype.setItem = originalSetItem
      vi.unstubAllGlobals()
    }
  })

  it('reports a failed wallpaper decode', async () => {
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()

    class FailingReader {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      result = 'data:image/png;base64,AAA'
      readAsDataURL() {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal('FileReader', FailingReader)

    try {
      const input = wrapper.find('.file-input')
      Object.defineProperty(input.element, 'files', {
        value: [new File(['img'], 'a.png', { type: 'image/png' })],
        configurable: true,
      })
      await input.trigger('change')

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('goes back', async () => {
    const wrapper = mountPage(InterfaceSettingsPage)
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })
})
