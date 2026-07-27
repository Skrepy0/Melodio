export interface SystemBarPlugin {
  /**
   * Apply a theme to the status bar and navigation bar.
   * @param mode - 'light' for light theme, 'dark' for dark theme
   */
  setTheme(options: { mode: 'light' | 'dark' }): Promise<{ success: boolean }>
}
