/// <reference types="cypress" />

import { openHomeMenu, visitApp, visitLibrary } from '../support/app'
import { seedSongs } from '../support/commands'

/** Home → "更多" → 设置. Navigation goes through the app so `back` works. */
function openSettings() {
  visitApp('/home')
  openHomeMenu()
  cy.get('.dropdown-menu').contains('设置').click()
  cy.location('pathname').should('eq', '/settings')
}

/** Open a settings sub-page through the settings list. */
function openSetting(title: string) {
  cy.get('.setting-item').should('have.length', 7)
  cy.get('.setting-item').contains(title).click()
}

/**
 * Go back one page.
 *
 * The app's own back button calls `router.back()`, so browser history is the
 * same thing — and it avoids racing the Ionic page transition, which keeps the
 * outgoing page in the DOM while the incoming one renders.
 */
function goBack(expectedPath: string) {
  cy.go('back')
  cy.location('pathname').should('eq', expectedPath)
}

describe('Settings', () => {
  beforeEach(() => {
    openSettings()
  })

  it('lists every settings group', () => {
    cy.get('.header-title').should('have.text', '设置')
    cy.get('.settings-group').should('have.length', 4)
    cy.get('.group-title').eq(0).should('have.text', '外观')
    cy.get('.group-title').eq(1).should('have.text', '播放')
    cy.get('.group-title').eq(2).should('have.text', '数据')
    cy.get('.group-title').eq(3).should('have.text', '关于')
    cy.get('.setting-item').should('have.length', 7)
  })

  it('navigates to every sub-page', () => {
    openSetting('主题设置')
    cy.location('pathname').should('eq', '/settings/interface')
    cy.get('.header-title').should('have.text', '主题设置')
    goBack('/settings')

    openSetting('在线获取歌曲')
    cy.location('pathname').should('eq', '/settings/online_search')
    cy.get('.header-title').should('have.text', '在线获取歌曲')
    goBack('/settings')

    openSetting('辅助功能')
    cy.location('pathname').should('eq', '/settings/accessibility')
    cy.get('.header-title').should('have.text', '辅助功能')
    goBack('/settings')

    openSetting('黑名单')
    cy.location('pathname').should('eq', '/blacklist')
    goBack('/settings')

    openSetting('杂项')
    cy.location('pathname').should('eq', '/settings/other')
    cy.get('.header-title').should('have.text', '杂项')
    goBack('/settings')

    openSetting('关于')
    cy.location('pathname').should('eq', '/about')
    cy.get('.header-title').should('have.text', '关于')
  })

  it('shows the current language', () => {
    cy.get('.item-value').should('contain', '简体中文')
  })
})

describe('Interface settings', () => {
  it('toggles dark mode and persists it', () => {
    openSettings()
    openSetting('主题设置')

    cy.get('html').should('not.have.class', 'dark')
    cy.contains('.setting-item', '深色模式').find('.slider').click()
    cy.get('html').should('have.class', 'dark')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('darkMode')).to.eq('true')
    })
  })

  it('applies a preset theme colour', () => {
    openSettings()
    openSetting('主题设置')

    cy.get('.preset-color-item').eq(1).click()
    cy.get('.preset-color-item').eq(1).should('have.attr', 'aria-checked', 'true')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme_color')).to.eq('#d93a3a')
      expect(win.document.documentElement.style.getPropertyValue('--primary-color')).to.eq(
        '#d93a3a'
      )
    })
  })

  it('applies a custom colour from the picker', () => {
    openSettings()
    openSetting('主题设置')

    cy.get('.color-picker-input').invoke('val', '#123456').trigger('input')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme_color')).to.eq('#123456')
    })
  })
})

describe('Accessibility settings', () => {
  it('persists the toggles', () => {
    openSettings()
    openSetting('辅助功能')

    cy.contains('.setting-item', '拼音搜索').find('.slider').click()
    cy.contains('.setting-item', '设备连接时自动播放').find('.slider').click()
    cy.contains('.setting-item', '自动清理无效歌曲').find('.slider').click()
    cy.contains('.setting-item', '在线获取歌曲封面').find('.slider').click()

    cy.window().then((win) => {
      expect(win.localStorage.getItem('pinyinSearch')).to.eq('true')
      expect(win.localStorage.getItem('autoPlayOnConnect')).to.eq('true')
      expect(win.localStorage.getItem('autoDelInvalidSongs')).to.eq('false')
      expect(win.localStorage.getItem('canFetchCoverFromWeb')).to.eq('false')
    })
  })

  it('applies pinyin search to the library', () => {
    const chineseSong = {
      ...seedSongs[0],
      id: '4',
      displayName: '伽马.mp3',
      uri: 'file:///music/jiāma.mp3',
      title: '伽马',
      artist: '回声',
      album: '第四',
    }
    visitLibrary({ allSongs: [...seedSongs, chineseSong] })

    // Without pinyin search a Latin keyword cannot match a Chinese title.
    cy.get('.search-input').type('jiama')
    cy.get('.search-icon').click()
    cy.get('.song-item').should('have.length', 0)
    cy.get('.search-input').clear()

    cy.get('.title-actions .circle-button').click()
    cy.get('.dropdown-menu').contains('设置').click()
    openSetting('辅助功能')
    cy.contains('.setting-item', '拼音搜索').find('.slider').click()
    cy.window().then((win) => {
      expect(win.localStorage.getItem('pinyinSearch')).to.eq('true')
    })

    goBack('/settings')
    goBack('/home')

    // 伽马 -> "jiama"; with pinyin search enabled the song is found.
    cy.get('.search-input').type('jiama')
    cy.get('.search-icon').click()
    cy.get('.song-item').should('have.length', 1)
    cy.get('.song-item').should('contain', '伽马')
  })
})

describe('Other settings', () => {
  it('opens the data backup and import entries', () => {
    openSettings()
    openSetting('杂项')
    cy.get('.setting-item').should('have.length', 2)
    cy.get('.setting-item').eq(0).should('contain', '数据备份')
    cy.get('.setting-item').eq(1).should('contain', '导入数据')
  })
})

describe('About', () => {
  it('shows the app information', () => {
    openSettings()
    openSetting('关于')
    cy.get('.header-title').should('have.text', '关于')
    cy.get('.about-page').should('exist')
    cy.contains('开源仓库').should('exist')
    cy.contains('许可证').should('exist')
  })
})
