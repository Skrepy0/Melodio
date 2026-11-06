import { createRouter, createWebHistory } from '@ionic/vue-router'
import { RouteRecordRaw } from 'vue-router'
import HomePage from '../views/HomePage.vue'

const LyricsCachePage = () => import('@/views/settings/LyricsCachePage.vue')
const SettingsPage = () => import('../views/SettingsPage.vue')
const PlayerView = () => import('../views/PlayerView.vue')
const SortSongsPage = () => import('../views/SortSongsPage.vue')
const SongListPage = () => import('@/views/SongListPage.vue')
const AboutPage = () => import('@/views/AboutPage.vue')
const ScanBlacklistPage = () => import('@/views/ScanBlacklistPage.vue')
const AppearanceSettingsPage = () => import('@/views/settings/AppearanceSettingsPage.vue')
const LyricsSettingsPage = () => import('@/views/settings/LyricsSettingsPage.vue')
const PlaybackSettingsPage = () => import('@/views/settings/PlaybackSettingsPage.vue')
const DataSettingsPage = () => import('@/views/settings/DataSettingsPage.vue')
const LibrarySettingsPage = () => import('@/views/settings/LibrarySettingsPage.vue')
const MusicClientSettingsPage = () => import('@/views/settings/MusicClientSettingsPage.vue')
const OnlineSearchPage = () => import('@/views/OnlineSearchPage.vue')
const DownloadManagerPage = () => import('@/views/DownloadManagerPage.vue')

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
  },
  { path: '/search', name: 'Search', component: OnlineSearchPage },
  { path: '/downloads', name: 'Downloads', component: DownloadManagerPage },
  { path: '/settings', name: 'Settings', component: SettingsPage },
  { path: '/settings/appearance', name: 'Appearance Settings', component: AppearanceSettingsPage },
  {
    path: '/settings/library',
    name: 'Library Settings',
    component: LibrarySettingsPage,
  },
  {
    path: '/settings/library/music-sources',
    name: 'Music Client Settings',
    component: MusicClientSettingsPage,
  },
  {
    path: '/settings/data/lyrics-cache',
    name: 'Lyrics Cache',
    component: LyricsCachePage,
  },
  { path: '/settings/playback', name: 'Playback Settings', component: PlaybackSettingsPage },
  { path: '/settings/data', name: 'Data Settings', component: DataSettingsPage },
  { path: '/settings/lyrics', name: 'Lyrics Settings', component: LyricsSettingsPage },
  { path: '/settings/interface', redirect: '/settings/appearance' },
  { path: '/settings/online_search', redirect: '/settings/library' },
  { path: '/settings/online_search/music_client', redirect: '/settings/library/music-sources' },
  { path: '/settings/accessibility/lyrics-cache', redirect: '/settings/data/lyrics-cache' },
  { path: '/settings/other', redirect: '/settings/data' },
  { path: '/settings/accessibility', redirect: '/settings' },
  { path: '/player-view', name: 'PlayerView', component: PlayerView },
  { path: '/song-list', name: 'SongList', component: SongListPage },
  { path: '/sort-song', name: 'SortSongs', component: SortSongsPage },
  { path: '/about', name: 'About', component: AboutPage },
  { path: '/blacklist', name: 'Blacklist', component: ScanBlacklistPage },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
