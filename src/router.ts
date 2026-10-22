import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from './stores/auth';
import { useSetlistsStore } from './stores/setlists';
import { useSongsStore } from './stores/songs';
import SetlistsView from './views/SetlistsView.vue';
import SetlistSettingsView from './views/SetlistSettingsView.vue';
import InviteView from './views/InviteView.vue';
import ProfileView from './views/ProfileView.vue';
import LoginView from './views/LoginView.vue';
import LibraryView from './views/LibraryView.vue';
import SongFormView from './views/SongFormView.vue';
import SongView from './views/SongView.vue';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
    return new Promise((resolve) => {
      // Wait for the outgoing page before measuring the incoming page.
      window.setTimeout(
        () => resolve(savedPosition || { top: 0, left: 0 }),
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260,
      );
    });
  },
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { layout: 'public' } },
    { path: '/invite', name: 'invite', component: InviteView, meta: { layout: 'public' } },
    { path: '/setlists', name: 'setlists', component: SetlistsView },
    { path: '/profile', name: 'profile', component: ProfileView },
    { path: '/settings', redirect: { name: 'setlists' } },
    {
      path: '/setlists/:id/settings',
      name: 'setlist-settings',
      component: SetlistSettingsView,
      props: true,
    },
    {
      path: '/',
      name: 'library',
      component: LibraryView,
    },
    { path: '/songs/new', name: 'song-new', component: SongFormView },
    { path: '/songs/:id', name: 'song', component: SongView, props: true },
    { path: '/songs/:id/edit', name: 'song-edit', component: SongFormView, props: true },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  if (to.name === 'login' || to.name === 'invite') return;
  if (!auth.user) return { name: 'login', query: { returnTo: to.fullPath } };
  if (to.name === 'profile') return;
  const setlists = useSetlistsStore();
  try {
    await setlists.initialize();
  } catch {
    if (to.name !== 'setlists') return { name: 'setlists' };
    return;
  }
  if (to.name === 'setlist-settings') {
    const id = to.params.id;
    if (typeof id !== 'string' || !setlists.setlists.some((item) => item.id === id))
      return { name: 'setlists' };
    setlists.select(id);
  }
  if (!setlists.current && to.name !== 'setlists') return { name: 'setlists' };
  if ((to.name === 'song-new' || to.name === 'song-edit') && !useSongsStore().canWrite)
    return { name: 'library' };
});

const pageDepth: Record<string, number> = {
  library: 0,
  setlists: 0,
  profile: 0,
  song: 1,
  'song-new': 1,
  'setlist-settings': 1,
  'song-edit': 2,
};

router.afterEach((to, from, failure) => {
  if (failure) return;
  const next = pageDepth[String(to.name)] ?? 0;
  const previous = pageDepth[String(from.name)] ?? 0;
  to.meta.transition =
    next > previous ? 'page-forward' : next < previous ? 'page-back' : 'page-fade';
});
