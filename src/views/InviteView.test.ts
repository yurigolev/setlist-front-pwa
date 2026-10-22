import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, type App } from 'vue';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { configureSession } from '@/composables/useAuthSession';
import { useAuthStore } from '@/stores/auth';
import AppPageFrame from '@/layouts/AppPageFrame.vue';
import InviteView from './InviteView.vue';

let app: App | undefined;
let pinia: Pinia;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  configureSession();
  pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().user = { id: 'remembered', displayName: 'Remembered' };
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
    routes: [{ path: '/invite', component: InviteView }],
  });
  await router.push('/invite#token=secret-invitation');
  await router.isReady();
  document.body.innerHTML = '<div id="invite"></div>';
  app = createApp(
    defineComponent({
      setup: () => () => h(AppPageFrame, { publicPage: true }, { default: () => h(InviteView) }),
    }),
  );
  app.use(pinia);
  app.use(router);
  app.mount('#invite');
  await nextTick();
}
function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
}
it('remembered expired user can log in with invitation retained', async () => {
  const auth = useAuthStore();
  auth.reauthRequired = true;
  const login = vi.spyOn(auth, 'login').mockImplementation(() => undefined);
  await mount();
  expect(button('Принять приглашение')).toBeUndefined();
  button('Войти через Telegram')!.click();
  expect(login).toHaveBeenCalledWith('/invite');
  expect(sessionStorage.getItem('setlist-pending-invitation')).toBe('secret-invitation');
});
it('temporary verification failure offers retry and blocks acceptance without expired login', async () => {
  const auth = useAuthStore();
  auth.verificationPending = true;
  const initialize = vi.spyOn(auth, 'initialize').mockImplementation(async () => {
    auth.verificationPending = false;
  });
  await mount();
  expect(button('Войти через Telegram')).toBeUndefined();
  expect(button('Принять приглашение')!.disabled).toBe(true);
  button('Повторить проверку входа')!.click();
  await nextTick();
  await nextTick();
  expect(initialize).toHaveBeenCalledWith(true);
  expect(button('Принять приглашение')!.disabled).toBe(false);
  expect(sessionStorage.getItem('setlist-pending-invitation')).toBe('secret-invitation');
});
