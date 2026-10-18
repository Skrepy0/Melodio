/// <reference types="cypress" />

import { createPlaylist, visitLibrary } from '../support/app'
import { seedSongs } from '../support/commands'

describe('Playlists', () => {
  it('creates a playlist from the home menu', () => {
    visitLibrary()
    createPlaylist('Road Trip')

    // Creating a playlist switches the view to the playlist tab.
    cy.get('.playlist-item').should('have.length', 2)
    cy.get('.playlist-item').eq(1).should('contain', 'Road Trip')
    cy.window().then((win) => {
      const lists = JSON.parse(win.localStorage.getItem('songLists') || '[]')
      expect(lists).to.have.length(1)
      expect(lists[0].name).to.eq('Road Trip')
    })
  })

  it('opens a playlist and plays its songs', () => {
    visitLibrary({ songLists: [{ id: 1, name: 'Mix' }] })

    cy.get('.select-item').contains('播放列表').click()
    cy.get('.playlist-item').should('have.length', 2)
    cy.get('.playlist-item').contains('Mix').click()

    cy.location('pathname').should('eq', '/song-list')
    cy.get('.song-list-page .title').should('have.text', 'Mix')
    cy.get('.song-item').should('have.length', 3)

    cy.get('.play-all').click()
    cy.get('.now-playing-bar').should('contain', 'Alpha')
  })

  it('renames a playlist from its menu', () => {
    visitLibrary({ songLists: [{ id: 1, name: 'Mix', data: [] }] })
    cy.get('.select-item').contains('播放列表').click()

    cy.contains('.playlist-item', 'Mix').find('.circle-button').click()
    cy.get('.dropdown-menu').contains('编辑名称').click()
    cy.get('.prompt-container .prompt-input').clear().type('Renamed')
    cy.get('.prompt-container .prompt-btn.confirm').click()

    cy.get('.playlist-item').contains('Renamed').should('exist')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('songLists')).to.contain('Renamed')
    })
  })

  it('deletes a playlist after confirmation', () => {
    visitLibrary({ songLists: [{ id: 1, name: 'Mix', data: [] }] })
    cy.get('.select-item').contains('播放列表').click()

    cy.contains('.playlist-item', 'Mix').find('.circle-button').click()
    cy.get('.dropdown-menu').contains('删除').click()
    cy.get('.confirm-btn.confirm').click()

    cy.get('.playlist-item').should('have.length', 1)
    cy.get('.playlist-item').should('contain', '我喜欢')
  })

  it('protects the default (liked) playlist', () => {
    visitLibrary()
    cy.get('.select-item').contains('播放列表').click()
    cy.get('.playlist-item').first().find('.circle-button').click()
    cy.get('.dropdown-menu').contains('删除').click()

    cy.get('.toast').should('contain', '无法对默认播放列表执行此操作')
    cy.get('.playlist-item').should('have.length', 1)
  })

  it('adds selected songs to a playlist from multi-select', () => {
    visitLibrary({ songLists: [{ id: 1, name: 'Mix', data: [] }] })

    cy.get('.song-item-wrapper').eq(0).longPress()
    cy.get('.bottom-actions').should('be.visible')
    cy.get('.checkbox-area').eq(1).click()
    cy.get('.bottom-actions').contains('添加到播放列表').click()

    cy.get('.playlist-selector-item').contains('Mix').click()
    cy.window().then((win) => {
      const lists = JSON.parse(win.localStorage.getItem('songLists') || '[]')
      expect(lists[0].data).to.have.length(2)
      expect(lists[0].data.map((s: any) => s.title)).to.deep.eq(['Alpha', 'Beta'])
    })
  })

  it('removes a song from a playlist', () => {
    visitLibrary({ songLists: [{ id: 1, name: 'Mix' }] })
    cy.get('.select-item').contains('播放列表').click()
    cy.get('.playlist-item').contains('Mix').click()

    cy.get('.song-item').eq(0).find('.circle-button').click()
    cy.get('.dropdown-menu').contains('删除').click()
    cy.get('.confirm-btn.confirm').click()

    cy.get('.song-item').should('have.length', 2)
    cy.window().then((win) => {
      const lists = JSON.parse(win.localStorage.getItem('songLists') || '[]')
      expect(lists[0].data).to.have.length(2)
    })
  })

  it('sorts a playlist and saves the order', () => {
    // Deliberately not alphabetical: Gamma, Alpha, Beta.
    visitLibrary({
      songLists: [{ id: 1, name: 'Mix', data: [seedSongs[2], seedSongs[0], seedSongs[1]] }],
    })

    cy.get('.select-item').contains('播放列表').click()
    cy.get('.playlist-item').contains('Mix').click()
    cy.get('.nav-actions .circle-button').click()
    cy.get('.dropdown-menu').contains('排序').click()

    cy.location('pathname').should('eq', '/sort-song')
    cy.get('.song-row').should('have.length', 3)
    cy.get('.song-row .song-name').eq(0).should('have.text', 'Gamma')
    cy.get('.song-count').should('contain', '3')

    cy.get('.mode-select').select('title')
    cy.get('.song-row .song-name').eq(0).should('have.text', 'Alpha')

    cy.get('.save-btn').click()
    cy.location('pathname').should('eq', '/song-list')
    cy.get('.song-item').eq(0).should('contain', 'Alpha')
    cy.window().then((win) => {
      const lists = JSON.parse(win.localStorage.getItem('songLists') || '[]')
      expect(lists[0].data.map((s: any) => s.title)).to.deep.eq(['Alpha', 'Beta', 'Gamma'])
    })
  })
})
