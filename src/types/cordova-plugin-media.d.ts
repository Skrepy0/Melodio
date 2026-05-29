declare const Media: {
  new (
    src: string,
    onSuccess?: () => void,
    onError?: (error: MediaError) => void,
    onStatus?: (status: number) => void
  ): Media
}

interface Media {
  play(options?: { numberOfLoops?: number }): void
  pause(): void
  stop(): void
  release(): void
  seekTo(milliseconds: number): void
  getCurrentPosition(
    onSuccess: (position: number) => void,
    onError?: (error: MediaError) => void
  ): void
  getDuration(): number
  setVolume(volume: number): void
}

interface MediaError {
  code: number
  message: string
}
