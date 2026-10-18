import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DownloadManagerPage from '@/views/DownloadManagerPage.vue'
import DownloadTaskItem from '@/components/download/DownloadTaskItem.vue'
import DownloadHistoryItem from '@/components/download/DownloadHistoryItem.vue'
import HorizontalSelect from '@/components/HorizontalSelect.vue'
import PageTitle from '@/components/PageTitle.vue'
import { useAppStore } from '@/stores/app'
import type { DownloadTaskSnapshot } from '@/utils/interface'
import { resetPlugins } from '../helpers/capacitor'
import { mountComponent } from '../helpers/mount'
import { clearStorage, freshPinia } from '../helpers/store'

vi.mock('@/utils/createToast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/utils/createConfirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/utils/musicDownloader', () => ({
  pauseDownloadTask: vi.fn(),
  resumeDownloadTask: vi.fn(),
  retryDownloadTask: vi.fn(),
}))
vi.mock('@/router', () => ({ default: { back: vi.fn(), push: vi.fn(async () => {}) } }))

import toast from '@/utils/createToast'
import { showConfirm } from '@/utils/createConfirm'
import { pauseDownloadTask, resumeDownloadTask, retryDownloadTask } from '@/utils/musicDownloader'
import router from '@/router'

const mounted: any[] = []

function makeTask(overrides: Partial<DownloadTaskSnapshot> = {}): DownloadTaskSnapshot {
  return {
    taskId: 'task-1',
    songIdentifier: 'online-1',
    source: 'Kuwo',
    name: 'Song',
    singers: 'Singer',
    album: 'Album',
    ext: 'mp3',
    coverUrl: null,
    fileSizeBytes: 1024,
    duration: 100,
    downloadUrl: 'https://x/a.mp3',
    downloadUrlStatus: null,
    searchKeyword: null,
    progress: 40,
    loaded: 400,
    total: 1000,
    status: 'downloading',
    errorMessage: null,
    localPath: null,
    size: 0,
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  resetPlugins()
  clearStorage()
  freshPinia()
  vi.clearAllMocks()
})

afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted.length = 0
  vi.restoreAllMocks()
})

function mountPage() {
  const wrapper = mountComponent(DownloadManagerPage)
  mounted.push(wrapper)
  return wrapper
}

describe('DownloadManagerPage', () => {
  it('shows the empty active state', async () => {
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.find('.status-placeholder').exists()).toBe(true)
    expect(wrapper.findAllComponents(DownloadTaskItem)).toHaveLength(0)
  })

  it('lists active tasks', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ taskId: 'a' }))
    store.upsertDownloadTask(makeTask({ taskId: 'b', status: 'paused' }))
    store.upsertDownloadTask(makeTask({ taskId: 'c', status: 'completed' }))
    const wrapper = mountPage()
    await nextTick()

    expect(wrapper.findAllComponents(DownloadTaskItem)).toHaveLength(2)
  })

  it('switches to the history tab', async () => {
    const store = useAppStore()
    store.appendDownloadHistory({
      taskId: 'h1',
      songIdentifier: 's',
      name: 'History',
      singers: 'S',
      album: 'A',
      ext: 'mp3',
      coverUrl: null,
      localPath: '/x.mp3',
      size: 2048,
      completedAt: Date.now(),
    })
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(HorizontalSelect).vm.$emit('update:modelValue', 'history')
    await nextTick()

    expect(wrapper.findAllComponents(DownloadHistoryItem)).toHaveLength(1)
  })

  it('shows the empty history state', async () => {
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(HorizontalSelect).vm.$emit('update:modelValue', 'history')
    await nextTick()

    expect(wrapper.find('.status-placeholder').exists()).toBe(true)
  })

  it('pauses a task', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask())
    vi.mocked(pauseDownloadTask).mockResolvedValue({ taskId: 'task-1', status: 'paused' } as any)
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(DownloadTaskItem).vm.$emit('pause', 'task-1')
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(pauseDownloadTask).toHaveBeenCalledWith('task-1')
    expect(toast.success).toHaveBeenCalled()
  })

  it('reports a pause failure', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask())
    vi.mocked(pauseDownloadTask).mockRejectedValue(new Error('cannot pause'))
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(DownloadTaskItem).vm.$emit('pause', 'task-1')
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('cannot pause'))
  })

  it('resumes a task', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ status: 'paused' }))
    vi.mocked(resumeDownloadTask).mockResolvedValue({
      taskId: 'task-1',
      status: 'downloading',
    } as any)
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(DownloadTaskItem).vm.$emit('resume', 'task-1')
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(resumeDownloadTask).toHaveBeenCalledWith('task-1')
    expect(toast.success).toHaveBeenCalled()
  })

  it('reports a resume failure', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ status: 'paused' }))
    vi.mocked(resumeDownloadTask).mockRejectedValue(new Error('no network'))
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(DownloadTaskItem).vm.$emit('resume', 'task-1')
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('no network'))
  })

  it('retries a failed task', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ status: 'failed' }))
    vi.mocked(retryDownloadTask).mockResolvedValue({
      taskId: 'task-1',
      status: 'downloading',
    } as any)
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(DownloadTaskItem).vm.$emit('retry', 'task-1')
    await vi.waitFor(() => expect(retryDownloadTask).toHaveBeenCalledWith('task-1'))
  })

  it('reports a retry failure', async () => {
    const store = useAppStore()
    store.upsertDownloadTask(makeTask({ status: 'failed' }))
    vi.mocked(retryDownloadTask).mockRejectedValue(new Error('still broken'))
    const wrapper = mountPage()
    await nextTick()

    wrapper.findComponent(DownloadTaskItem).vm.$emit('retry', 'task-1')
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('still broken'))
  })

  it('clears the history after confirmation', async () => {
    const store = useAppStore()
    store.appendDownloadHistory({
      taskId: 'h1',
      songIdentifier: 's',
      name: 'History',
      singers: '',
      album: '',
      ext: 'mp3',
      coverUrl: null,
      localPath: '/x.mp3',
      size: 1,
      completedAt: 1,
    })
    vi.mocked(showConfirm).mockResolvedValue(true)
    const wrapper = mountPage()
    await nextTick()
    wrapper.findComponent(HorizontalSelect).vm.$emit('update:modelValue', 'history')
    await nextTick()

    await wrapper.find('.clear-btn').trigger('click')
    await vi.waitFor(() => expect(store.getDownloadHistory()).toHaveLength(0))
    expect(toast.success).toHaveBeenCalled()
  })

  it('keeps the history when clearing is cancelled', async () => {
    const store = useAppStore()
    store.appendDownloadHistory({
      taskId: 'h1',
      songIdentifier: 's',
      name: 'History',
      singers: '',
      album: '',
      ext: 'mp3',
      coverUrl: null,
      localPath: '/x.mp3',
      size: 1,
      completedAt: 1,
    })
    vi.mocked(showConfirm).mockResolvedValue(false)
    const wrapper = mountPage()
    await nextTick()
    wrapper.findComponent(HorizontalSelect).vm.$emit('update:modelValue', 'history')
    await nextTick()

    await wrapper.find('.clear-btn').trigger('click')
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled())
    expect(store.getDownloadHistory()).toHaveLength(1)
  })

  it('goes back', async () => {
    const wrapper = mountPage()
    await nextTick()
    wrapper.findComponent(PageTitle).props('goBack')()
    expect(router.back).toHaveBeenCalled()
  })
})

describe('DownloadTaskItem', () => {
  it('renders progress and status', async () => {
    const wrapper = mountComponent(DownloadTaskItem, { props: { task: makeTask() } })
    await nextTick()

    expect(wrapper.find('.title').text()).toBe('Song')
    expect(wrapper.find('.progress-value').text()).toBe('40%')
    expect(wrapper.find('.progress-fill').attributes('style')).toContain('40%')
    expect(wrapper.text()).toContain('Singer')
  })

  it('shows unknown totals and a placeholder for indefinite progress', () => {
    const wrapper = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ progress: -1, total: -1 }) },
    })
    expect(wrapper.find('.progress-value').text()).toBe('--')
    expect(wrapper.text()).toContain('Unknown')
  })

  it('clamps progress to the 0-100 range', () => {
    const over = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ progress: 140 }) },
    })
    // The bar is clamped to 100%; the label shows the raw reported value.
    expect(over.find('.progress-fill').attributes('style')).toContain('100%')
    expect(over.find('.progress-value').text()).toBe('140%')

    const under = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ progress: -5 }) },
    })
    expect(under.find('.progress-value').text()).toBe('--')
  })

  it('formats byte counts', () => {
    const wrapper = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ loaded: 2048, total: 5 * 1024 * 1024 }) },
    })
    expect(wrapper.text()).toContain('2.0 KB')
    expect(wrapper.text()).toContain('5.0 MB')
  })

  it('emits pause while downloading', async () => {
    const wrapper = mountComponent(DownloadTaskItem, { props: { task: makeTask() } })
    await wrapper.find('.action-btn').trigger('click')
    expect(wrapper.emitted('pause')?.[0]).toEqual(['task-1'])
  })

  it('emits resume while paused', async () => {
    const wrapper = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ status: 'paused' }) },
    })
    await wrapper.find('.action-btn').trigger('click')
    expect(wrapper.emitted('resume')?.[0]).toEqual(['task-1'])
  })

  it('emits retry after a failure and shows the error', async () => {
    const wrapper = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ status: 'failed', errorMessage: 'network down' }) },
    })
    expect(wrapper.find('.error-text').text()).toBe('network down')
    await wrapper.find('.action-btn').trigger('click')
    expect(wrapper.emitted('retry')?.[0]).toEqual(['task-1'])
  })

  it('has no action for completed tasks', () => {
    const wrapper = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ status: 'completed' }) },
    })
    expect(wrapper.find('.action-btn').exists()).toBe(false)
  })

  it('renders a cover image when available', () => {
    const wrapper = mountComponent(DownloadTaskItem, {
      props: { task: makeTask({ coverUrl: 'https://x/c.jpg' }) },
    })
    expect(wrapper.find('img').attributes('src')).toBe('https://x/c.jpg')
  })
})

describe('DownloadHistoryItem', () => {
  it('renders the metadata', () => {
    const wrapper = mountComponent(DownloadHistoryItem, {
      props: {
        item: {
          taskId: 'h',
          songIdentifier: 's',
          name: 'Saved Song',
          singers: 'Singer',
          album: 'Album',
          ext: 'mp3',
          coverUrl: null,
          localPath: '/x.mp3',
          size: 3 * 1024 * 1024,
          completedAt: new Date('2024-05-01T10:00:00Z').getTime(),
        },
      },
    })

    expect(wrapper.find('.title').text()).toBe('Saved Song')
    expect(wrapper.find('.subtitle').text()).toBe('Singer')
    expect(wrapper.text()).toContain('3.0 MB')
    expect(wrapper.text()).toContain('2024')
  })

  it('falls back to the album when there is no singer', () => {
    const wrapper = mountComponent(DownloadHistoryItem, {
      props: {
        item: {
          taskId: 'h',
          songIdentifier: 's',
          name: 'Saved',
          singers: '',
          album: 'Album Only',
          ext: 'mp3',
          coverUrl: null,
          localPath: '/x.mp3',
          size: 0,
          completedAt: 1,
        },
      },
    })
    expect(wrapper.find('.subtitle').text()).toBe('Album Only')
    expect(wrapper.text()).toContain('0 B')
  })
})
