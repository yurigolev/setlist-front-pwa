import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '@/App.vue';
import PageHeader from '@/components/PageHeader.vue';

vi.mock('@/stores/auth', async () => {
  const { reactive } = await import('vue');
  const auth = reactive({ user: { id: 'layout-qa', displayName: 'Музыкант' }, ready: true });
  return { useAuthStore: () => auth };
});
vi.mock('@/stores/setlists', async () => {
  const { reactive } = await import('vue');
  const setlists = reactive({ selectedId: 'qa', ready: true });
  return { useSetlistsStore: () => setlists };
});
vi.mock('@/stores/songs', () => ({ useSongsStore: () => ({ online: true }) }));

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
});

describe('переход общей шапки в профиль', () => {
  it.each(['library', 'setlists', 'song-edit'])(
    'сохраняет шапку %s до ухода страницы и переключает заголовок вместе с ней',
    async (name) => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
      });
      const page = (title: string, withBack = false) => ({
        render: () =>
          h('main', { 'data-page': title }, [
            h(
              PageHeader,
              { title },
              {
                context: () => h('p', { 'data-context': title }, title),
                ...(withBack ? { back: () => h('button', 'Назад') } : {}),
              },
            ),
            h('p', `Содержимое ${title}`),
          ]),
      });
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/', redirect: '/source' },
          { path: '/source', name, component: page('Исходная страница', name === 'song-edit') },
          { path: '/profile', name: 'profile', component: page('Профиль') },
        ],
      });
      const host = document.createElement('div');
      const style = document.createElement('style');
      style.textContent =
        '.page-fade-leave-active { transition-duration: 1s; transition-delay: 0s; transition-property: opacity; }';
      document.head.append(style);
      document.body.append(host);
      const app = createApp(App);
      app.use(router);
      cleanup = () => {
        app.unmount();
        host.remove();
        style.remove();
      };
      await router.push('/source');
      await router.isReady();
      app.mount(host);
      await nextTick();

      const outgoing = host.querySelector('.route-page')!;
      const session = host.querySelector('.session-header')!;
      const nav = host.querySelector('.library-tabs')!;
      expect(session).not.toBeNull();
      expect(host.querySelector('#layout-page-heading .page-header__title')?.textContent).toBe(
        'Исходная страница',
      );

      await router.push('/profile');
      await nextTick();
      await vi.advanceTimersByTimeAsync(50);

      expect(outgoing.isConnected).toBe(true);
      expect(outgoing.classList.contains('page-fade-leave-active')).toBe(true);
      expect(session.isConnected).toBe(true);
      expect(outgoing.contains(session)).toBe(true);
      expect(
        outgoing.querySelector('.layout-header')?.classList.contains('layout-header--with-back'),
      ).toBe(name === 'song-edit');
      expect(host.querySelector('#layout-page-heading .page-header__title')?.textContent).toBe(
        'Исходная страница',
      );
      expect(host.querySelector('[data-context="Исходная страница"]')).not.toBeNull();
      expect(host.querySelector('.library-tabs')).toBe(nav);

      await vi.advanceTimersByTimeAsync(1100);
      await nextTick();

      expect(outgoing.isConnected).toBe(false);
      expect(session.isConnected).toBe(false);
      expect(host.querySelectorAll('#layout-page-heading')).toHaveLength(1);
      expect(host.querySelector('#layout-page-heading .page-header__title')?.textContent).toBe(
        'Профиль',
      );
      expect(host.querySelector('[data-context="Исходная страница"]')).toBeNull();
      expect(host.querySelectorAll('.library-tabs')).toHaveLength(1);
      expect(host.querySelector('.library-tabs')).toBe(nav);

      await router.push('/source');
      await nextTick();
      await vi.advanceTimersByTimeAsync(50);
      expect(host.querySelector('#layout-page-heading .page-header__title')?.textContent).toBe(
        'Профиль',
      );
      expect(host.querySelector('.session-header')).toBeNull();
      await vi.advanceTimersByTimeAsync(1100);
      await nextTick();
      expect(host.querySelector('#layout-page-heading .page-header__title')?.textContent).toContain(
        'Исходная страница',
      );
      expect(host.querySelector('.session-header')).not.toBeNull();
      expect(host.querySelectorAll('#layout-page-heading')).toHaveLength(1);
    },
  );
});
