import { createRouter, createWebHistory } from 'vue-router'

import LibraryView from './views/LibraryView.vue'
import SongFormView from './views/SongFormView.vue'
import SongView from './views/SongView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: LibraryView,
    },
    { path: '/songs/new', name: 'song-new', component: SongFormView },
    { path: '/songs/:id', name: 'song', component: SongView, props: true },
    { path: '/songs/:id/edit', name: 'song-edit', component: SongFormView, props: true },
  ],
})
