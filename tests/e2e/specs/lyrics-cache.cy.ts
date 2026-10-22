/// <reference types="cypress" />
import { visitApp } from '../support/app'
import { installNativeStubs } from '../support/commands'

describe('Lyrics cache management', () => {
  it('previews and deletes single entries, then clears the cache', () => {
    cy.viewport(390, 844)
    visitApp('/settings/accessibility/lyrics-cache', {
      'syncedLyricsCache:v2:meting-first': {
        [JSON.stringify(['起风了', '买辣椒也用券', 180000])]: {
          title: '起风了',
          artist: '买辣椒也用券',
          album: '单曲',
          lyrics: '[00:01]测试用同步歌词\n[00:03]测试用第二行',
        },
        [JSON.stringify(['晴天', '周杰伦', 180000])]: '[00:01]另一首测试用歌词',
      },
    })
    cy.get('.cache-entry').should('have.length', 2)
    cy.get('.cache-entry').contains('起风了').closest('.cache-entry').find('button').first().click()
    cy.get('.cache-preview').should('contain', '测试用同步歌词')
    cy.get('.preview-action.is-expanded')
      .should('contain', '收起')
      .and('have.attr', 'aria-expanded', 'true')
    cy.screenshot('lyrics-cache-mobile')
    cy.get('.preview-action.is-expanded').click()
    cy.get('.cache-preview').should('not.exist')
    cy.get('.cache-entry').contains('起风了').closest('.cache-entry').find('button').last().click()
    cy.get('.confirm-btn.cancel').click()
    cy.get('.cache-entry').should('have.length', 2)
    cy.get('.cache-entry').contains('起风了').closest('.cache-entry').find('button').last().click()
    cy.get('.confirm-btn.confirm').click()
    cy.get('.cache-entry').should('have.length', 1)
    cy.on('window:before:load', installNativeStubs)
    cy.reload()
    cy.get('.cache-entry').should('have.length', 1)
    cy.get('.cache-toolbar button').last().click()
    cy.get('.confirm-btn.confirm').click()
    cy.get('.cache-entry').should('not.exist')
    cy.get('.cache-status').should('contain', '暂无歌词缓存')
  })
})
