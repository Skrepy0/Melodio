import { vi } from 'vitest'

export interface PluginMock {
  methods: Record<string, ReturnType<typeof vi.fn>>
  listeners: Record<string, Set<(...args: any[]) => any>>
}

const registry: Record<string, PluginMock> = ((globalThis as any).__capPluginRegistry ||= {})

export function plugin(name: string): PluginMock {
  if (!registry[name]) registry[name] = { methods: {}, listeners: {} }
  return registry[name]
}

/** Stub a native plugin method; returns the vi.fn so callers can assert on it. */
export function mockMethod<T extends any[] = any[], R = any>(
  name: string,
  method: string,
  impl: (...args: T) => R = (() => undefined) as any
) {
  const fn = vi.fn(impl)
  plugin(name).methods[method] = fn
  return fn
}

/** Fire a native listener (e.g. 'timeupdate' on NativeAudio). */
export function emitNative(name: string, event: string, data?: any) {
  plugin(name).listeners[event]?.forEach((cb) => cb(data))
}

/**
 * Reset stubbed methods between tests. Listener subscriptions are kept: module
 * singletons (`audio`, the store) subscribe once at import time and would
 * otherwise stop receiving native events for every test after the first.
 */
export function resetPlugins() {
  Object.values(registry).forEach((p) => {
    p.methods = {}
  })
}
