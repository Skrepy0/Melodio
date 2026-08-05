/// <reference types="vitest" />
import pkg from './package.json'
import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), legacy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/theme/mixins.scss" as *;\n`,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
