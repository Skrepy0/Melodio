import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import { setDialogAppContext } from '@/utils/appContext'
import { DEFAULT_COVER } from '@/utils/functions'

/**
 * Imperative dialogs render outside the mounted tree, so they need an app
 * context for `useI18n()` and global components. In production `main.ts` sets
 * it once; tests get a tiny host app with Pinia + i18n.
 */
export function installDialogContext() {
  const host = createApp(defineComponent({ render: () => h('div') }))
  host.use(createPinia())
  host.use(i18n)
  setDialogAppContext(host._context)
  return host
}

/** The most recently appended dialog container (dialogs render into one). */
export function dialogContainer(): HTMLElement | null {
  const containers = Array.from(document.body.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.tagName === 'DIV'
  )
  return containers[containers.length - 1] ?? null
}

/**
 * Let pending Vue updates (transition leave, unmount) settle. Real timers are
 * used because Vue's scheduler and CSS transition hooks rely on them.
 */
export async function flushDom(ms = 60) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function queryDialog<T extends Element = HTMLElement>(selector: string): T | null {
  return dialogContainer()?.querySelector<T>(selector) ?? null
}

/** Buttons in the currently rendered dialog, in DOM order. */
export function dialogButtons(): HTMLButtonElement[] {
  return Array.from(dialogContainer()?.querySelectorAll('button') ?? [])
}

export { DEFAULT_COVER }
