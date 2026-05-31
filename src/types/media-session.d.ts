declare module '@pejota14/capacitor-media-session' {
  interface MediaMetadata {
    title?: string
    artist?: string
    album?: string
    artwork?: { src: string; sizes?: string; type?: string }[]
  }

  interface PlaybackStateOptions {
    playbackState: 'playing' | 'paused' | 'none'
  }

  interface ActionHandlerOptions {
    action: 'play' | 'pause' | 'previoustrack' | 'nexttrack' | 'stop' | 'seekto'
  }

  interface MediaSessionPlugin {
    setMetadata(options: MediaMetadata): Promise<void>
    setPlaybackState(options: PlaybackStateOptions): Promise<void>
    setActionHandler(options: ActionHandlerOptions, handler: (details?: any) => void): Promise<void>
  }

  export const MediaSession: MediaSessionPlugin
}
