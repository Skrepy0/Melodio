declare global {
  interface Window {
    resolveLocalFileSystemURL(
      url: string,
      successCallback: (entry: any) => void,
      errorCallback: (error: { code: number; message?: string }) => void
    ): void
  }
}

export {}
declare global {
  interface Window {
    resolveLocalFileSystemURL(
      url: string,
      successCallback: (entry: any) => void,
      errorCallback: (error: { code: number; message?: string }) => void
    ): void
  }
}

export {}
