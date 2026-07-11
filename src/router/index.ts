import { createRouter, createWebHistory } from '@ionic/vue-router'
import { RouteRecordRaw } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import SettingsPage from '../views/SettingsPage.vue'
import PlayerView from '../views/PlayerView.vue'
import SortSongsPage from '../views/SortSongsPage.vue'
import SongListPage from '@/views/SongListPage.vue'
import AboutPage from '@/views/AboutPage.vue'
import ScanBlacklistPage from '@/views/ScanBlacklistPage.vue'
import InterfaceSettingsPage from '@/views/settings/InterfaceSettingsPage.vue'
import AccessibilityPage from '@/views/settings/AccessibilityPage.vue'
import OtherSettingsPage from '@/views/settings/OtherSettingsPage.vue'
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
  { path: '/settings', name: 'Settings', component: SettingsPage },
  { path: '/settings/interface', name: 'Interface Settings', component: InterfaceSettingsPage },
  { path: '/settings/accessibility', name: 'Accessibility', component: AccessibilityPage },
  { path: '/settings/other', name: 'Other', component: OtherSettingsPage },
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
