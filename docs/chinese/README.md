# Melodio

[![License](https://img.shields.io/badge/License-Apache%202.0-pink.svg)](LICENSE) [![Android](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android)](https://developer.android.com) ![Min SDK](<https://img.shields.io/badge/Min%20SDK-24%20(Android%207.0)-green>)

一个流畅、简洁的音乐播放器，专为 Android 打造。基于 Ionic Vue 和 Capacitor 构建，支持离线播放本地音频文件，提供清爽的播放体验、锁屏媒体控件以及完善的后台播放能力。

## 📱 适配系统

| 项目         | 说明                         |
| ------------ | ---------------------------- |
| **运行平台** | Android                      |
| **最低版本** | Android 7.0 (Nougat, API 24) |
| **目标版本** | Android 15 (API 36)          |
| **架构**     | 支持 ARM64、ARMv7、x86_64    |

> 目前仅支持 Android 平台。

## ✨ 功能特性

### 🎵 音乐播放

- **本地音乐扫描** – 自动扫描设备存储中的音频文件，支持 FLAC、MP3、AAC、WAV、OGG 等主流格式
- **原生播放引擎** – 通过自定义 Capacitor 插件调用 Android MediaPlayer + MediaSession，实现稳定流畅的播放体验
- **后台播放** – 即使应用退到后台也能持续播放，通知栏提供完整的媒体控制
- **锁屏/通知栏控件** – 显示封面、歌曲信息、进度条，支持播放/暂停、上一首/下一首、拖动进度
- **倍速播放** – 播放器界面一键切换播放速率（0.5x ~ 2.0x）
- **播放模式切换** – 支持顺序播放、单曲循环，原生层高效处理循环逻辑
- **线控/蓝牙按键支持** – 响应有线耳机和蓝牙设备的媒体按键（播放/暂停、上一首、下一首）

### 📋 播放队列

- **队列管理** – 支持添加到队列、下一首播放、从队列移除
- **拖拽排序** – 长按拖拽调整队列顺序
- **清空队列** – 一键清空当前播放队列

### 🎤 歌单系统

- **自定义歌单** – 创建、重命名、删除歌单
- **批量操作** – 多选歌曲后批量添加到歌单、队列或黑名单
- **智能排序** – 支持按标题、艺术家、添加时间、修改时间排序，支持升序/降序及自定义拖拽排序
- **"我喜欢的音乐"** – 内置默认歌单，一键收藏喜欢的歌曲

### 🎨 封面获取

- **内嵌封面优先** – 优先读取音频文件中内嵌的专辑封面
- **联网搜索** – 无封面时自动联网搜索（iTunes API）并本地缓存
- **离线可用** – 缓存封面后断网也能正常显示

### 🌓 界面体验

- **暗黑模式** – 支持浅色/深色主题切换，可跟随系统或手动设置
- **多语言** – 提供简体中文和英文界面，自动跟随系统语言
- **拼音搜索** – 支持拼音模糊匹配搜索，输入拼音首字母即可快速找到歌曲
- **系统状态栏适配** – 状态栏和导航栏颜色自动跟随应用主题，浅色/深色模式下图标清晰可见
- **触觉反馈** – 关键操作提供轻柔的震动反馈

### ⚙️ 辅助与智能

- **耳机/蓝牙断开自动暂停** – 拔出耳机或断开蓝牙设备时自动暂停，防止外放尴尬
- **音频焦点管理** – 其他应用播放音频时自动暂停，避免声音冲突
- **自动清理无效歌曲** – 自动移除已被移动或删除的歌曲条目
- **扫描黑名单** – 可将指定歌曲加入黑名单，扫描曲库时自动排除

### 💾 数据管理

- **数据备份** – 一键导出歌曲信息、歌单、设置等所有数据到 JSON 文件
- **数据恢复** – 从 JSON 文件导入数据（注意会覆盖当前数据）

## 📸 界面预览

<div align="center">

### 主页与曲库

<div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
  <div>
    <img src="../images/2.png" width="180" alt="全部曲目" />
    <p><em>全部曲目</em></p>
  </div>
  <div>
    <img src="../images/1.png" width="180" alt="播放列表" />
    <p><em>播放列表</em></p>
  </div>
  <div>
    <img src="../images/5.png" width="180" alt="歌单排序" />
    <p><em>歌单排序</em></p>
  </div>
</div>

### 播放器

<div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
  <div>
    <img src="../images/3.png" width="180" alt="播放器界面" />
    <p><em>播放器界面</em></p>
  </div>
</div>

### 设置与功能

<div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
  <div>
    <img src="../images/4.png" width="180" alt="设置页面" />
    <p><em>设置页面</em></p>
  </div>
  <div>
    <img src="../images/6.png" width="180" alt="辅助功能" />
    <p><em>辅助功能</em></p>
  </div>
</div>

</div>

## 🛠 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **移动端**：Ionic Vue 8 + Capacitor 8
- **原生音频**：自定义 Capacitor 插件（Java），底层使用 Android MediaPlayer + MediaSession + `androidx.media`
- **状态管理**：Pinia
- **国际化**：vue-i18n
- **图标**：Iconify（Material Design Icons）
- **样式**：SCSS
- **拼音搜索**：pinyin-match

## 🚀 构建与运行

### 环境要求

- Node.js >= 18
- Android Studio (最新稳定版), VS Code
- Android SDK (API 24+)
- Java JDK 17+

### 开发步骤

```bash
# 安装依赖
npm install

# 同步 Capacitor 原生项目
npx cap sync
```

构建并在Android Studio打开

```bash

# 构建前端并同步到 Android 项目
npm run android:build

# 在 Android Studio 中打开
npx cap open android

# 或者用下面这一行构建前端并在 Android Studio 中打开
npm run android:dev
```

## 📄 许可证

本项目采用 [Apache License Version 2.0](../../LICENSE) 开源。
