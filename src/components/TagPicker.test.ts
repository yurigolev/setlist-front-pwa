import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useSetlistsStore } from '@/stores/setlists';
import { useSongsStore } from '@/stores/songs';
import TagPicker from './TagPicker.vue';

let app: App | undefined;
let pinia: Pinia;
const selected = ref<string[]>([]);
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().user = { id: 'tags-user', displayName: 'User' };
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
  useSongsStore().tags = [
    { id: 'a', name: 'Акустика' },
    { id: 'b', name: 'Рок' },
  ];
  selected.value = [];
});
afterEach(() => {
  app?.unmount();
  disposePinia(pinia);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function mount(
  options: { filter?: boolean; disabled?: boolean } = { filter: true },
): Promise<void> {
  document.body.innerHTML = '<div id="tags"></div>';
  app = createApp(
    defineComponent({
      setup: () => () =>
        h(TagPicker, {
          ...options,
          modelValue: selected.value,
          'onUpdate:modelValue': (value: string[]) => {
            selected.value = value;
          },
        }),
    }),
  );
  app.use(pinia);
  app.mount('#tags');
  await nextTick();
}
it('выбирает несколько тегов чипсами и снимает выбранный', async () => {
  await mount();
  const chips = document.querySelectorAll<HTMLButtonElement>('.tag-picker__options button');
  chips[0]!.click();
  await nextTick();
  chips[1]!.click();
  await nextTick();
  expect(selected.value).toEqual(['a', 'b']);
  expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
  chips[0]!.click();
  await nextTick();
  expect(selected.value).toEqual(['b']);
});
it('в редакторе чипсы сразу видны без чекбоксов и раскрывающегося списка', async () => {
  await mount({ filter: false });
  expect(document.querySelector('details')).toBeNull();
  expect(document.querySelector('input')).toBeNull();
  const chip = document.querySelector<HTMLButtonElement>('.tag-picker__options button')!;
  chip.click();
  await nextTick();
  expect(selected.value).toEqual(['a']);
  chip.click();
  await nextTick();
  expect(selected.value).toEqual([]);
  expect(chip.getAttribute('aria-pressed')).toBe('false');
});
it('заблокированная форма не меняет назначение тегов', async () => {
  await mount({ disabled: true });
  document.querySelector<HTMLButtonElement>('.tag-picker__options button')!.click();
  await nextTick();
  expect(selected.value).toEqual([]);
});
it('большой список сразу показывает все теги без поля поиска и создания', async () => {
  useSongsStore().tags.push(
    ...Array.from({ length: 10 }, (_, i) => ({ id: `extra-${i}`, name: `Тег ${i}` })),
  );
  await mount();
  expect(document.querySelector('input')).toBeNull();
  expect(document.querySelectorAll('.tag-picker__options button')).toHaveLength(12);
  expect(document.querySelector('.tag-picker__body')?.textContent).not.toContain('Поиск тегов');
});
it('viewer и офлайн могут выбирать для фильтра, создание скрыто', async () => {
  useSetlistsStore().setlists[0]!.role = 'viewer';
  await mount();
  document.querySelectorAll<HTMLButtonElement>('.tag-picker__options button')[1]!.click();
  await nextTick();
  expect(selected.value).toEqual(['b']);
  useSongsStore().online = false;
  await nextTick();
  expect(document.querySelector<HTMLButtonElement>('.tag-picker__options button')!.disabled).toBe(
    false,
  );
});

it('фильтр показывает только чипсы и сброс без заголовка и счётчика', async () => {
  await mount();
  expect(document.querySelector('h2')).toBeNull();
  expect(document.querySelector('.tag-picker__header')).toBeNull();
  expect(document.querySelector('details')).toBeNull();
  expect(document.querySelector('input')).toBeNull();
  document.querySelector<HTMLButtonElement>('.tag-picker__options button')!.click();
  await nextTick();
  expect(document.querySelector('.tag-picker__count')).toBeNull();
  expect(document.querySelector('.tag-picker__header')).toBeNull();
  expect(
    document
      .querySelector('.tag-picker__options')
      ?.lastElementChild?.classList.contains('tag-picker__reset'),
  ).toBe(true);
  document.querySelector<HTMLButtonElement>('.tag-picker__reset')!.click();
  await nextTick();
  expect(selected.value).toEqual([]);
  expect(document.querySelector('.tag-picker__reset')).toBeNull();
});
