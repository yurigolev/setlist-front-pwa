// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import PageHeader from './PageHeader.vue';
import AppPageFrame from '@/layouts/AppPageFrame.vue';
import { createPinia } from 'pinia';
let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});
it('moves reactive heading, context and working actions into layout and cleans them on page change', async () => {
  document.body.innerHTML = '<div id="page"></div>';
  const title = ref('Библиотека'),
    visible = ref(true),
    clicks = ref(0);
  app = createApp(
    defineComponent({
      setup: () => () =>
        h(
          AppPageFrame,
          { routeName: 'test', publicPage: true },
          {
            default: () =>
              h('main', { id: 'page-body' }, [
                visible.value
                  ? h(
                      PageHeader,
                      { title: title.value },
                      {
                        actions: () => h('button', { onClick: () => clicks.value++ }, 'Добавить'),
                        context: () => h('span', 'Сетлист'),
                      },
                    )
                  : h('p', 'Другая страница'),
              ]),
          },
        ),
    }),
  );
  app.use(createPinia());
  app.mount('#page');
  await nextTick();
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  expect(document.querySelector('#layout-page-heading h1')?.textContent).toBe('Библиотека');
  expect(document.querySelector('#page-body h1')).toBeNull();
  document.querySelector<HTMLButtonElement>('#layout-page-heading button')!.click();
  expect(clicks.value).toBe(1);
  title.value = 'Сетлисты';
  await nextTick();
  expect(document.querySelector('h1')?.textContent).toBe('Сетлисты');
  expect(document.querySelector('#layout-page-context')?.textContent).toBe('Сетлист');
  visible.value = false;
  await nextTick();
  expect(document.querySelector('#layout-page-heading')?.textContent).toBe('');
  expect(document.querySelector('#layout-page-context')?.textContent).toBe('');
});
