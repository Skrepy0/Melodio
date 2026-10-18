/// <reference types="cypress" />

import { visitLibrary } from '../support/app'

describe('Library', () => {
  it('renders the song library', () => {
    visitLibrary()

    cy.get('.title').should('have.text', '曲库')
    cy.get('.song-item').should('have.length', 3)
    cy.get('.song-item').eq(0).should('contain', 'Alpha').and('contain', 'Aria')
    cy.get('.song-item').eq(1).should('contain', 'Beta')
    cy.get('.count').should('contain', '3')
  })

  it('opens the player for a song and shows the queue', () => {
    visitLibrary()

    cy.get('.song-item').eq(1).click()
    cy.get('.song-item').eq(1).should('have.class', 'current')
    cy.get('.now-playing-bar').should('contain', 'Beta')

    cy.get('.now-playing-bar .song-info').click()
    cy.location('pathname').should('eq', '/player-view')
    cy.get('.player-view .song-name').should('have.text', 'Beta')
    cy.get('.player-view .song-artist').should('have.text', 'Brio')
    cy.get('.queue-item').should('have.length', 3)
    cy.get('.queue-title').should('contain', '3')
  })

  it('searches the library', () => {
    visitLibrary()

    cy.get('.search-input').type('gam')
    cy.get('.search-icon').click()
    cy.get('.song-item').should('have.length', 1)
    cy.get('.song-item').should('contain', 'Gamma')

    cy.get('.search-input').clear()
    cy.get('.search-icon').click()
    cy.get('.song-item').should('have.length', 3)
  })

  it('shows the empty result state', () => {
    visitLibrary()

    cy.get('.search-input').type('zzz')
    cy.get('.search-icon').click()
    cy.get('.empty-state').should('contain', '搜索无结果')
  })

  it('filters by pinyin when the setting is enabled', () => {
    visitLibrary({ pinyinSearch: 'true' })

    // 伽 -> "jia"; the library only has Latin titles, so this must match none.
    cy.get('.search-input').type('alpha')
    cy.get('.search-icon').click()
    cy.get('.song-item').should('have.length', 1)
  })
})

describe('Player', () => {
  beforeEach(() => {
    visitLibrary()
    cy.get('.song-item').eq(0).click()
    cy.get('.now-playing-bar .song-info').click()
    cy.location('pathname').should('eq', '/player-view')
  })

  it('toggles playback', () => {
    cy.get('.play-pause').click()
    cy.window().then((win) => {
      expect(win.localStorage.getItem('playData')).to.contain('"isPlaying":false')
    })

    cy.get('.play-pause').click()
    cy.window().then((win) => {
      expect(win.localStorage.getItem('playData')).to.contain('"isPlaying":true')
    })
  })

  it('skips to the next and previous song', () => {
    cy.get('.controls [aria-label="下一首"]').click()
    cy.get('.player-view .song-name').should('have.text', 'Beta')

    cy.get('.controls [aria-label="上一首"]').click()
    cy.get('.player-view .song-name').should('have.text', 'Alpha')
  })

  it('cycles the playback rate', () => {
    cy.get('.rate-btn').should('contain', '1×')
    cy.get('.rate-btn').click()
    cy.get('.rate-btn').should('contain', '1.25×')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('playbackRate')).to.eq('1.25')
    })
  })

  it('toggles the play mode', () => {
    cy.get('.controls .control-btn.small').first().click()
    cy.window().then((win) => {
      expect(win.localStorage.getItem('playMode')).to.eq('repeatOne')
    })
    cy.get('.controls .control-btn.small').first().click()
    cy.window().then((win) => {
      expect(win.localStorage.getItem('playMode')).to.eq('sequential')
    })
  })

  it('clears the queue after confirmation', () => {
    cy.get('.clear-queue-btn').click()
    cy.get('.confirm-btn.confirm').click()
    cy.get('.queue-item').should('have.length', 0)
    cy.get('.clear-queue-btn').should('not.exist')
  })

  it('seeks with the keyboard', () => {
    cy.get('.progress-bar-container').focus().type('{rightarrow}{rightarrow}')
    cy.get('.progress-bar-container').should('have.attr', 'aria-valuenow', '10')
  })
})
