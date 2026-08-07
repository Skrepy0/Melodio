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
  Netease: {
    name: 'NeteaseMusicClient',
    icon: 'tabler:brand-netease-music',
  },
  QQ: {
    name: 'QQMusicClient',
    icon: '',
  },
  Apple: {
    name: 'AppleMusicClient',
    icon: 'ic:baseline-apple',
  },
  Joox: {
    name: 'JooxMusicClient',
    icon: '',
  },
  Qobuz: {
    name: 'QobuzMusicClient',
    icon: 'arcticons:qobuz',
  },
  Suno: {
    name: 'SunoMusicClient',
    icon: 'simple-icons:suno',
  },
  MyFreeMP3: {
    name: 'MyFreeMP3MusicClient',
    icon: '',
  },
  TuneHub: {
    name: 'TuneHubMusicClient',
    icon: '',
  },
  XiaoBai: {
    name: 'XiaoBaiMusicClient',
    icon: '',
  },
  Fangpi: {
    name: 'FangpiMusicClient',
    icon: '',
  },
  Gequbao: {
    name: 'GequbaoMusicClient',
    icon: '',
  },
  Gequhai: {
    name: 'GequhaiMusicClient',
    icon: '',
  },
  Mitu: {
    name: 'MituMusicClient',
    icon: '',
  },
  TwoT58: {
    name: 'TwoT58MusicClient',
    icon: '',
  },
  Zhuolin: {
    name: 'ZhuolinMusicClient',
    icon: '',
  },
}

export const musicClients = Object.fromEntries(
  Object.entries(musicClientsConfig).map(([key, val]) => [key, val.name])
) as Record<ClientKey, string>
