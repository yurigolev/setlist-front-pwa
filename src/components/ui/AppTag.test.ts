import { afterEach, expect, it, vi } from 'vitest';
import { createApp, h, type App } from 'vue';
import AppTag from './AppTag.vue';
let app: App;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});
it('тег для просмотра — обычный span, без интерактивных элементов', () => {
  document.body.innerHTML = '<div id="app-tag"></div>';
  app = createApp({ render: () => h(AppTag, { label: 'Лаунж', size: 'sm' }) });
  app.mount('#app-tag');
  expect(document.querySelector('.app-tag')?.tagName).toBe('SPAN');
  expect(document.querySelector('button')).toBeNull();
  expect(document.body.textContent).toContain('Лаунж');
});
it('действие редактирования открывает диалог по клику, disabled блокирует действие', () => {
  const onClick = vi.fn();
  document.body.innerHTML = '<div id="app-tag"></div>';
  app = createApp({
    render: () => h(AppTag, { label: 'Лаунж', action: 'edit', disabled: true, onClick }),
  });
  app.mount('#app-tag');
  const button = document.querySelector('button')!;
  expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  expect(button.getAttribute('aria-label')).toBe('Редактировать тег Лаунж');
  button.click();
  expect(onClick).not.toHaveBeenCalled();
});
