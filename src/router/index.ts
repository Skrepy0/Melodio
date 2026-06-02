import { createRouter, createWebHistory } from '@ionic/vue-router'
import { RouteRecordRaw } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import SettingsPage from '../views/SettingsPage.vue'
import PlayerView from '../views/PlayerView.vue'
import SortSongsPage from '../views/SortSongsPage.vue'
import SongListPage from '@/views/SongListPage.vue'
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
  { path: '/player-view', name: 'PlayerView', component: PlayerView },
  { path: '/song-list', name: 'SongList', component: SongListPage },
  { path: '/sort-song', name: 'SortSongs', component: SortSongsPage },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
