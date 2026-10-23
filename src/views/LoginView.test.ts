import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, type App } from 'vue';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { configureSession } from '@/composables/useAuthSession';
import { useAuthStore } from '@/stores/auth';
import { clearPrivateDatabases, openSetlistDatabase } from '@/repositories/database';
import AppPageFrame from '@/layouts/AppPageFrame.vue';
import LoginView from './LoginView.vue';
import * as snapshots from '@/repositories/serverSnapshotRepository';

let app: App | undefined;
let pinia: Pinia;
beforeEach(async () => {
  await clearPrivateDatabases();
  localStorage.clear();
  configureSession();
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  app?.unmount();
  app = undefined;
  disposePinia(pinia);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function mount(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/', component: { template: '<p>Сохранённая библиотека</p>' } },
    ],
  });
  await router.push(path);
  await router.isReady();
  document.body.innerHTML = '<div id="login-test"></div>';
  app = createApp(
    defineComponent({
      setup: () => () => h(AppPageFrame, { publicPage: true }, { default: () => h(LoginView) }),
    }),
  );
  app.use(pinia);
  app.use(router);
  app.mount('#login-test');
  await nextTick();
  return router;
}
async function saveLibrary(userId: string, complete: boolean) {
  localStorage.setItem(
    `setlist-selection:${userId}`,
    JSON.stringify({ id: 'library', setlist: { id: 'library' } }),
  );
  const db = await openSetlistDatabase(userId, 'library');
  if (complete) await db.put('serverMeta', { libraryId: 'library', complete: true }, 'complete');
  db.close();
}
it('shows Setlivo and keeps login returnTo without the old header or expiry alert', async () => {
  const auth = useAuthStore();
  auth.reauthRequired = true;
  auth.error = 'Срок входа истёк. Войдите через Яндекс для синхронизации.';
  const login = vi.spyOn(auth, 'login').mockImplementation(() => undefined);
  await mount('/login?returnTo=/invite');
  expect(document.querySelector('h1')?.textContent).toBe('Setlivo');
  expect(document.querySelector('.layout-header')?.getAttribute('style')).toContain(
    'display: none',
  );
  expect(document.querySelector('[role="alert"]')).toBeNull();
  document.querySelector<HTMLButtonElement>('.yandex-login-button')!.click();
  expect(login).toHaveBeenCalledWith('/invite');
});
it('only offers offline access to a completed snapshot of the remembered account', async () => {
  const auth = useAuthStore();
  auth.user = { id: 'saved-owner', displayName: 'Owner' };
  auth.reauthRequired = true;
  await saveLibrary(auth.user.id, true);
  const router = await mount();
  await vi.waitFor(() => expect(document.querySelector('.setlivo-login__saved a')).not.toBeNull());
  expect(document.querySelector('.setlivo-login__saved p')?.textContent).toBe(
    'Данные на устройстве сохранены',
  );
  document.querySelector<HTMLAnchorElement>('.setlivo-login__saved a')!.click();
  await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'));
});
it('does not promise offline access for a selected but incomplete library', async () => {
  const auth = useAuthStore();
  auth.user = { id: 'no-snapshot', displayName: 'Owner' };
  auth.reauthRequired = true;
  await saveLibrary(auth.user.id, false);
  const read = vi.spyOn(snapshots, 'readSnapshotMeta');
  await mount();
  expect(read).toHaveBeenCalledWith('no-snapshot', 'library');
  await read.mock.results[0]!.value;
  await nextTick();
  expect(document.querySelector('.setlivo-login__saved')).toBeNull();
});
it('removes the saved-library action after the account changes', async () => {
  const auth = useAuthStore();
  auth.user = { id: 'previous-user', displayName: 'Previous' };
  auth.reauthRequired = true;
  await saveLibrary(auth.user.id, true);
  await mount();
  await vi.waitFor(() => expect(document.querySelector('.setlivo-login__saved a')).not.toBeNull());
  auth.user = { id: 'different-user', displayName: 'Different' };
  await nextTick();
  expect(document.querySelector('.setlivo-login__saved')).toBeNull();
});
it('keeps genuine callback errors visible and pending logout blocks login', async () => {
  const auth = useAuthStore();
  auth.logoutPending = true;
  await mount('/login?authError=unavailable');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    'Яндекс ID временно недоступен',
  );
  expect(document.querySelector('.yandex-login-button')).toBeNull();
  expect(document.querySelector('button')?.textContent).toContain('Завершить выход');
});
