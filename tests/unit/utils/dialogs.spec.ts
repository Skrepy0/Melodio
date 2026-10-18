import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { showPrompt } from '@/utils/createPrompt'
import { showConfirm } from '@/utils/createConfirm'
import { dialogButtons, installDialogContext, queryDialog } from '../helpers/dialogs'

beforeEach(() => {
  document.body.innerHTML = ''
  installDialogContext()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('showPrompt', () => {
  it('renders the dialog with the provided content', async () => {
    void showPrompt({ title: 'Rename', message: 'Enter a name', defaultValue: 'Old' })
    await nextTick()

    expect(queryDialog('h3')?.textContent).toBe('Rename')
    expect(queryDialog('p')?.textContent).toBe('Enter a name')
    expect(queryDialog<HTMLInputElement>('input')?.value).toBe('Old')
  })

  it('resolves with the entered value', async () => {
    const pending = showPrompt({ title: 'Rename', defaultValue: 'Old' })
    await nextTick()

    const input = queryDialog<HTMLInputElement>('input')!
    input.value = 'New name'
    input.dispatchEvent(new Event('input'))
    dialogButtons()[1].click()

    await expect(pending).resolves.toBe('New name')
    expect(queryDialog('.prompt-container')).toBeNull()
  })

  it('resolves null when cancelled', async () => {
    const pending = showPrompt({ title: 'Rename', defaultValue: 'Old' })
    await nextTick()
    dialogButtons()[0].click()
    await expect(pending).resolves.toBeNull()
  })

  it('resolves null when the overlay is clicked', async () => {
    const pending = showPrompt({ title: 'Rename' })
    await nextTick()
    queryDialog('.prompt-overlay')!.click()
    await expect(pending).resolves.toBeNull()
  })

  it('resolves null on Escape', async () => {
    const pending = showPrompt({ title: 'Rename' })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(pending).resolves.toBeNull()
  })

  it('submits on Enter', async () => {
    const pending = showPrompt({ defaultValue: 'x' })
    await nextTick()
    const input = queryDialog<HTMLInputElement>('input')!
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await expect(pending).resolves.toBe('x')
  })

  it('uses custom button labels', async () => {
    void showPrompt({ confirmContent: 'Save', cancelContent: 'Discard' })
    await nextTick()
    const [cancel, confirm] = dialogButtons()
    expect(cancel.textContent?.trim()).toBe('Discard')
    expect(confirm.textContent?.trim()).toBe('Save')
  })
})

describe('showConfirm', () => {
  it('resolves true when confirmed', async () => {
    const pending = showConfirm({ title: 'Delete', message: 'Are you sure?' })
    await nextTick()

    expect(queryDialog('p')?.textContent).toBe('Are you sure?')
    dialogButtons()[1].click()

    await expect(pending).resolves.toBe(true)
    expect(document.body.querySelector('.confirm-container')).toBeNull()
  })

  it('resolves false when cancelled', async () => {
    const pending = showConfirm({ message: 'Are you sure?' })
    await nextTick()
    dialogButtons()[0].click()
    await expect(pending).resolves.toBe(false)
  })

  it('resolves false on Escape', async () => {
    const pending = showConfirm({ message: 'Are you sure?' })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(pending).resolves.toBe(false)
  })

  it('resolves false when the overlay is clicked', async () => {
    const pending = showConfirm({ message: 'Are you sure?' })
    await nextTick()
    queryDialog('.confirm-overlay')!.click()
    await expect(pending).resolves.toBe(false)
  })

  it('uses custom button labels', async () => {
    void showConfirm({ message: 'x', confirmText: 'Yes', cancelText: 'No' })
    await nextTick()
    const [cancel, confirm] = dialogButtons()
    expect(cancel.textContent?.trim()).toBe('No')
    expect(confirm.textContent?.trim()).toBe('Yes')
  })

  it('omits the header without a title', async () => {
    void showConfirm({ message: 'x' })
    await nextTick()
    expect(queryDialog('.confirm-header')).toBeNull()
  })
})
