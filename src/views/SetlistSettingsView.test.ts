import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useSetlistsStore, type Role } from '@/stores/setlists';
import { useSongsStore } from '@/stores/songs';
import SetlistSettingsView from './SetlistSettingsView.vue';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/PageHeader.vue', () => ({
  default: { template: '<header><slot /></header>' },
}));

let app: App | undefined;
let pinia: Pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().user = { id: 'settings-user', displayName: 'User' };
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
  vi.spyOn(lists, 'members').mockResolvedValue([]);
  vi.spyOn(lists, 'invitations').mockResolvedValue([]);
  vi.spyOn(useSongsStore(), 'load').mockResolvedValue();
});
afterEach(() => {
  app?.unmount();
  disposePinia(pinia);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function mount(role: Role): Promise<void> {
  useSetlistsStore().current!.role = role;
  document.body.innerHTML = '<div id="settings"></div>';
  app = createApp(SetlistSettingsView);
  app.use(pinia);
  app.mount('#settings');
  await nextTick();
}
it('владелец создаёт тег в настройках сетлиста', async () => {
  const create = vi
    .spyOn(useSongsStore(), 'createTag')
    .mockResolvedValue({ id: 'new', name: 'Лаунж' });
  await mount('owner');
  expect(
    [...document.querySelectorAll('nav button')].map((button) => button.textContent?.trim()),
  ).toEqual(['Общее', 'Теги', 'Доступ']);
  expect(document.querySelector('[aria-label="Участники сетлиста"]')).not.toBeNull();
  expect(document.querySelector('.settings-invitations-title')?.textContent).toBe('Приглашения');
  const tagsTab = [...document.querySelectorAll<HTMLButtonElement>('nav button')].find(
    (button) => button.textContent?.trim() === 'Теги',
  )!;
  tagsTab.click();
  await nextTick();
  expect(document.querySelector('.tag-manager input')).toBeNull();
  document.querySelector<HTMLButtonElement>('.tag-manager__add')!.click();
  await vi.waitFor(() => expect(document.querySelector('#tag-name')).not.toBeNull());
  const input = document.querySelector<HTMLInputElement>('#tag-name')!;
  input.value = 'Лаунж';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  document.querySelector<HTMLButtonElement>('.tag-dialog button[type="submit"]')!.click();
  await vi.waitFor(() => expect(create).toHaveBeenCalledWith('Лаунж', '#82A5ED'));
  expect(useSongsStore().load).toHaveBeenCalledOnce();
});
it('редактор управляет тегами без доступа к настройкам владельца', async () => {
  await mount('editor');
  expect(document.querySelector('.tag-manager__add')).not.toBeNull();
  expect(
    [...document.querySelectorAll('nav button')].map((button) => button.textContent?.trim()),
  ).toEqual(['Теги']);
  expect(document.querySelector('.settings-delete')).toBeNull();
  expect(useSetlistsStore().members).not.toHaveBeenCalled();
  expect(useSetlistsStore().invitations).not.toHaveBeenCalled();
  const lists = useSetlistsStore();
  lists.setlists.push({ ...lists.current!, id: 'other' });
  lists.select('other');
  await nextTick();
  expect(useSongsStore().load).toHaveBeenCalledTimes(2);
});
it('viewer не видит управление тегами', async () => {
  await mount('viewer');
  expect(document.querySelector('.tag-manager')).toBeNull();
  expect(document.querySelector('[aria-label="Новый тег"]')).toBeNull();
});
