/// <reference types="cypress" />

/**
 * Shared setup for the E2E specs.
 *
 * The app is a Capacitor shell. On the web build `@capacitor/core` resolves a
 * registered plugin's implementation itself (and the app's plugins have none),
 * so simply assigning `window.Capacitor.Plugins` does nothing. What the core
 * *does* honour is `Capacitor.PluginHeaders`: when a plugin is listed there,
 * every method call is routed to `Capacitor.nativePromise` / `nativeCallback`.
 * Those two hooks are installed here, before any app module is evaluated, and
 * dispatch to plain JS stubs.
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /** Seed localStorage before the app boots. */
      seedStorage(data: Record<string, unknown>): Chainable<void>
      /** Replace a stubbed plugin method for the rest of this page load. */
      stubPlugin(
        pluginName: string,
        methods: Record<string, (...args: any[]) => any>
      ): Chainable<void>
      /** Dispatch a long-press on an element (opens multi-select mode). */
      longPress(
        options?: Partial<Cypress.Loggable & Cypress.Timeoutable>
      ): Chainable<JQuery<HTMLElement>>
    }
  }
}

const SONGS = [
  {
    id: '1',
    displayName: 'Alpha.mp3',
    uri: 'file:///music/alpha.mp3',
    size: 1024,
    mimeType: 'audio/mpeg',
    dateAdded: 1,
    dateModified: 1,
    mediaType: 'audio',
    duration: 180000,
    title: 'Alpha',
    artist: 'Aria',
    album: 'First',
    track: 1,
    year: 2024,
    albumArtUri: '',
  },
  {
    id: '2',
    displayName: 'Beta.mp3',
    uri: 'file:///music/beta.mp3',
    size: 2048,
    mimeType: 'audio/mpeg',
    dateAdded: 2,
    dateModified: 2,
    mediaType: 'audio',
    duration: 200000,
    title: 'Beta',
    artist: 'Brio',
    album: 'Second',
    track: 2,
    year: 2024,
    albumArtUri: '',
  },
  {
    id: '3',
    displayName: 'Gamma.mp3',
    uri: 'file:///music/gamma.mp3',
    size: 3072,
    mimeType: 'audio/mpeg',
    dateAdded: 3,
    dateModified: 3,
    mediaType: 'audio',
    duration: 220000,
    title: 'Gamma',
    artist: 'Cello',
    album: 'Third',
    track: 3,
    year: 2024,
    albumArtUri: '',
  },
]

const ONLINE_SONGS = [
  {
    source: 'Kuwo',
    name: 'Online One',
    singers: 'Net Singer',
    album: 'Net Album',
    ext: 'mp3',
    file_size_bytes: 1024 * 1024,
    duration: 200,
    lyric: null,
    cover_url: null,
    download_url: 'https://cdn.example.com/one.mp3',
    download_url_status: { ok: true, status_code: 200, reason: [] },
    identifier: 'online-1',
  },
  {
    source: 'Kuwo',
    name: 'Online Two',
    singers: 'Other Singer',
    album: 'Net Album',
    ext: 'mp3',
    file_size_bytes: 2 * 1024 * 1024,
    duration: 210,
    lyric: null,
    cover_url: null,
    download_url: 'https://cdn.example.com/two.mp3',
    download_url_status: { ok: true, status_code: 200, reason: [] },
    identifier: 'online-2',
  },
]

/** Methods that receive a callback rather than returning a promise. */
const CALLBACK_METHODS = new Set(['addListener', 'removeListener'])

/** Plugins that need the event-listener bridge. */
const EVENT_PLUGINS = new Set(['NativeAudio', 'Downloader', 'MusicSigner'])

/**
 * Install the shared web stubs on the current window. Called from
 * `onBeforeLoad` so the store's `init()` sees a working bridge.
 */
function installNativeStubs(win: any) {
  const noop = async () => undefined
  /** `${plugin}:${event}` -> callbackId -> listener */
  const listeners = new Map<string, Map<string, (data?: any) => void>>()
  let callbackSeq = 0

  const listenersFor = (plugin: string, event: string) => {
    const key = `${plugin}:${event}`
    let set = listeners.get(key)
    if (!set) {
      set = new Map()
      listeners.set(key, set)
    }
    return set
  }
  const emit = (plugin: string, event: string, data?: any) => {
    listenersFor(plugin, event).forEach((cb) => cb(data))
  }

  const impls: Record<string, Record<string, (options?: any) => any>> = {
    NativeAudio: {
      load: noop,
      play: async () => emit('NativeAudio', 'playStateChange', { isPlaying: true }),
      pause: async () => emit('NativeAudio', 'playStateChange', { isPlaying: false }),
      stop: async () => emit('NativeAudio', 'playStateChange', { isPlaying: false }),
      seek: async ({ time }: any = {}) => emit('NativeAudio', 'timeupdate', { position: time }),
      setVolume: noop,
      getDuration: async () => ({ duration: 0 }),
      getCurrentPosition: async () => ({ position: 0 }),
      setPlaylist: noop,
      refreshCurrentMetadata: noop,
      playIndex: async ({ index, autoPlay = true }: any = {}) => {
        emit('NativeAudio', 'songChanged', {
          index,
          isPlaying: autoPlay !== false,
          position: 0,
        })
        emit('NativeAudio', 'playStateChange', { isPlaying: autoPlay !== false })
      },
      setMetadata: noop,
      updatePlaybackState: noop,
      setRepeatMode: noop,
      setCurrentIndex: noop,
      setPlayQueueRepeat: noop,
      getState: async () => ({
        isPlaying: false,
        currentIndex: 0,
        currentPosition: 0,
        duration: 0,
      }),
      saveFile: async () => ({ uri: 'file:///tmp/export.json' }),
      openFile: async () => ({ data: '{}' }),
      setAudioFocusEnabled: noop,
      setPlaybackRate: noop,
      removeAllListeners: async () => listeners.clear(),
    },
    CapacitorMediaStore: {
      requestPermissions: async () => ({ audio: 'granted', photo: 'granted', video: 'granted' }),
      checkPermissions: async () => ({ audio: 'granted', photo: 'granted', video: 'granted' }),
      getMedias: async () => ({ media: SONGS }),
      getMediasByType: async () => ({ media: SONGS }),
      getAlbums: async () => ({ albums: [] }),
      saveMedia: async () => ({ uri: 'file:///music/saved.mp3' }),
      getMediaMetadata: async ({ filePath }: any = {}) => ({
        media: {
          uri: filePath,
          displayName: 'Downloaded.mp3',
          title: 'Downloaded',
          artist: 'Net Singer',
          album: 'Net Album',
          size: 1024,
          mimeType: 'audio/mpeg',
          duration: 200000,
        },
      }),
    },
    Downloader: {
      startDownload: async ({ taskId }: any = {}) => {
        emit('Downloader', 'downloadProgress', {
          taskId,
          loaded: 512,
          total: 1024,
          progress: 50,
          status: 'downloading',
        })
        return { path: 'file:///downloads/one.mp3', size: 1024, status: 'completed' }
      },
      pauseDownload: async () => ({ status: 'paused' }),
      resumeDownload: async ({ taskId }: any = {}) => ({
        taskId,
        path: 'file:///downloads/one.mp3',
        size: 1024,
        status: 'completed',
      }),
    },
    MusicSigner: {
      search: async () => {
        emit('MusicSigner', 'searchPartial', { source: 'Kuwo', items: ONLINE_SONGS })
        emit('MusicSigner', 'searchDone', {})
        return { items: ONLINE_SONGS, total: ONLINE_SONGS.length }
      },
      cancelSearch: noop,
      removeAllListeners: async () => listeners.clear(),
    },
    SystemBar: { setTheme: async () => ({ success: true }) },
  }

  const pluginHeaders = Object.entries(impls).map(([name, methods]) => ({
    name,
    methods: [
      ...Object.keys(methods).map((method) => ({
        name: method,
        rtype: CALLBACK_METHODS.has(method) ? 'callback' : 'promise',
      })),
      ...(EVENT_PLUGINS.has(name)
        ? [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'callback' },
          ]
        : []),
    ],
  }))

  win.Capacitor = win.Capacitor || {}
  win.Capacitor.PluginHeaders = pluginHeaders
  win.Capacitor.nativePromise = (pluginName: string, methodName: string, options?: any) => {
    const impl = impls[pluginName]?.[methodName]
    if (!impl) {
      return Promise.reject(new Error(`[e2e] ${pluginName}.${methodName} is not stubbed`))
    }
    try {
      return Promise.resolve(impl(options))
    } catch (error) {
      return Promise.reject(error)
    }
  }
  win.Capacitor.nativeCallback = (
    pluginName: string,
    methodName: string,
    options: any,
    callback: (data?: any) => void
  ) => {
    if (methodName === 'addListener') {
      const callbackId = `cb-${++callbackSeq}`
      listenersFor(pluginName, options?.eventName).set(callbackId, callback)
      return Promise.resolve(callbackId)
    }
    if (methodName === 'removeListener') {
      listenersFor(pluginName, options?.eventName).delete(options?.callbackId)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  // Exposed so a spec can drive native events or swap a method after boot.
  win.__e2eEmit = emit
  win.__e2eImpls = impls
}

Cypress.Commands.add('seedStorage', (data) => {
  cy.window({ log: false }).then((win) => {
    Object.entries(data).forEach(([key, value]) => {
      win.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    })
  })
})

Cypress.Commands.add('stubPlugin', (pluginName, methods) => {
  cy.window({ log: false }).then((win) => {
    const target = (win as any).__e2eImpls?.[pluginName]
    if (!target) throw new Error(`plugin ${pluginName} is not stubbed`)
    Object.assign(target, methods)
  })
})

Cypress.Commands.add('longPress', { prevSubject: true }, (subject) => {
  cy.wrap(subject).trigger('touchstart')
  cy.wait(650)
  cy.wrap(subject).trigger('touchend')
  return cy.wrap(subject)
})

export const seedSongs = SONGS
export const seedOnlineSongs = ONLINE_SONGS
export { installNativeStubs }

beforeEach(() => {
  cy.intercept('HEAD', 'https://cdn.example.com/**', { statusCode: 200 })
  cy.intercept('GET', 'https://cdn.example.com/**', { statusCode: 200, body: '' })
})
