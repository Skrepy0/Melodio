import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useDropdownManager } from '@/composables/useDropdownManager'
import { useDropdownControl } from '@/composables/useDropdownControl'
import { useDialogA11y, trapTabKey } from '@/composables/useDialogA11y'

describe('useDropdownManager', () => {
  it('opens one dropdown at a time', () => {
    const { openDropdownId, handleDropdownToggle } = useDropdownManager()

    handleDropdownToggle('a', true)
    expect(openDropdownId.value).toBe('a')

    handleDropdownToggle('b', true)
    expect(openDropdownId.value).toBe('b')

    handleDropdownToggle('a', false)
    expect(openDropdownId.value).toBe('b')
  })

  it('closes the open dropdown when it toggles itself', () => {
    const { openDropdownId, handleDropdownToggle } = useDropdownManager()
    handleDropdownToggle(1, true)
    handleDropdownToggle(1, false)
    expect(openDropdownId.value).toBeNull()
  })

  it('closes everything', () => {
    const { openDropdownId, handleDropdownToggle, closeAllDropdowns } = useDropdownManager()
    handleDropdownToggle('x', true)
    closeAllDropdowns()
    expect(openDropdownId.value).toBeNull()
  })
})

describe('useDropdownControl', () => {
  it('reads the prop and emits updates', () => {
    const emit = vi.fn()
    const { dropdownVisible } = useDropdownControl({ dropdownOpen: true }, emit)
    expect(dropdownVisible.value).toBe(true)

    dropdownVisible.value = false
    expect(emit).toHaveBeenCalledWith('update:dropdownOpen', false)
  })

  it('defaults to closed', () => {
    const { dropdownVisible } = useDropdownControl({}, vi.fn())
    expect(dropdownVisible.value).toBe(false)
  })

  it('stays reactive to prop changes', () => {
    const props = ref<{ dropdownOpen?: boolean }>({ dropdownOpen: false })
    const { dropdownVisible } = useDropdownControl(
      new Proxy(props, {
        get: (target, key) => target.value[key as keyof typeof target.value],
      }) as any,
      vi.fn()
    )
    expect(dropdownVisible.value).toBe(false)
    props.value = { dropdownOpen: true }
    expect(dropdownVisible.value).toBe(true)
  })
})

describe('useDialogA11y', () => {
  function mountDialog(options: { open?: boolean } = {}) {
    const container = ref<HTMLElement | null>(null)
    const onEscape = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup() {
          const isOpen = options.open === undefined ? () => true : () => false
          useDialogA11y(container, onEscape, isOpen)
          return () =>
            h('div', { ref: container }, [
              h('input', { id: 'first' }),
              h('button', { id: 'second' }, 'OK'),
            ])
        },
      }),
      { attachTo: document.body }
    )
    return { wrapper, onEscape, container }
  }

  it('focuses the first control on mount', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    const { wrapper } = mountDialog()
    await nextTick()
    await nextTick()

    expect(document.activeElement?.id).toBe('first')
    wrapper.unmount()
    // Focus returns to where it was before opening.
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('closes on Escape', async () => {
    const { wrapper, onEscape } = mountDialog()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('ignores Escape while closed', async () => {
    const { wrapper, onEscape } = mountDialog({ open: false })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stops listening after unmount', async () => {
    const { wrapper, onEscape } = mountDialog()
    await nextTick()
    wrapper.unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).not.toHaveBeenCalled()
  })
})

describe('trapTabKey', () => {
  function setup() {
    const root = document.createElement('div')
    const first = document.createElement('button')
    const last = document.createElement('button')
    first.id = 'first'
    last.id = 'last'
    root.append(first, last)
    document.body.appendChild(root)
    // jsdom has no layout; treat every control as visible.
    Object.defineProperty(first, 'offsetParent', { get: () => root })
    Object.defineProperty(last, 'offsetParent', { get: () => root })
    return { root, first, last }
  }

  it('wraps forward from the last control', () => {
    const { root, first, last } = setup()
    last.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    trapTabKey(event, root)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    root.remove()
  })

  it('wraps backwards from the first control', () => {
    const { root, first, last } = setup()
    first.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    trapTabKey(event, root)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    root.remove()
  })

  it('leaves middle tabs alone', () => {
    const { root, first } = setup()
    first.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    trapTabKey(event, root)

    expect(event.defaultPrevented).toBe(false)
    root.remove()
  })

  it('ignores non-Tab keys and missing roots', () => {
    const { root, first } = setup()
    first.focus()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    trapTabKey(enter, root)
    trapTabKey(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }), null)
    expect(enter.defaultPrevented).toBe(false)
    root.remove()
  })
})
