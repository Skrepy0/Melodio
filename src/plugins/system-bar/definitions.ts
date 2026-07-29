export interface SystemBarPlugin {
  /**
   * Apply a theme to the status bar and navigation bar.
   * @param options
   */
  setTheme(options: { mode: 'light' | 'dark' }): Promise<{ success: boolean }>
}
