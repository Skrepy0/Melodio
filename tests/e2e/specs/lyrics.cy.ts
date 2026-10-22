/// <reference types="cypress" />

import { visitApp } from '../support/app'
import { seedSongs } from '../support/commands'

describe('Lyrics scrolling', () => {
  it('centers lyrics, preserves manual scrolling and leaves the player header still', () => {
    cy.viewport(390, 844)
    const song = {
      ...seedSongs[0],
      lyric: Array.from(
        { length: 30 },
        (_, i) => `[00:${String(i).padStart(2, '0')}]Line ${i}`
      ).join('\n'),
    }
    visitApp('/player-view', {
      allSongs: [song],
      playQueue: [song],
      playData: { currentIndex: 0, mockCurrentTime: 0 },
      showLyrics: 'true',
      searchLyricsOnline: 'false',
      canFetchCoverFromWeb: 'false',
      autoDelInvalidSongs: 'false',
    })
    cy.get('.lyric-line').should('have.length', 30)
    cy.get('.lyrics').should('have.css', 'touch-action', 'pan-y')
    cy.get('.player-header').should('have.css', 'touch-action', 'auto')
    cy.get('.progress-bar-container').trigger('keydown', { key: 'ArrowRight' })
    cy.get('.lyric-line.active')
      .should('contain', 'Line 5')
      .should(($line) => {
        const line = $line[0].getBoundingClientRect()
        const viewport = $line[0].closest('.lyrics')!.getBoundingClientRect()
        expect(
          Math.abs(line.top + line.height / 2 - viewport.top - viewport.height / 2)
        ).to.be.lessThan(3)
      })
    cy.get('.lyrics').trigger('pointerdown', { pointerId: 42, pointerType: 'touch', clientY: 300 })
    cy.document().trigger('pointermove', { pointerId: 42, clientY: 200 })
    cy.get('.player-view').should(($root) =>
      expect($root[0].style.getPropertyValue('--p')).to.be.oneOf(['', '0.0000'])
    )
    cy.document().trigger('pointercancel', { pointerId: 42 })
    cy.get('.lyrics').trigger('wheel', { deltaY: 100 }).scrollTo(0, 350)
    cy.get('.progress-bar-container').trigger('keydown', { key: 'ArrowRight' })
    cy.get('.lyrics').should(($el) => expect($el[0].scrollTop).to.be.closeTo(350, 2))
    cy.get('.lyric-line.active', { timeout: 6000 })
      .should('contain', 'Line 10')
      .should(($line) => {
        const line = $line[0].getBoundingClientRect()
        const viewport = $line[0].closest('.lyrics')!.getBoundingClientRect()
        expect(
          Math.abs(line.top + line.height / 2 - viewport.top - viewport.height / 2)
        ).to.be.lessThan(3)
      })
  })
})
