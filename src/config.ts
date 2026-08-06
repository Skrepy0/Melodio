import { ClientKey } from '@/utils/interface'

export const musicClientsConfig = {
  Bilibili: {
    name: 'BilibiliMusicClient',
    icon: 'mingcute:bilibili-line',
  },
  Bodian: {
    name: 'BodianMusicClient',
    icon: '',
  },
  FiveSing: {
    name: 'FiveSingMusicClient',
    icon: 'mingcute:microphone-line',
  },
  Kugou: {
    name: 'KugouMusicClient',
    icon: '',
  },
  Kuwo: {
    name: 'KuwoMusicClient',
    icon: '',
  },
  Migu: {
    name: 'MiguMusicClient',
    icon: 'arcticons:migu',
  },
  MOOV: {
    name: 'MOOVMusicClient',
    icon: 'token:moov',
  },
  Netease: {
    name: 'NeteaseMusicClient',
    icon: 'tabler:brand-netease-music',
  },
  Qianqian: {
    name: 'QianqianMusicClient',
    icon: '',
  },
  QQ: {
    name: 'QQMusicClient',
    icon: '',
  },
  Soda: {
    name: 'SodaMusicClient',
    icon: '',
  },
  StreetVoice: {
    name: 'StreetVoiceMusicClient',
    icon: '',
  },
}

export const musicClients = Object.fromEntries(
  Object.entries(musicClientsConfig).map(([key, val]) => [key, val.name])
) as Record<ClientKey, string>
