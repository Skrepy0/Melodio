/**
 * Global test environment.
 *
 * Capacitor plugins are native bridges: on the web (jsdom) every method throws
 * "not implemented". Each test can install behaviour with `mockMethod()` from
 * `helpers/capacitor`, which writes into a per-plugin registry that these
 * module mocks route to.
 */
import { vi } from 'vitest'

type Handler = (...args: any[]) => any
interface MockPlugin {
  methods: Record<string, Handler>
  listeners: Record<string, Set<Handler>>
}

export const pluginRegistry: Record<string, MockPlugin> = ((
  globalThis as any
).__capPluginRegistry ||= {})

function ensure(name: string): MockPlugin {
  if (!pluginRegistry[name]) pluginRegistry[name] = { methods: {}, listeners: {} }
  return pluginRegistry[name]
}

function makeProxy(name: string) {
  const plugin = ensure(name)
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'addListener') {
          return async (eventName: string, callback: Handler) => {
            const set = (plugin.listeners[eventName] ||= new Set())
            set.add(callback)
            const handle = {
              remove: async () => {
                set.delete(callback)
              },
            }
            return handle
          }
        }
        if (prop === 'removeAllListeners') {
          return async () => {
            Object.values(plugin.listeners).forEach((set) => set.clear())
          }
        }
        if (prop === 'then') return undefined
        return (...args: any[]) => {
          const fn = plugin.methods[prop]
          // Unstubbed native calls resolve quietly: app code wires listeners
          // and syncs playlists at module load, and those fire-and-forget
          // calls must not surface as unhandled rejections.
          if (!fn) return Promise.resolve(undefined)
          try {
            return Promise.resolve(fn(...args))
          } catch (e) {
            return Promise.reject(e)
          }
        }
      },
    }
  )
}

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...actual,
    registerPlugin: (name: string) => makeProxy(name),
  }
})

vi.mock('@capacitor/filesystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/filesystem')>()
  return { ...actual, Filesystem: makeProxy('Filesystem') }
})

vi.mock('@capacitor/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/app')>()
  return { ...actual, App: makeProxy('App') }
})

vi.mock('@capacitor/browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/browser')>()
  return { ...actual, Browser: makeProxy('Browser') }
})

// The MediaStore package is CJS and pulls in a broken relative require when
// loaded under Vitest, so it is replaced wholesale rather than spread.
vi.mock('@odion-cloud/capacitor-mediastore', () => ({
  CapacitorMediaStore: makeProxy('CapacitorMediaStore'),
}))

// jsdom does not implement matchMedia; the store uses it to pick an initial
// colour scheme.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
