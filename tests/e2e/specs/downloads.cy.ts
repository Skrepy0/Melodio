/// <reference types="cypress" />

import { openHomeMenu, visitApp } from '../support/app'

const now = Date.now()

const downloadingTask = {
  taskId: 'Kuwo:downloading',
  songIdentifier: 'downloading',
  source: 'Kuwo',
  name: 'Downloading Song',
  singers: 'Some Singer',
  album: 'Some Album',
  ext: 'mp3',
  coverUrl: null,
  fileSizeBytes: 1024 * 1024,
  duration: 200,
  downloadUrl: 'https://cdn.example.com/downloading.mp3',
  downloadUrlStatus: { ok: true, status_code: 200, reason: [] },
  searchKeyword: null,
  progress: 42,
  loaded: 440401,
  total: 1048576,
  status: 'downloading',
  errorMessage: null,
  localPath: null,
  size: 0,
  createdAt: now,
  updatedAt: now,
  completedAt: null,
}

const pausedTask = {
  ...downloadingTask,
  taskId: 'Kuwo:paused',
  songIdentifier: 'paused',
  name: 'Paused Song',
  progress: 12,
  loaded: 125829,
  status: 'paused',
}

const historyItem = {
  taskId: 'Kuwo:done',
  songIdentifier: 'done',
  name: 'Done Song',
  singers: 'Done Singer',
  album: 'Done Album',
  ext: 'mp3',
  coverUrl: null,
  localPath: 'file:///downloads/done.mp3',
  size: 2048,
  completedAt: now,
}

describe('Download manager', () => {
  it('shows the empty state', () => {
    visitApp('/downloads')
    cy.get('.header-title').should('have.text', '下载管理')
    cy.get('.status-placeholder').should('contain', '当前没有下载任务')
  })

  it('lists restored tasks with their progress', () => {
    // A task persisted mid-download cannot be resumed by the native side after
    // the app restarts, so the store restores every non-terminal task as paused.
    visitApp('/downloads', { downloadTasks: [downloadingTask, pausedTask] })

    cy.get('.download-task-item').should('have.length', 2)
    cy.get('.download-task-item').eq(0).find('.title').should('have.text', 'Downloading Song')
    cy.get('.download-task-item').eq(0).find('.progress-value').should('have.text', '42%')
    cy.get('.download-task-item').eq(0).find('.status').should('have.text', '已暂停')
    cy.get('.download-task-item').eq(0).find('.action-btn').should('have.text', '继续')
    cy.get('.download-task-item').eq(1).find('.action-btn').should('have.text', '继续')
  })

  it('pauses a downloading task', () => {
    visitApp('/downloads', { downloadTasks: [pausedTask] })

    // Keep the resume in flight so the task stays in the "downloading" state.
    cy.stubPlugin('Downloader', {
      resumeDownload: () => new Promise(() => {}),
    })

    cy.get('.download-task-item .action-btn').should('have.text', '继续').click()
    cy.get('.download-task-item .status').should('have.text', '下载中')
    cy.get('.download-task-item .action-btn').should('have.text', '暂停').click()

    cy.get('.toast').should('contain', '下载已暂停')
    cy.get('.download-task-item .status').should('have.text', '已暂停')
    cy.get('.download-task-item .action-btn').should('have.text', '继续')
    cy.window().then((win) => {
      const tasks = JSON.parse(win.localStorage.getItem('downloadTasks') || '[]')
      expect(tasks[0].status).to.eq('paused')
    })
  })

  it('resumes a paused task and moves it to history', () => {
    visitApp('/downloads', { downloadTasks: [pausedTask] })

    cy.get('.download-task-item .action-btn').click()
    cy.get('.toast').should('contain', '下载已继续')
    cy.get('.status-placeholder').should('contain', '当前没有下载任务')
    cy.window().then((win) => {
      const history = JSON.parse(win.localStorage.getItem('downloadHistory') || '[]')
      expect(history).to.have.length(1)
      expect(history[0].name).to.eq('Paused Song')
    })
  })

  it('shows completed downloads in the history tab', () => {
    visitApp('/downloads', { downloadHistory: [historyItem] })

    cy.get('.select-item').contains('已完成').click()
    cy.get('.download-history-item').should('have.length', 1)
    cy.get('.download-history-item').should('contain', 'Done Song')
    cy.get('.download-history-item').should('contain', '2.0 KB')
  })

  it('clears the history after confirmation', () => {
    visitApp('/downloads', { downloadHistory: [historyItem] })

    cy.get('.select-item').contains('已完成').click()
    cy.get('.clear-btn').click()
    cy.get('.confirm-btn.confirm').click()

    cy.get('.status-placeholder').should('contain', '暂无下载历史')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('downloadHistory')).to.eq('[]')
    })
  })

  it('is reachable from the home menu', () => {
    visitApp('/home')
    openHomeMenu()
    cy.get('.dropdown-menu').contains('下载管理').click()
    cy.location('pathname').should('eq', '/downloads')
    cy.get('.header-title').should('have.text', '下载管理')
  })
})
