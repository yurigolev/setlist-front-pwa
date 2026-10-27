import { afterEach, expect, it } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import TagColorEditor from './TagColorEditor.vue';

let app: App;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

it('ручной HEX валидируется формой, нормализуется и снимается кнопкой', async () => {
  const color = ref<string | null>(null);
  document.body.innerHTML = '<div id="editor"></div>';
  app = createApp({
    render: () =>
      h('form', [
        h(TagColorEditor, {
          modelValue: color.value,
          'onUpdate:modelValue': (value) => {
            color.value = value;
          },
        }),
      ]),
  });
  app.mount('#editor');
  const buttons = () => [
    ...document.querySelectorAll<HTMLButtonElement>('.tag-color__actions button'),
  ];
  buttons()
    .find((button) => button.textContent?.includes('Свой цвет'))!
    .click();
  await nextTick();
  const hex = document.querySelector<HTMLInputElement>('[name="tag-color"]')!;
  hex.value = '#abc';
  hex.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  expect(document.querySelector('form')!.checkValidity()).toBe(false);
  hex.value = '#abc123';
  hex.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  expect(color.value).toBe('#ABC123');
  expect(document.querySelector('form')!.checkValidity()).toBe(true);
  buttons()
    .find((button) => button.textContent?.includes('Без цвета'))!
    .click();
  await nextTick();
  expect(color.value).toBeNull();
  expect(document.querySelector('[name="tag-color"]')).toBeNull();
});

it('disabled блокирует палитру и ручной выбор', () => {
  document.body.innerHTML = '<div id="editor"></div>';
  app = createApp({ render: () => h(TagColorEditor, { disabled: true }) });
  app.mount('#editor');
  for (const button of document.querySelectorAll('button'))
    expect(button.matches(':disabled')).toBe(true);
});
