import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useSetlistsStore } from '@/stores/setlists';
import { useSongsStore } from '@/stores/songs';
import TagManager from './TagManager.vue';
let app: App;
let pinia: Pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().user = { id: 'modal-user', displayName: 'User' };
  const lists = useSetlistsStore();
  lists.setlists = [
    {
      id: 'scope',
      title: 'Test',
      revision: 1,
      role: 'owner',
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
  ];
  lists.selectedId = 'scope';
  const songs = useSongsStore();
  songs.tags = [{ id: 'tag', name: 'Лаунж' }];
  songs.songs = [
    { id: 'song', title: 'Test', attachments: [], tagIds: ['tag'], createdAt: '', updatedAt: '' },
  ];
  document.body.innerHTML = '<div id="tag-test"></div>';
  app = createApp(TagManager);
  app.use(pinia);
  app.mount('#tag-test');
});
afterEach(() => {
  app.unmount();
  disposePinia(pinia);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function edit(): Promise<void> {
  document.querySelector<HTMLButtonElement>('[aria-label="Редактировать тег Лаунж"]')!.click();
  await vi.waitFor(() => expect(document.querySelector('#tag-name')).not.toBeNull());
}
async function fill(value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('#tag-name')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
it('переименование только в модалке, ошибка сохраняет ввод и разрешает повтор', async () => {
  const rename = vi
    .spyOn(useSongsStore(), 'updateTag')
    .mockRejectedValueOnce(new Error('Тег уже есть'))
    .mockResolvedValueOnce({ id: 'tag', name: 'Джаз' });
  expect(document.querySelector('.tag-manager input')).toBeNull();
  await edit();
  await fill('Джаз');
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Тег уже есть'),
  );
  expect(document.querySelector<HTMLInputElement>('#tag-name')!.value).toBe('Джаз');
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(rename).toHaveBeenLastCalledWith('tag', 'Джаз', null);
});
it('удаление требует подтверждения с количеством песен внутри модалки', async () => {
  const remove = vi.spyOn(useSongsStore(), 'deleteTag').mockResolvedValue();
  await edit();
  document.querySelector<HTMLButtonElement>('.tag-dialog__delete')!.click();
  await nextTick();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'будет убран из песен: 1',
  );
  expect(remove).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await vi.waitFor(() => expect(remove).toHaveBeenCalledWith('tag'));
});
it('смена сетлиста закрывает открытую модалку', async () => {
  await edit();
  useSetlistsStore().selectedId = undefined;
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
});
it('сохраняет только изменение цвета и позволяет снять цвет', async () => {
  const update = vi
    .spyOn(useSongsStore(), 'updateTag')
    .mockResolvedValue({ id: 'tag', name: 'Лаунж', color: '#B69AE8' });
  await edit();
  expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  document.querySelector<HTMLButtonElement>('[aria-label="Фиолетовый"]')!.click();
  await nextTick();
  expect(
    document
      .querySelector<HTMLElement>('.tag-dialog__preview .app-tag')!
      .style.getPropertyValue('--tag-color'),
  ).toBe('#B69AE8');
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await vi.waitFor(() => expect(update).toHaveBeenCalledWith('tag', 'Лаунж', '#B69AE8'));
  useSongsStore().tags[0]!.color = '#B69AE8';
  await nextTick();
  await edit();
  [...document.querySelectorAll<HTMLButtonElement>('.tag-color__actions button')]
    .find((button) => button.textContent?.includes('Без цвета'))!
    .click();
  await nextTick();
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await vi.waitFor(() => expect(update).toHaveBeenLastCalledWith('tag', 'Лаунж', null));
});
it('предлагает цвет новому тегу, отмена не записывает изменения', async () => {
  useSongsStore().tags[0]!.color = '#82A5ED';
  const create = vi
    .spyOn(useSongsStore(), 'createTag')
    .mockResolvedValue({ id: 'new', name: 'Новый' });
  document.querySelector<HTMLButtonElement>('.tag-manager__add')!.click();
  await vi.waitFor(() => expect(document.querySelector('#tag-name')).not.toBeNull());
  expect(document.querySelector('[aria-label="Фиолетовый"]')!.getAttribute('aria-pressed')).toBe(
    'true',
  );
  document.querySelector<HTMLButtonElement>('[aria-label="Зелёный"]')!.click();
  document.querySelector<HTMLButtonElement>('[aria-label="Закрыть"]')!.click();
  await nextTick();
  expect(create).not.toHaveBeenCalled();
  expect(useSongsStore().tags[0]!.color).toBe('#82A5ED');
});
