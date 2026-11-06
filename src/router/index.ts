import LyricsCachePage from '@/views/settings/LyricsCachePage.vue'
import { createRouter, createWebHistory } from '@ionic/vue-router'
import { RouteRecordRaw } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import SettingsPage from '../views/SettingsPage.vue'
import PlayerView from '../views/PlayerView.vue'
import SortSongsPage from '../views/SortSongsPage.vue'
import SongListPage from '@/views/SongListPage.vue'
import AboutPage from '@/views/AboutPage.vue'
import ScanBlacklistPage from '@/views/ScanBlacklistPage.vue'
import AppearanceSettingsPage from '@/views/settings/AppearanceSettingsPage.vue'
import LyricsSettingsPage from '@/views/settings/LyricsSettingsPage.vue'
import PlaybackSettingsPage from '@/views/settings/PlaybackSettingsPage.vue'
import DataSettingsPage from '@/views/settings/DataSettingsPage.vue'
import LibrarySettingsPage from '@/views/settings/LibrarySettingsPage.vue'
import MusicClientSettingsPage from '@/views/settings/MusicClientSettingsPage.vue'
import OnlineSearchPage from '@/views/OnlineSearchPage.vue'
import DownloadManagerPage from '@/views/DownloadManagerPage.vue'

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
