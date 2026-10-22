import { registerPlugin } from '@capacitor/core'
import type { SystemBarPlugin } from '@/plugins/system-bar/definitions'
import type { MusicSignerPlugin } from '@/plugins/music-signer/definitions'
import type { DownloaderPlugin } from '@/plugins/downloader/definitions'

export const SystemBar = registerPlugin<SystemBarPlugin>('SystemBar')
export const MusicSigner = registerPlugin<MusicSignerPlugin>('MusicSigner')
export const Downloader = registerPlugin<DownloaderPlugin>('Downloader')
