<template>
  <ion-page>
    <div class="about-page">
      <div class="about-header">
        <div class="header-back" @click="goBack">
          <Icon icon="material-symbols:arrow-back" :width="24" color="var(--text-color)" />
        </div>
        <div class="header-title">{{ $t('about.title') }}</div>
      </div>

      <div class="about-content">
        <div class="app-name">Melodio</div>
        <div class="app-version">v{{ version }}</div>

        <div class="info-section">
          <div class="info-item" @click="openUrl(repoUrl)">
            <Icon icon="mdi:github" :width="24" class="info-icon" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.repository') }}</div>
              <div class="info-value">GitHub / Skrepy0/Melodio</div>
            </div>
            <Icon icon="mdi:open-in-new" :width="20" class="external-icon" />
          </div>

          <div class="info-item" @click="openUrl(issuesUrl)">
            <Icon icon="mdi:bug-outline" :width="24" class="info-icon" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.feedback') }}</div>
              <div class="info-value">{{ $t('about.reportIssue') }}</div>
            </div>
            <Icon icon="mdi:open-in-new" :width="20" class="external-icon" />
          </div>

          <div class="info-item">
            <Icon icon="mdi:account-circle-outline" :width="24" class="info-icon" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.author') }}</div>
              <div class="info-value">Skrepy</div>
            </div>
          </div>

          <div class="info-item">
            <Icon icon="mdi:license" :width="24" class="info-icon" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.license') }}</div>
              <div class="info-value">Apache License 2.0</div>
            </div>
          </div>
        </div>

        <div class="license-text">
          <div class="license-title">Apache License, Version 2.0</div>
          <div class="license-summary">
            Copyright © 2025 Skrepy. Licensed under the Apache License, Version 2.0. You may obtain
            a copy of the License at
            <a
              href="http://www.apache.org/licenses/LICENSE-2.0"
              @click.stop="openUrl('http://www.apache.org/licenses/LICENSE-2.0')"
            >
              http://www.apache.org/licenses/LICENSE-2.0 </a
            >. Unless required by applicable law or agreed to in writing, software distributed under
            the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
            KIND, either express or implied.
          </div>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { IonPage } from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

const router = useRouter()
const version = ref('0.0.3')
const repoUrl = 'https://github.com/Skrepy0/Melodio'
const issuesUrl = 'https://github.com/Skrepy0/Melodio/issues'

const goBack = () => {
  router.back()
}

const openUrl = async (url: string) => {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
  } else {
    window.open(url, '_blank')
  }
}
</script>

<style scoped lang="scss">
.about-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

.about-header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 60px;
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--header-border-bottom);
  flex-shrink: 0;
}

.header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
  &:hover {
    background-color: var(--header-back-hover);
  }
}

.header-title {
  margin-left: 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.about-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-icon {
  margin-bottom: 16px;
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-color-dark));
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
}

.app-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 6px;
}

.app-version {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.info-section {
  width: 100%;
  background: var(--bg-card);
  border-radius: 20px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
}

.info-item {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 15px;
  border-bottom: 1px solid var(--setting-border);
  cursor: pointer;
  transition: background 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--setting-hover-bg);
  }
}

.info-icon {
  flex-shrink: 0;
  color: var(--primary-color);
}

.info-text {
  flex: 1;
  min-width: 0;
}

.info-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color);
  word-break: break-all;
}

.external-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
  opacity: 0.6;
}

.license-text {
  width: 100%;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.license-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
}

.license-summary {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  a {
    color: var(--primary-color);
    text-decoration: none;
  }
}
</style>
