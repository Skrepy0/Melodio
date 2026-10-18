/// <reference types="cypress" />

import { installNativeStubs, seedSongs } from './commands'

/**
 * Seed the app and start it on `/home`.
 *
 * Everything here runs in `onBeforeLoad`, i.e. before the app's own modules are
 * evaluated, so the Pinia store restores the fixtures on `init()`.
 */
export function visitApp(path = '/home', seed: Record<string, unknown> = {}) {
  return cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear()
      // Deterministic UI: Chinese labels, light mode, no wallpaper.
      win.localStorage.setItem('appLanguage', 'zh-CN')
      win.localStorage.setItem('darkMode', 'false')
      Object.entries(seed).forEach(([key, value]) => {
        win.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
      })
      installNativeStubs(win)
    },
  })
}

/** A playlist whose `data` is filled in from the seeded library. */
export interface PlaylistSeed {
  id: number
  name: string
  description?: string
  coverUrl?: string
  songCount?: number
  data?: unknown[]
}

/**
 * Seed a library of three songs and open the home page.
 *
 * `songLists` playlists are normalised here so their `data` matches the same
 * song fixtures (the store reads `allSongs` and `songLists` independently).
 */
export function visitLibrary(seed: Record<string, unknown> = {}) {
  const { songLists, ...rest } = seed as { songLists?: PlaylistSeed[] } & Record<string, unknown>
  const lists = (songLists ?? []).map((list) => ({
    description: '',
    coverUrl: '',
    ...list,
    data: list.data ?? [...seedSongs],
    songCount: (list.data ?? seedSongs).length,
  }))

  return visitApp('/home', {
    allSongs: seedSongs,
    autoDelInvalidSongs: 'false',
    canFetchCoverFromWeb: 'false',
    ...rest,
    ...(songLists ? { songLists: lists } : {}),
  })
}

/** Open the header dropdown ("更多") on the home page. */
export function openHomeMenu() {
  cy.get('.title-actions .circle-button').click()
  return cy.get('.dropdown-menu')
}

/** Create a playlist through the home menu. Returns the name. */
export function createPlaylist(name: string) {
  openHomeMenu()
  cy.get('.dropdown-menu').contains('新建播放列表').click()
  cy.get('.prompt-container .prompt-input').clear().type(name)
  cy.get('.prompt-container .prompt-btn.confirm').click()
  return cy.wrap(name)
}
