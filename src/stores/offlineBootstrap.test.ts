import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { configureSession } from '@/composables/useAuthSession';
import { clearPrivateDatabases } from '@/repositories/database';
import { publishSnapshot, readServerFile } from '@/repositories/serverSnapshotRepository';
import { sha256Hex } from '@/services/checksum';
import { useAuthStore } from './auth';
import { useSetlistsStore, type Setlist } from './setlists';
import { useSongsStore } from './songs';

const user = { id: 'offline-bootstrap-qa', displayName: 'Музыкант' };
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const catalog: Setlist[] = [first, second].map((id, i) => ({
  id,
  title: `Сетлист ${i + 1}`,
  role: 'owner',
  revision: 1,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
}));
let pinia: ReturnType<typeof createPinia>;
beforeEach(() => {
  localStorage.clear();
  configureSession();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      String(url).endsWith('/auth/session')
        ? Response.json({ user, csrfToken: 'verified', refreshEnabled: true })
        : Response.json({ setlists: catalog }),
    ),
  );
});
afterEach(async () => {
  disposePinia(pinia);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await clearPrivateDatabases(user.id);
});

async function onlineVisit() {
  await useAuthStore().initialize();
  await useSetlistsStore().initialize();
}
function restart() {
  disposePinia(pinia);
  configureSession();
  pinia = createPinia();
  setActivePinia(pinia);
}

it.each([false, true])(
  'холодный запуск при onLine=%s открывает оба сетлиста, текст и файл без сервера',
  async (reportedOnline) => {
    await onlineVisit();
    const blob = new Blob(['saved-file'], { type: 'image/png' });
    const checksum = await sha256Hex(await blob.arrayBuffer());
    vi.mocked(fetch).mockImplementation(async () => new Response(await blob.arrayBuffer()));
    for (const setlistId of [first, second]) {
      await publishSnapshot(
        {
          libraryId: setlistId,
          libraryRevision: 1,
          songs: [
            {
              id: first,
              setlistId,
              title: `Песня ${setlistId}`,
              artist: 'Артист',
              content: 'Сохранённый текст',
              revision: 1,
              createdAt: '',
              updatedAt: '',
              attachments: [
                {
                  id: first,
                  songId: first,
                  setlistId,
                  kind: 'image',
                  name: 'saved.png',
                  mimeType: 'image/png',
                  fileKey: 'saved-file',
                  byteSize: blob.size,
                  checksum,
                  contentUrl: `/v1/setlists/${setlistId}/attachments/${first}/content`,
                  createdAt: '',
                },
              ],
            },
          ],
        },
        user.id,
        () => true,
        setlistId,
      );
    }
    restart();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(reportedOnline);
    vi.mocked(fetch)
      .mockClear()
      .mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal!.reason));
          }),
      );
    vi.useFakeTimers();
    const init = useAuthStore().initialize();
    await vi.advanceTimersByTimeAsync(5_000);
    await init;
    vi.useRealTimers();
    const lists = useSetlistsStore();
    await lists.initialize();
    expect(lists.setlists.map((item) => item.id)).toEqual([first, second]);
    expect(lists.canManage).toBe(false);
    const songs = useSongsStore();
    for (const id of [first, second]) {
      lists.select(id);
      await songs.load();
      expect(songs.songs[0]?.content).toBe('Сохранённый текст');
      expect(await (await readServerFile('saved-file', user.id, id))?.text()).toBe('saved-file');
      expect(songs.canWrite).toBe(false);
    }
    expect(fetch).toHaveBeenCalledTimes(reportedOnline ? 1 : 0);
  },
);

it('зависший список сетлистов после проверки входа открывает кэш без прав записи', async () => {
  await onlineVisit();
  restart();
  await useAuthStore().initialize();
  vi.mocked(fetch).mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal!.reason));
      }),
  );
  vi.useFakeTimers();
  const lists = useSetlistsStore();
  const init = lists.initialize();
  await vi.advanceTimersByTimeAsync(5_000);
  await init;
  expect(lists.current?.id).toBe(first);
  expect(lists.ready).toBe(true);
  expect(lists.canManage).toBe(false);
  expect(useAuthStore().localOnly).toBe(true);
});

it('старый формат кэша читается после обновления', async () => {
  localStorage.setItem('setlist-session-user', JSON.stringify(user));
  localStorage.setItem(
    `setlist-selection:${user.id}`,
    JSON.stringify({ id: first, setlist: catalog[0] }),
  );
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await useAuthStore().initialize();
  await useSetlistsStore().initialize();
  expect(useSetlistsStore().current?.id).toBe(first);
  expect(fetch).not.toHaveBeenCalled();
});

it('отозванный сетлист удаляется и из сохранённого списка', async () => {
  await onlineVisit();
  await useSetlistsStore().revokeScope(second);
  restart();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await useAuthStore().initialize();
  await useSetlistsStore().initialize();
  expect(useSetlistsStore().setlists.map((item) => item.id)).toEqual([first]);
});
