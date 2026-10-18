/// <reference types="cypress" />

import { openHomeMenu, visitApp } from '../support/app'

/** Search for a keyword through the online search page. */
function searchOnline(keyword = 'net') {
  visitApp('/search')
  cy.get('.search-input').type(keyword)
  cy.get('.search-button').click()
}

describe('Online search', () => {
  it('shows the initial hint before a search', () => {
    visitApp('/search')
    cy.get('.status-placeholder').should('contain', '输入关键词开始搜索')
  })

  it('searches and renders the results', () => {
    searchOnline()

    cy.get('.song-item').should('have.length', 2)
    cy.get('.song-item').eq(0).should('contain', 'Online One')
    cy.get('.song-item').eq(0).should('contain', 'Net Singer')

    // The keyword is remembered in the history.
    cy.window().then((win) => {
      expect(win.localStorage.getItem('searchHistory')).to.contain('net')
    })
  })

  it('is reachable from the home menu', () => {
    visitApp('/home')
    openHomeMenu()
    cy.get('.dropdown-menu').contains('在线搜索歌曲').click()
    cy.location('pathname').should('eq', '/search')
    cy.get('.status-placeholder').should('contain', '输入关键词开始搜索')
  })

  it('downloads a single result and records the task', () => {
    searchOnline()

    cy.get('.song-item').eq(0).find('.circle-button').click()
    cy.get('.dropdown-menu').contains('下载').click()

    cy.get('.toast').should('contain', '下载成功')
    cy.window().then((win) => {
      const tasks = JSON.parse(win.localStorage.getItem('downloadTasks') || '[]')
      expect(tasks).to.have.length(1)
      expect(tasks[0].status).to.eq('completed')
      expect(tasks[0].name).to.eq('Online One')
      expect(tasks[0].localPath).to.eq('file:///downloads/one.mp3')

      const history = JSON.parse(win.localStorage.getItem('downloadHistory') || '[]')
      expect(history).to.have.length(1)
    })
  })

  it('batch-downloads selected results', () => {
    searchOnline()

    cy.get('.song-item-wrapper').eq(0).longPress()
    cy.get('.bottom-actions').should('be.visible')
    cy.get('.bottom-actions').contains('全选').click()
    cy.get('.bottom-actions').contains('下载选中').click()

    cy.get('.toast').should('contain', '全部 2 首歌曲下载完成')
    cy.window().then((win) => {
      const history = JSON.parse(win.localStorage.getItem('downloadHistory') || '[]')
      expect(history).to.have.length(2)
    })
  })

  it('restores persisted search history and can clear it', () => {
    // History is persisted in localStorage and restored on init.
    visitApp('/home', { searchHistory: ['kuwo'] })
    openHomeMenu()
    cy.get('.dropdown-menu').contains('在线搜索歌曲').click()

    cy.get('.history-item').should('have.length', 1)
    cy.get('.history-item .history-main').should('contain', 'kuwo')

    cy.get('.history-clear').click()
    cy.get('.history-item').should('not.exist')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('searchHistory')).to.eq('[]')
    })
  })
})
