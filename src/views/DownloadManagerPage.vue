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
import { resumeDownloadTask, pauseDownloadTask, retryDownloadTask } from '@/utils/musicDownloader'
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
      <div class="header">
        <PageTitle :go-back="goBack" :title="$t('downloads.title')" />
        <HorizontalSelect v-model="currentTab" :options="tabOptions" />
      </div>

      <div class="content">
        <template v-if="currentTab === 'active'">
          <div v-if="activeTasks.length === 0" class="status-placeholder">
            <Icon
              color="var(--text-secondary)"
              height="36"
              icon="mdi:download-off-outline"
              width="36"
            />
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
            <Icon color="var(--text-secondary)" height="36" icon="mdi:history" width="36" />
            <span class="status-text">{{ $t('downloads.empty.history') }}</span>
          </div>
          <div v-else class="list">
            <DownloadHistoryItem v-for="item in historyItems" :key="item.taskId" :item="item" />
          </div>
        </template>
      </div>

      <NowPlayingBar auto-play @expand="() => router.push('/player-view')" />
    </div>
  </ion-page>
</template>

<style lang="scss" scoped>
.downloads-page {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 80px;
}

.header {
  background: transparent;
  border-bottom: none;
}

.content {
  padding: 12px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary, #8b949e);
  gap: 12px;
  text-align: center;
}

.status-text {
  font-size: 16px;
  line-height: 1.5;
  max-width: 320px;
}

.history-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.clear-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 107, 107, 0.12);
  color: #ff6b6b;
  font-size: 13px;
}
</style>
