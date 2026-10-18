import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushDom } from '../helpers/dialogs'
import DropdownButton from '@/components/button/DropdownButton.vue'
import CircleButton from '@/components/button/CircleButton.vue'
import HorizontalSelect from '@/components/HorizontalSelect.vue'
import SearchBox from '@/components/SearchBox.vue'
import PageTitle from '@/components/PageTitle.vue'
import FunctionSwitch from '@/components/settings/FunctionSwitch.vue'
import MusicClientConfig from '@/components/settings/MusicClientConfig.vue'
import SettingsPageLink from '@/components/settings/SettingsPageLink.vue'
import InputBox from '@/components/settings/InputBox.vue'
import { resetPlugins } from '../helpers/capacitor'
import { mountComponent as mountBase } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

const mounted: any[] = []
function mountComponent(component: any, options: Record<string, any> = {}) {
  const wrapper = mountBase(component, options)
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(async () => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted.length = 0
  vi.useRealTimers()
  await flushDom()
  vi.restoreAllMocks()
})

describe('CircleButton', () => {
  it('renders the icon button', () => {
    const wrapper = mountComponent(CircleButton, {
      props: { icon: 'mdi:play', size: 32, label: 'Play' },
    })
    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Play')
    expect(button.attributes('style')).toContain('32px')
  })

  it('emits click', async () => {
    const wrapper = mountComponent(CircleButton, { props: { icon: 'mdi:play' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('ignores clicks while disabled', async () => {
    const wrapper = mountComponent(CircleButton, {
      props: { icon: 'mdi:play', disabled: true },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('expands the hit area only for large buttons', () => {
    const large = mountComponent(CircleButton, { props: { icon: 'mdi:x', size: 48 } })
    expect(large.classes()).toContain('expand-hit-area')
    const small = mountComponent(CircleButton, { props: { icon: 'mdi:x', size: 32 } })
    expect(small.classes()).not.toContain('expand-hit-area')
  })
})

describe('DropdownButton', () => {
  const options = [
    { value: 'a', icon: 'mdi:a', description: 'Option A' },
    { value: 'b', icon: 'mdi:b', description: 'Option B' },
    { value: 'c', icon: 'mdi:c', description: 'Disabled', disabled: true },
  ]

  function mountDropdown(props: Record<string, any> = {}) {
    return mountComponent(DropdownButton, { props: { options, ...props } })
  }

  function menuItems(): HTMLElement[] {
    return Array.from(document.body.querySelectorAll<HTMLElement>('.dropdown-menu .dropdown-item'))
  }

  it('opens the menu when the button is clicked', async () => {
    const wrapper = mountDropdown()
    expect(menuItems()).toHaveLength(0)

    await wrapper.find('.circle-button').trigger('click')
    await nextTick()

    expect(menuItems()).toHaveLength(3)
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([true])
    expect(wrapper.emitted('visibleChange')?.[0]).toEqual([true])
  })

  it('emits the selected item and closes', async () => {
    const wrapper = mountDropdown()
    await wrapper.find('.circle-button').trigger('click')
    await nextTick()

    await flushDom()
    menuItems()[1].click()
    await nextTick()
    await flushDom()

    expect(wrapper.emitted('select')?.[0]).toEqual([options[1]])
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    expect(menuItems()).toHaveLength(0)
  })

  it('does not emit for disabled items', async () => {
    const wrapper = mountDropdown()
    await wrapper.find('.circle-button').trigger('click')
    await nextTick()

    menuItems()[2].click()
    await nextTick()

    expect(wrapper.emitted('select')).toBeUndefined()
    await flushDom()
    expect(menuItems()).toHaveLength(3)
  })

  it('closes when clicking outside', async () => {
    const wrapper = mountDropdown()
    await wrapper.find('.circle-button').trigger('click')
    await nextTick()

    await flushDom()
    document.body.click()
    await nextTick()
    await flushDom()

    expect(menuItems()).toHaveLength(0)
  })

  it('closes on Escape', async () => {
    const wrapper = mountDropdown()
    await wrapper.find('.circle-button').trigger('click')
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await flushDom()

    expect(menuItems()).toHaveLength(0)
  })

  it('does not open while disabled', async () => {
    const wrapper = mountDropdown({ disabled: true })
    await wrapper.find('.circle-button').trigger('click')
    await nextTick()
    expect(menuItems()).toHaveLength(0)
  })

  it('follows the visible prop', async () => {
    const wrapper = mountDropdown({ visible: false })
    await wrapper.setProps({ visible: true })
    await nextTick()
    expect(menuItems()).toHaveLength(3)

    await wrapper.setProps({ visible: false })
    await nextTick()
    await flushDom()
    expect(menuItems()).toHaveLength(0)
  })
})

describe('HorizontalSelect', () => {
  const options = [
    { label: 'Songs', value: 'songs' },
    { label: 'Playlists', value: 'play-lists' },
    { label: 'Disabled', value: 'off', disabled: true },
  ]

  it('renders every option', () => {
    const wrapper = mountComponent(HorizontalSelect, { props: { options, modelValue: 'songs' } })
    expect(wrapper.findAll('.select-item')).toHaveLength(3)
    expect(wrapper.findAll('.select-item')[0].classes()).toContain('selected')
  })

  it('emits the selected value', async () => {
    const wrapper = mountComponent(HorizontalSelect, { props: { options, modelValue: 'songs' } })
    await wrapper.findAll('.select-item')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['play-lists'])
    expect(wrapper.emitted('select')?.[0]).toEqual([options[1]])
  })

  it('ignores disabled options', async () => {
    const wrapper = mountComponent(HorizontalSelect, { props: { options, modelValue: 'songs' } })
    await wrapper.findAll('.select-item')[2].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('selects the first enabled option when unbound', async () => {
    const wrapper = mountComponent(HorizontalSelect, { props: { options } })
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['songs'])
  })
})

describe('SearchBox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders the placeholder and value', () => {
    const wrapper = mountComponent(SearchBox, {
      props: { modelValue: 'abc', placeholder: 'Find' },
    })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Find')
    expect(wrapper.find('input').element.value).toBe('abc')
  })

  it('emits input and model updates', async () => {
    const wrapper = mountComponent(SearchBox, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('hello')

    expect(wrapper.emitted('input')?.[0]).toEqual(['hello'])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['hello'])
  })

  it('debounces the real-time search', async () => {
    const wrapper = mountComponent(SearchBox, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('a')

    expect(wrapper.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')?.[0]).toEqual(['a'])
  })

  it('searches immediately when debounce is zero', async () => {
    const wrapper = mountComponent(SearchBox, { props: { modelValue: '', debounce: 0 } })
    await wrapper.find('input').setValue('now')
    expect(wrapper.emitted('search')?.[0]).toEqual(['now'])
  })

  it('skips real-time search when disabled', async () => {
    const wrapper = mountComponent(SearchBox, {
      props: { modelValue: '', realTimeSearch: false },
    })
    await wrapper.find('input').setValue('x')
    vi.advanceTimersByTime(500)
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('searches on Enter and on the search icon', async () => {
    const wrapper = mountComponent(SearchBox, {
      props: { modelValue: 'term', realTimeSearch: false },
    })
    await wrapper.find('input').trigger('keyup.enter')
    await wrapper.find('.search-icon').trigger('click')

    expect(wrapper.emitted('search')).toEqual([['term'], ['term']])
  })

  it('clears the input', async () => {
    const wrapper = mountComponent(SearchBox, { props: { modelValue: 'abc' } })
    await wrapper.find('.clear-icon').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(wrapper.emitted('search')?.[0]).toEqual([''])
  })

  it('hides the clear button when empty', () => {
    const wrapper = mountComponent(SearchBox, { props: { modelValue: '' } })
    expect(wrapper.find('.clear-icon').exists()).toBe(false)
  })

  it('renders the search button when requested', async () => {
    const wrapper = mountComponent(SearchBox, {
      props: { modelValue: 'x', showButton: true, realTimeSearch: false },
    })
    await wrapper.find('.search-button').trigger('click')
    expect(wrapper.emitted('search')?.[0]).toEqual(['x'])
  })

  it('ignores interactions while disabled', async () => {
    const wrapper = mountComponent(SearchBox, {
      props: { modelValue: 'x', disabled: true, showButton: true },
    })
    await wrapper.find('.search-icon').trigger('click')
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('exposes focus and blur', () => {
    const wrapper = mountComponent(SearchBox)
    const focus = vi.spyOn(wrapper.find('input').element, 'focus')
    const blur = vi.spyOn(wrapper.find('input').element, 'blur')
    ;(wrapper.vm as any).focus()
    ;(wrapper.vm as any).blur()
    expect(focus).toHaveBeenCalled()
    expect(blur).toHaveBeenCalled()
  })
})

describe('PageTitle', () => {
  it('renders the title and handles back', async () => {
    const goBack = vi.fn()
    const wrapper = mountComponent(PageTitle, { props: { title: 'Settings', goBack } })

    expect(wrapper.find('.header-title').text()).toBe('Settings')
    await wrapper.find('.header-back').trigger('click')
    expect(goBack).toHaveBeenCalled()
  })
})

describe('settings controls', () => {
  it('FunctionSwitch renders and forwards change events', async () => {
    const change = vi.fn()
    const wrapper = mountComponent(FunctionSwitch, {
      props: { icon: 'mdi:x', title: 'Dark', desc: 'Use dark mode', checked: false, change },
    })

    expect(wrapper.text()).toContain('Dark')
    expect(wrapper.text()).toContain('Use dark mode')
    await wrapper.find('input').trigger('change')
    expect(change).toHaveBeenCalled()
  })

  it('MusicClientConfig renders the switch state', async () => {
    const change = vi.fn()
    const wrapper = mountComponent(MusicClientConfig, {
      props: { icon: 'mdi:x', title: 'Kuwo', checked: true, change },
    })
    expect((wrapper.find('input').element as HTMLInputElement).checked).toBe(true)
    await wrapper.find('input').trigger('change')
    expect(change).toHaveBeenCalled()
  })

  it('SettingsPageLink fires its click handler', async () => {
    const click = vi.fn()
    const wrapper = mountComponent(SettingsPageLink, {
      props: { click, icon: 'mdi:x', title: 'About', desc: 'Info' },
    })
    await wrapper.find('button').trigger('click')
    expect(click).toHaveBeenCalled()
    expect(wrapper.find('.item-right').exists()).toBe(true)
  })

  it('SettingsPageLink hides the chevron when not a link', () => {
    const wrapper = mountComponent(SettingsPageLink, {
      props: { click: vi.fn(), icon: 'mdi:x', title: 'About', desc: 'Info', isLink: false },
    })
    expect(wrapper.find('.item-right svg').exists()).toBe(false)
  })
})

describe('InputBox', () => {
  it('renders the current value', () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Limit', modelValue: 10 },
    })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('10')
  })

  it('emits a number for integer input', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Limit', modelValue: 10, type: 'integer' },
    })
    await wrapper.find('input').setValue('42')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([42])
  })

  it('rejects non-integer input', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Limit', modelValue: 10, type: 'integer' },
    })
    await wrapper.find('input').setValue('4.5')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('.setting-error').exists()).toBe(true)
    expect(wrapper.find('input').classes()).toContain('has-error')
  })

  it('enforces the minimum', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Limit', modelValue: 10, type: 'integer', min: 5 },
    })
    await wrapper.find('input').setValue('2')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('.setting-error').text()).toContain('5')
  })

  it('enforces the maximum', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Limit', modelValue: 10, type: 'integer', max: 20 },
    })
    await wrapper.find('input').setValue('30')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('accepts decimal input', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Rate', modelValue: 1, type: 'decimal' },
    })
    await wrapper.find('input').setValue('1.5')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([1.5])
  })

  it('enforces the string max length', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Name', modelValue: '', maxlength: 3 },
    })
    await wrapper.find('input').setValue('abcd')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('requires a value', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Name', modelValue: 'x' },
    })
    await wrapper.find('input').setValue('   ')
    expect(wrapper.find('.setting-error').exists()).toBe(true)
  })

  it('allows empty input when not required', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Name', modelValue: 'x', required: false },
    })
    await wrapper.find('input').setValue('')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(wrapper.find('.setting-error').exists()).toBe(false)
  })

  it('resets to the default value', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Name', modelValue: 'changed', defaultValue: 'default' },
    })
    await wrapper.find('.reset-btn').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['default'])
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('default')
  })

  it('disables the reset button at the default', () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Name', modelValue: 'default', defaultValue: 'default' },
    })
    expect(wrapper.find('.reset-btn').attributes('disabled')).toBeDefined()
  })

  it('syncs when the model changes externally', async () => {
    const wrapper = mountComponent(InputBox, {
      props: { icon: 'mdi:x', title: 'Name', modelValue: 'a' },
    })
    await wrapper.setProps({ modelValue: 'b' })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('b')
  })
})
