import { ClientKey, MusicClientStatus } from '@/utils/interface'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { musicClients } from '@/config'

export const useMusicClientStore = defineStore('musicClient', () => {
  const musicClientStatus = ref<MusicClientStatus>()

  const musicClientLimitation = ref<number>(5)

  function initMusicClientLimitation() {
    const stored = localStorage.getItem('music_client_limitation')
    musicClientLimitation.value = stored ? parseInt(stored) : 5
  }

  function getMusicClientLimitation() {
    return musicClientLimitation.value
  }

  function setMusicClientLimitation(limitation: number) {
    musicClientLimitation.value = limitation
    localStorage.setItem('music_client_limitation', String(limitation))
  }

  function initMusicClientStatus() {
    const defaultStatus = Object.fromEntries(
      Object.keys(musicClients).map((key) => [key, false])
    ) as MusicClientStatus
    defaultStatus.Migu = true
    const stored = localStorage.getItem('music_client_status')
    musicClientStatus.value = stored ? (JSON.parse(stored) as MusicClientStatus) : defaultStatus
  }

  function getMusicClientStatus() {
    return musicClientStatus.value
  }

  function setMusicClientStatus(status: MusicClientStatus) {
    musicClientStatus.value = status
    saveMusicClientStatus()
  }

  function setClients(keys: ClientKey[], status: boolean) {
    if (!Array.isArray(keys)) return
    const statusObj = musicClientStatus.value
    if (!statusObj) return

    keys.forEach((key) => {
      statusObj[key] = status
    })
    saveMusicClientStatus()
  }

  function saveMusicClientStatus() {
    localStorage.setItem('music_client_status', JSON.stringify(musicClientStatus.value))
  }

  function getEnabledClients(): string[] {
    const status = musicClientStatus.value
    if (!status) return []

    return (Object.keys(musicClients) as Array<keyof typeof musicClients>)
      .filter((key) => status[key])
      .map((key) => musicClients[key])
  }
  return {
    musicClientStatus,
    musicClientLimitation,
    initMusicClientLimitation,
    getMusicClientLimitation,
    setMusicClientLimitation,
    initMusicClientStatus,
    getMusicClientStatus,
    setMusicClientStatus,
    setClients,
    saveMusicClientStatus,
    getEnabledClients,
    musicClients,
  }
})
