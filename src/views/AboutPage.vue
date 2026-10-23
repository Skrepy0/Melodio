<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { IonPage } from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import PageTitle from '@/components/PageTitle.vue'

const router = useRouter()
const version = ref(__APP_VERSION__)
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

<template>
  <ion-page>
    <div class="about-page">
      <PageTitle :go-back="goBack" :title="$t('about.title')" />

      <div class="about-content">
        <div class="identity">
          <div class="app-name">Melodio</div>
          <div class="app-version tabular">v{{ version }}</div>
        </div>

        <div class="settings-group">
          <button class="info-item" type="button" @click="openUrl(repoUrl)">
            <Icon :width="22" class="info-icon" icon="mdi:github" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.repository') }}</div>
              <div class="info-value">GitHub / Skrepy0/Melodio</div>
            </div>
            <Icon :width="18" class="external-icon" icon="mdi:open-in-new" />
          </button>

          <button class="info-item" type="button" @click="openUrl(issuesUrl)">
            <Icon :width="22" class="info-icon" icon="mdi:bug-outline" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.feedback') }}</div>
              <div class="info-value">{{ $t('about.reportIssue') }}</div>
            </div>
            <Icon :width="18" class="external-icon" icon="mdi:open-in-new" />
          </button>

          <div class="info-item">
            <Icon :width="22" class="info-icon" icon="mdi:account-circle-outline" />
            <div class="info-text">
              <div class="info-label">{{ $t('about.author') }}</div>
              <div class="info-value">Skrepy</div>
            </div>
          </div>

          <div class="info-item">
            <Icon :width="22" class="info-icon" icon="mdi:license" />
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

<style lang="scss" scoped>
@use '../theme/settings.scss';

.about-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
}

.about-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 calc(40px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  @include custom-scrollbar(3px);
}

// The app signs the page like a title page: name, version, then the facts.
.identity {
  padding: var(--space-8) var(--space-4) var(--space-6);
}

.app-name {
  font-size: var(--font-size-title);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.03em;
  line-height: var(--line-height-tight);
  color: var(--text-color);
}

.app-version {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 56px;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-color);
  font: inherit;
  text-align: left;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: calc(var(--space-4) + 34px);
    right: 0;
    bottom: 0;
    height: 1px;
    background-color: var(--hairline);
    transform: scaleY(0.5);
    transform-origin: bottom;
  }

  &:last-child::after {
    display: none;
  }

  &[type='button'] {
    cursor: pointer;

    &:hover {
      background-color: var(--bg-card-dimmed);
    }

    &:active {
      background-color: var(--bg-secondary);
    }
  }
}

.info-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.info-text {
  flex: 1;
  min-width: 0;
}

.info-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-bottom: 2px;
}

.info-value {
  font-size: var(--font-size-base);
  color: var(--text-color);
  word-break: break-all;
}

.external-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.license-text {
  padding: var(--space-6) var(--space-4) var(--space-4);
  border-top: 1px solid var(--hairline);
  margin-top: var(--space-6);
}

.license-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin-bottom: var(--space-2);
}

.license-summary {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  line-height: var(--line-height-relaxed);

  a {
    color: var(--primary-color);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}
</style>
