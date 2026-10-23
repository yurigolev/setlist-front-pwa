import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, type App } from 'vue';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { configureSession } from '@/composables/useAuthSession';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';
import AppPageFrame from '@/layouts/AppPageFrame.vue';
import PageHeader from './PageHeader.vue';

let app: App | undefined;
let pinia: Pinia;
beforeEach(() => {
  configureSession();
  pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().user = { id: 'header-user', displayName: 'User' };
});
afterEach(() => {
  app?.unmount();
  disposePinia(pinia);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function mount(): Promise<void> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/profile', component: { template: '<div />' } }],
  });
  document.body.innerHTML = '<div id="header"></div>';
  app = createApp(
    defineComponent({
      setup: () => () =>
        h(
          AppPageFrame,
          { publicPage: false, routeName: 'library' },
          { default: () => h(PageHeader, { title: 'Библиотека' }) },
        ),
    }),
  );
  app.use(pinia);
  app.use(router);
  app.mount('#header');
  await nextTick();
  await nextTick();
}
it('expired session notice stays outside page heading row', async () => {
  useAuthStore().reauthRequired = true;
  await mount();
  const notice = document.querySelector('.layout-session-notice');
  expect(notice?.textContent).toContain('Сохранённые данные доступны только для просмотра');
  expect(notice?.querySelector('button')?.getAttribute('aria-label')).toBe('Войти через Яндекс');
  expect(document.querySelector('.layout-header__row')?.textContent).not.toContain(
    'Сохранённые данные',
  );
  expect(document.querySelector('#layout-page-heading h1')?.textContent).toBe('Библиотека');
});
it('temporary verification retry remains outside compact header and calls shared action', async () => {
  useAuthStore().verificationPending = true;
  const retry = vi.spyOn(useSongsStore(), 'retryConnection').mockResolvedValue();
  await mount();
  const notice = document.querySelector('.layout-session-notice');
  expect(notice?.textContent).toContain('Не удалось проверить вход');
  notice?.querySelector<HTMLButtonElement>('button')?.click();
  expect(retry).toHaveBeenCalledTimes(1);
});
