import { config, mount } from '@vue/test-utils'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { i18n } from '@/i18n'
import { setDialogAppContext } from '@/utils/appContext'
import { addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'

addCollection(mdiIcons as any)

config.global.plugins = [i18n]
config.global.stubs = {
  IonPage: { template: '<div class="ion-page-stub"><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  IonHeader: { template: '<div><slot /></div>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<div><slot /></div>' },
  IonIcon: { template: '<i><slot /></i>' },
  IonModal: { template: '<div><slot /></div>' },
  IonBackButton: { template: '<button />' },
  IonButtons: { template: '<div><slot /></div>' },
  IonButton: { template: '<button><slot /></button>' },
  IonToggle: { template: '<input type="checkbox" />' },
  IonRange: { template: '<input type="range" />' },
  IonSpinner: { template: '<span />' },
  IonRouterLink: { template: '<a><slot /></a>' },
}

// vue-i18n's `t` overloads are too deep for TS to resolve against a plain mock.
const translate: (key: string, params?: Record<string, unknown>) => string = (
  i18n.global as unknown as { t: (key: string, params?: Record<string, unknown>) => string }
).t.bind(i18n.global)

config.global.mocks = {
  $t: (key: string, params?: Record<string, unknown>) =>
    params ? translate(key, params) : translate(key),
}

const routerMock = {
  push: vi.fn(async () => {}),
  replace: vi.fn(async () => {}),
  back: vi.fn(),
  forward: vi.fn(),
  currentRoute: { value: { path: '/', query: {}, params: {} } },
  resolve: (to: any) => ({ href: typeof to === 'string' ? to : (to?.path ?? '/'), path: '/' }),
  beforeEach: vi.fn(),
  afterEach: vi.fn(),
  addRoute: vi.fn(),
  isReady: () => Promise.resolve(true),
}

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => routerMock,
    useRoute: () => routerMock.currentRoute.value,
  }
})

export function mountComponent(component: Component, options: Record<string, any> = {}) {
  // Reuse the Pinia the test already seeded, so store instances match.
  const pinia = (getActivePinia() as any) ?? createPinia()
  setActivePinia(pinia)
  const wrapper = mount(component, {
    ...options,
    global: {
      plugins: [pinia, i18n],
      stubs: config.global.stubs,
      mocks: config.global.mocks,
      ...(options.global ?? {}),
    },
  })
  // Imperative dialogs need an app context; reuse the pinia-bearing one.
  setDialogAppContext(wrapper.vm.$.appContext)
  return wrapper
}

export { routerMock }
