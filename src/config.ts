import { ClientKey } from '@/utils/interface'

export const musicClientsConfig = {
  Bilibili: {
    name: 'BilibiliMusicClient',
    icon: 'mingcute:bilibili-line',
    displayName: {
      'zh-CN': '哔哩哔哩',
      'en-US': 'Bilibili',
    },
  },
  Bodian: {
    name: 'BodianMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '波点音乐',
      'en-US': 'Bodian',
    },
  },
  Kugou: {
    name: 'KugouMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '酷狗音乐',
      'en-US': 'Kugou',
    },
  },
  Kuwo: {
    name: 'KuwoMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '酷我音乐',
      'en-US': 'Kuwo',
    },
  },
  Migu: {
    name: 'MiguMusicClient',
    icon: 'arcticons:migu',
    displayName: {
      'zh-CN': '咪咕音乐',
      'en-US': 'Migu',
    },
  },
  Netease: {
    name: 'NeteaseMusicClient',
    icon: 'tabler:brand-netease-music',
    displayName: {
      'zh-CN': '网易云音乐',
      'en-US': 'Netease',
    },
  },
  QQ: {
    name: 'QQMusicClient',
    icon: '',
    displayName: {
      'zh-CN': 'QQ音乐',
      'en-US': 'QQ Music',
    },
  },
  Apple: {
    name: 'AppleMusicClient',
    icon: 'ic:baseline-apple',
    displayName: {
      'zh-CN': 'Apple Music',
      'en-US': 'Apple Music',
    },
  },
  Joox: {
    name: 'JooxMusicClient',
    icon: '',
    displayName: {
      'zh-CN': 'JOOX',
      'en-US': 'JOOX',
    },
  },
  Qobuz: {
    name: 'QobuzMusicClient',
    icon: 'arcticons:qobuz',
    displayName: {
      'zh-CN': 'Qobuz',
      'en-US': 'Qobuz',
    },
  },
  Suno: {
    name: 'SunoMusicClient',
    icon: 'simple-icons:suno',
    displayName: {
      'zh-CN': 'Suno',
      'en-US': 'Suno',
    },
  },
  MyFreeMP3: {
    name: 'MyFreeMP3MusicClient',
    icon: '',
    displayName: {
      'zh-CN': 'MyFreeMP3',
      'en-US': 'MyFreeMP3',
    },
  },
  TuneHub: {
    name: 'TuneHubMusicClient',
    icon: '',
    displayName: {
      'zh-CN': 'TuneHub',
      'en-US': 'TuneHub',
    },
  },
  XiaoBai: {
    name: 'XiaoBaiMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '小白音乐',
      'en-US': 'XiaoBai',
    },
  },
  Fangpi: {
    name: 'FangpiMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '放屁音乐',
      'en-US': 'Fangpi',
    },
  },
  Gequbao: {
    name: 'GequbaoMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '歌曲宝',
      'en-US': 'Gequbao',
    },
  },
  Gequhai: {
    name: 'GequhaiMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '歌曲海',
      'en-US': 'Gequhai',
    },
  },
  Mitu: {
    name: 'MituMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '米兔音乐',
      'en-US': 'Mitu',
    },
  },
  TwoT58: {
    name: 'TwoT58MusicClient',
    icon: '',
    displayName: {
      'zh-CN': 'TwoT58',
      'en-US': 'TwoT58',
    },
  },
  Zhuolin: {
    name: 'ZhuolinMusicClient',
    icon: '',
    displayName: {
      'zh-CN': '卓林音乐',
      'en-US': 'Zhuolin',
    },
  },
}

export const musicClients = Object.fromEntries(
  Object.entries(musicClientsConfig).map(([key, val]) => [key, val.name])
) as Record<ClientKey, string>
