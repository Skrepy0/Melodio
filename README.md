# Melodio

[![License](https://img.shields.io/badge/License-Apache%202.0-pink.svg)](LICENSE)

[🇨🇳 中文](./docs/chinese/README.md)

A smooth, offline-first music player built with Ionic Vue and Capacitor. It scans local audio files on your device and provides a clean playback experience, lock screen media controls, and robust background playback.

## ✨ Features

- **Local music scanning and playback** – Automatically detects audio files in device storage. Supports FLAC, MP3, AAC, and other common formats.
- **Native playback engine** – Uses a custom Capacitor plugin with Android MediaPlayer for stable background playback and automatic track switching.
- **Lock screen / notification controls** – Full media notification with album art, progress bar, play/pause, previous/next, and seek support.
- **Queue management** – Drag-and-drop reordering, play next, add to queue, clear queue, and shuffle.
- **Repeat modes** – One-tap switch between sequential and repeat-one, handled efficiently at the native layer.
- **Smart cover art fetching** – Prioritizes local embedded artwork. Falls back to online search (iTunes API) and caching when missing.
- **Playlist system** – Create, edit, and delete custom playlists, with batch selection and sorting.
- **Multi-language support** – Chinese and English interfaces; automatically follows system language.
- **Dark mode** – Light/dark theme switching, following system preference or manual toggle.
- **Auto-pause on disconnect** – Automatically pauses when headphones or Bluetooth audio devices disconnect.
- **Accessibility optimized** – Safe-area-aware layouts and touch-friendly controls.

## 📸 Screenshots

<div align="center" style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px;">
  <img src="./docs/images/1.png" width="150" />
  <img src="./docs/images/2.png" width="150" />
  <img src="./docs/images/3.png" width="150" />
  <img src="./docs/images/4.png" width="150" />
</div>

## 🛠 Tech Stack

- **Frontend Framework**: Vue 3 + TypeScript + Vite
- **Mobile**: Ionic Vue 8 + Capacitor 8
- **Native Audio**: Custom Capacitor plugin (Java), powered by Android MediaPlayer + MediaSession
- **State Management**: Pinia
- **Internationalization**: vue-i18n
- **Icons**: Iconify
- **Styling**: SCSS

## 📄 License

This project is open-sourced under the [Apache License Version 2.0](LICENSE).
