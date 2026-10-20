export interface SystemBarPlugin {
  /**
   * Apply a theme to the status bar and navigation bar.
   * @param options color is the resolved theme background (e.g. "#f8f9fc");
   * when omitted the native side falls back to its light/dark defaults.
   */
  setTheme(options: { mode: 'light' | 'dark' }): Promise<{ success: boolean }>
}
