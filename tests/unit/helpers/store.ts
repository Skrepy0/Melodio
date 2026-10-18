import { createPinia, setActivePinia } from 'pinia'

/**
 * Fresh Pinia for each test. Call before `useAppStore()`; the store factory
 * runs immediately on first use, so localStorage must already be seeded.
 */
export function freshPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

export function clearStorage() {
  localStorage.clear()
}
