<script lang="ts" setup>
import { computed, ref } from 'vue'
import { IonPage } from '@ionic/vue'
import { Icon } from '@iconify/vue'
import PageTitle from '@/components/PageTitle.vue'
import HorizontalSelect from '@/components/HorizontalSelect.vue'
import NowPlayingBar from '@/components/NowPlayingBar.vue'
import DownloadTaskItem from '@/components/download/DownloadTaskItem.vue'
import DownloadHistoryItem from '@/components/download/DownloadHistoryItem.vue'
import router from '@/router'
import { useAppStore } from '@/stores/app'
import { showConfirm } from '@/utils/createConfirm'
import toast from '@/utils/createToast'
import { pauseDownloadTask, resumeDownloadTask, retryDownloadTask } from '@/utils/musicDownloader'
import { useI18n } from 'vue-i18n'
import type { HorizontalSelectOption } from '@/utils/interface'

const { t } = useI18n()
const appStore = useAppStore()
const currentTab = ref<'active' | 'history'>('active')

const tabOptions = computed<HorizontalSelectOption[]>(() => [
  {
    value: 'active',
    label: t('downloads.tabs.active'),
    icon: 'material-symbols:download-rounded',
  },
  {
    value: 'history',
    label: t('downloads.tabs.history'),
    icon: 'mdi:history',
  },
])

const activeTasks = computed(() => appStore.getActiveDownloadTasks())
const historyItems = computed(() => appStore.getDownloadHistory())

const goBack = () => router.back()

const onPause = async (taskId: string) => {
  try {
    await pauseDownloadTask(taskId)
    toast.success(t('downloads.toast.paused'))
  } catch (error: any) {
    toast.error(error?.message || t('downloads.toast.pauseFailed'))
  }
}

const onResume = async (taskId: string) => {
  try {
    await resumeDownloadTask(taskId)
    toast.success(t('downloads.toast.resumed'))
  } catch (error: any) {
    toast.error(error?.message || t('downloads.toast.resumeFailed'))
  }
}

const onRetry = async (taskId: string) => {
  try {
    await retryDownloadTask(taskId)
  } catch (error: any) {
    toast.error(error?.message || t('downloads.toast.retryFailed'))
  }
}

const clearHistory = async () => {
  const confirmed = await showConfirm({
    title: t('downloads.clearHistory.title'),
    message: t('downloads.clearHistory.message'),
    confirmText: t('downloads.clearHistory.confirm'),
    cancelText: t('downloads.clearHistory.cancel'),
  })
  if (!confirmed) return
  appStore.clearDownloadHistory()
  toast.success(t('downloads.toast.historyCleared'))
}
</script>

<template>
  <ion-page>
    <div class="downloads-page">
      <PageTitle :go-back="goBack" :title="$t('downloads.title')" />

      <div class="tabs-bar">
        <HorizontalSelect v-model="currentTab" :options="tabOptions" icon-size="16" />
      </div>

      <div class="content">
        <template v-if="currentTab === 'active'">
          <div v-if="activeTasks.length === 0" class="status-placeholder">
            <Icon :width="32" class="status-icon" icon="mdi:download-off-outline" />
            <span class="status-text">{{ $t('downloads.empty.active') }}</span>
          </div>
          <div v-else class="list">
            <DownloadTaskItem
              v-for="task in activeTasks"
              :key="task.taskId"
              :task="task"
              @pause="onPause"
              @resume="onResume"
              @retry="onRetry"
            />
          </div>
        </template>

        <template v-else>
          <div v-if="historyItems.length > 0" class="history-header">
            <button class="clear-btn" @click="clearHistory">
              {{ $t('downloads.actions.clearHistory') }}
            </button>
          </div>
          <div v-if="historyItems.length === 0" class="status-placeholder">
            <Icon :width="32" class="status-icon" icon="mdi:history" />
            <span class="status-text">{{ $t('downloads.empty.history') }}</span>
          </div>
          <div v-else class="list">
            <DownloadHistoryItem v-for="item in historyItems" :key="item.taskId" :item="item" />
          </div>
        </template>
      </div>

      <NowPlayingBar @expand="() => router.push('/player-view')" />
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.downloads-page {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: calc(96px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  background-color: var(--bg-color);
  @include custom-scrollbar(3px);
}

.tabs-bar {
  padding: 0 var(--space-4) var(--space-2);
}

.content {
  padding: 0;
}

.list {
  display: flex;
  flex-direction: column;
}

.status-placeholder {
  @include empty-state;

  .status-icon {
    color: var(--text-tertiary);
    opacity: 0.7;
  }
}

.status-text {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  max-width: 320px;
}

.history-header {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-2) var(--space-4);
}

.clear-btn {
  padding: var(--space-1) var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--danger-color);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;

  &:hover {
    background: var(--setting-hover-bg);
  }
}
</style>
