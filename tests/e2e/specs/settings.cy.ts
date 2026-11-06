/// <reference types="cypress" />

import { openHomeMenu, visitApp, visitLibrary } from '../support/app'
import { installNativeStubs, seedSongs } from '../support/commands'

/** Home → "更多" → 设置. Navigation goes through the app so `back` works. */
function openSettings() {
  visitApp('/home')
  openHomeMenu()
  cy.get('.dropdown-menu').contains('设置').click()
  cy.location('pathname').should('eq', '/settings')
}

/** Open a settings sub-page through the settings list. */
function openSetting(title: string) {
  cy.get('.ion-page:not(.ion-page-hidden) .setting-item').should('have.length', 6)
  cy.contains('.item-label', new RegExp(`^${title}$`))
    .closest('button')
    .click()
  cy.get('.header-title').should('have.text', title)
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

  it('lists six categories without redundant headings', () => {
    cy.viewport(390, 844)
    cy.get('.header-title').should('have.text', '设置')
    cy.get('.settings-group').should('not.exist')
    cy.get('.item-label').then((labels) => {
      expect([...labels].map((label) => label.textContent)).to.deep.eq([
        '外观与语言',
        '播放',
        '歌词与封面',
        '曲库与搜索',
        '数据与存储',
        '关于',
      ])
    })
  })

  it('navigates to every category and its management pages', () => {
    const categories = [
      ['外观与语言', '/settings/appearance'],
      ['播放', '/settings/playback'],
      ['歌词与封面', '/settings/lyrics'],
      ['曲库与搜索', '/settings/library'],
      ['数据与存储', '/settings/data'],
      ['关于', '/about'],
    ]
    for (const [title, path] of categories) {
      openSetting(title)
      cy.location('pathname').should('eq', path)
      cy.get('.ion-page:not(.ion-page-hidden) .header-title').should('have.text', title)
      goBack('/settings')
    }
    openSetting('曲库与搜索')
    cy.contains('.item-label', /^扫描黑名单$/)
      .closest('button')
      .click()
    cy.location('pathname').should('eq', '/blacklist')
    goBack('/settings/library')
    cy.contains('.setting-item', '音乐源配置').click()
    cy.location('pathname').should('eq', '/settings/library/music-sources')
    goBack('/settings/library')
    goBack('/settings')
    openSetting('数据与存储')
    cy.contains('.setting-item', '歌词缓存').click()
    cy.location('pathname').should('eq', '/settings/data/lyrics-cache')
    goBack('/settings/data')
  })

  it('shows the current language in appearance settings', () => {
    openSetting('外观与语言')
    cy.get('.item-value').should('contain', '简体中文')
  })
})

describe('Interface settings', () => {
  it('toggles dark mode and persists it', () => {
    openSettings()
    openSetting('外观与语言')

    cy.get('html').should('not.have.class', 'dark')
    cy.contains('.setting-item', '深色模式').find('.slider').click()
    cy.get('html').should('have.class', 'dark')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('darkMode')).to.eq('true')
    })
  })

  it('applies a preset theme colour', () => {
    openSettings()
    openSetting('外观与语言')

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
    openSetting('外观与语言')

    cy.get('.color-picker-input').invoke('val', '#123456').trigger('input')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme_color')).to.eq('#123456')
    })
  })
})

describe('Library settings', () => {
  it('persists the toggles', () => {
    openSettings()
    openSetting('曲库与搜索')

    cy.contains('.setting-item', '拼音搜索').find('.slider').click()
    cy.contains('.setting-item', '自动清理无效歌曲').find('.slider').click()

    cy.window().then((win) => {
      expect(win.localStorage.getItem('pinyinSearch')).to.eq('true')
      expect(win.localStorage.getItem('autoDelInvalidSongs')).to.eq('false')
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
    openSetting('曲库与搜索')
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

describe('Data settings', () => {
  it('opens the data backup and import entries', () => {
    openSettings()
    openSetting('数据与存储')
    cy.get('.ion-page:not(.ion-page-hidden) .setting-item').should('have.length', 4)
    cy.contains('.setting-item', '导出备份').should('exist')
    cy.contains('.setting-item', '导入备份').should('contain', '覆盖')
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

describe('Settings compatibility', () => {
  const redirects = [
    ['/settings/interface', '/settings/appearance'],
    ['/settings/online_search', '/settings/library'],
    ['/settings/online_search/music_client', '/settings/library/music-sources'],
    ['/settings/accessibility/lyrics-cache', '/settings/data/lyrics-cache'],
    ['/settings/other', '/settings/data'],
    ['/settings/accessibility', '/settings'],
  ]
  for (const [legacy, canonical] of redirects) {
    it(`redirects ${legacy}`, () => {
      visitApp(legacy)
      cy.location('pathname').should('eq', canonical)
    })
  }
})

describe('Advanced settings', () => {
  for (const [path, seedKey, value] of [
    ['/settings/lyrics', 'lyricsRetryCount', '4'],
    ['/settings/library', 'music_client_limitation', '8'],
  ]) {
    it(`supports keyboard expansion and restores values at ${path}`, () => {
      visitApp(path, { [seedKey]: value })
      cy.get('details').should('not.have.attr', 'open')
      cy.get('details input').first().should('not.be.visible')
      cy.get('summary').then(($summary) => $summary[0].focus())
      cy.get('summary').should('have.focus')
      // Dispatch a native key event so the browser activates the summary.
      cy.then(() =>
        Cypress.automation('remote:debugger:protocol', {
          command: 'Input.dispatchKeyEvent',
          params: {
            type: 'keyDown',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13,
            text: '\r',
            unmodifiedText: '\r',
          },
        })
      )
      cy.then(() =>
        Cypress.automation('remote:debugger:protocol', {
          command: 'Input.dispatchKeyEvent',
          params: { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
        })
      )
      cy.get('details').should('have.attr', 'open')
      cy.get('details input').first().should('be.visible').and('have.value', value)
      cy.get('summary').click()
      cy.get('details').should('not.have.attr', 'open')
      cy.get('summary').click()
      cy.get('details input').first().should('have.value', value).clear().type('9')
      cy.on('window:before:load', installNativeStubs)
      cy.reload()
      cy.get('details').should('not.have.attr', 'open')
      cy.get('summary').click()
      cy.get('details input').first().should('have.value', '9')
    })
  }
})

describe('Playback and lyrics preferences', () => {
  for (const [title, label, storageKey, value] of [
    ['播放', '设备连接时自动播放', 'autoPlayOnConnect', true],
    ['歌词与封面', '在线获取歌曲封面', 'canFetchCoverFromWeb', false],
  ] as const) {
    it(`persists ${label} across navigation and reload`, () => {
      openSettings()
      openSetting(title)
      cy.contains('.setting-item', label).find('.slider').click()
      cy.contains('.setting-item', label)
        .find('input')
        .should(value ? 'be.checked' : 'not.be.checked')
      cy.window().then((win) => expect(win.localStorage.getItem(storageKey)).to.eq(String(value)))
      goBack('/settings')
      openSetting(title)
      cy.contains('.setting-item', label)
        .find('input')
        .should(value ? 'be.checked' : 'not.be.checked')
      cy.on('window:before:load', installNativeStubs)
      cy.reload()
      cy.contains('.setting-item', label)
        .find('input')
        .should(value ? 'be.checked' : 'not.be.checked')
    })
  }
})
