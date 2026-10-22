import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { openSetlistDatabase } from '@/repositories/database';
import { readSnapshot } from '@/repositories/serverSnapshotRepository';
import { apiBaseUrl, configureSession, notifyUnauthorized } from '@/services/sessionTransport';
import { useAuthStore } from './auth';
import { useSetlistsStore } from './setlists';
import { useSongsStore } from './songs';

const id = '11111111-1111-4111-8111-111111111111';
const libraryId = '22222222-2222-4222-8222-222222222222';
const serverSong = {
  setlistId: libraryId,
  id,
  title: 'Песня',
  artist: 'Артист',
  notes: 'Текст',
  revision: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  attachments: [],
};
let serverSongs: (typeof serverSong)[];
let calls: Array<{ path: string; options?: RequestInit }>;
beforeEach(() => {
  configureSession();
  setActivePinia(createPinia());
  useAuthStore().user = { id: 'test-user', displayName: 'Test' };
  const lists = useSetlistsStore();
  lists.setlists = [
    {
      id: libraryId,
      title: 'Test',
      revision: 0,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      role: 'owner',
    },
  ];
  lists.select(libraryId);
  lists.ready = true;
  serverSongs = [];
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      calls.push({ path: url, options });
      if (url.endsWith(`/v1/setlists/${libraryId}/snapshot`))
        return Response.json({
          setlistId: libraryId,
          setlistRevision: 1,
          role: 'owner',
          songs: serverSongs,
        });
      if (url.endsWith(`/v1/setlists/${libraryId}/songs`) && options?.method === 'POST') {
        serverSongs = [serverSong];
        return Response.json(serverSong);
      }
      return Response.json(
        { code: 'NOT_FOUND', message: 'Not found', requestId: id },
        { status: 404 },
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  indexedDB.deleteDatabase('setlist-library');
});

describe('серверная библиотека', () => {
  it('передаёт notes и стабильный ключ, затем читает подтверждённый снимок', async () => {
    const store = useSongsStore();
    const saved = await store.create({ title: 'Песня', artist: 'Артист', content: 'Текст' }, id);
    expect(saved.content).toBe('Текст');
    expect(store.songs).toHaveLength(1);
    const post = calls.find((call) => call.options?.method === 'POST')!;
    expect(post.options?.headers).toMatchObject({ 'Idempotency-Key': id });
    expect(JSON.parse(String(post.options?.body))).toEqual({
      title: 'Песня',
      artist: 'Артист',
      notes: 'Текст',
    });
  });
  it('не отправляет старые локальные записи на сервер при загрузке', async () => {
    const store = useSongsStore();
    await store.load();
    expect(store.songs).toEqual([]);
    expect(calls.map((call) => call.path)).toEqual([
      `${apiBaseUrl}/v1/setlists/${libraryId}/snapshot`,
    ]);
  });
  it('не возвращает песни запоздалого refresh после сброса сессии', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const store = useSongsStore();
    const refresh = store.refresh();
    useAuthStore().invalidate();
    resolve(
      Response.json({
        setlistId: libraryId,
        setlistRevision: 1,
        role: 'owner',
        songs: [serverSong],
      }),
    );
    await refresh;
    expect(store.songs).toEqual([]);
    expect(store.meta).toBeUndefined();
  });
  it('требует исполнителя до запроса', async () => {
    await expect(useSongsStore().create({ title: 'Песня' })).rejects.toThrow('исполнителя');
    expect(calls).toEqual([]);
  });
});

describe('границы сет-листа', () => {
  const otherId = '33333333-3333-4333-8333-333333333333';
  function addOther() {
    const lists = useSetlistsStore();
    lists.setlists.push({
      id: otherId,
      title: 'Other',
      revision: 0,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      role: 'editor',
    });
    return lists;
  }
  it('viewer не может отправить изменение', async () => {
    useSetlistsStore().current!.role = 'viewer';
    const store = useSongsStore();
    expect(store.canWrite).toBe(false);
    await expect(store.create({ title: 'X', artist: 'Y' })).rejects.toThrow('Нет права');
    expect(calls).toEqual([]);
  });
  it('editor может удалить песню', async () => {
    useSetlistsStore().current!.role = 'editor';
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
      options?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : Response.json({ setlistId: libraryId, setlistRevision: 2, role: 'editor', songs: [] }),
    );
    vi.stubGlobal('fetch', fetcher);
    await useSongsStore().remove({ ...serverSong, content: '', attachments: [] });
    expect(fetcher.mock.calls[0][0]).toContain(`/setlists/${libraryId}/songs/${id}`);
  });
  it('поздняя mutation не обновляет новый контекст', async () => {
    const lists = addOther();
    let finish!: (value: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const store = useSongsStore(),
      operation = store.create({ title: 'X', artist: 'Y' });
    lists.select(otherId);
    finish(Response.json(serverSong));
    await expect(operation).rejects.toThrow('Контекст изменился');
    expect(store.songs).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('403 старого scope не очищает выбранный новый scope', async () => {
    const lists = addOther();
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const store = useSongsStore(),
      operation = store.refresh();
    lists.select(otherId);
    finish(Response.json({ code: 'SETLIST_ACCESS_DENIED' }, { status: 403 }));
    await operation;
    expect(lists.selectedId).toBe(otherId);
  });
  it('CSRF_INVALID сохраняет membership', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'CSRF_INVALID' }, { status: 403 })),
    );
    await expect(useSongsStore().create({ title: 'X', artist: 'Y' })).rejects.toMatchObject({
      code: 'CSRF_INVALID',
    });
    expect(useSetlistsStore().selectedId).toBe(libraryId);
  });
  it('copy допускает read source и write target', async () => {
    addOther();
    useSetlistsStore().current!.role = 'viewer';
    const fetcher = vi.fn(async () =>
      Response.json({ ...serverSong, setlistId: otherId, id: otherId }),
    );
    vi.stubGlobal('fetch', fetcher);
    await useSongsStore().copy({ ...serverSong, attachments: [] }, otherId);
    expect(fetcher.mock.calls[0][0]).toContain(`/setlists/${libraryId}/songs/${id}/copy`);
  });
});

it('недостаточная роль обновляет роли, сохраняя scope и кэш', async () => {
  const list = useSetlistsStore().current!;
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith('/v1/setlists')
      ? Response.json({ setlists: [{ ...list, role: 'viewer' }] })
      : Response.json({ code: 'SETLIST_ROLE_REQUIRED' }, { status: 403 }),
  );
  vi.stubGlobal('fetch', fetcher);
  const store = useSongsStore();
  await expect(store.create({ title: 'X', artist: 'Y' })).rejects.toMatchObject({
    code: 'SETLIST_ROLE_REQUIRED',
  });
  expect(useSetlistsStore().selectedId).toBe(libraryId);
  expect(store.canWrite).toBe(false);
});

it('отзыв соседней вкладки очищает только указанный scope', async () => {
  const lists = useSetlistsStore(),
    store = useSongsStore();
  lists.setlists.push({
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Other',
    revision: 0,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    role: 'owner',
  });
  store.songs = [{ ...serverSong, attachments: [] }];
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'setlist-scope-revoked',
      newValue: JSON.stringify({
        userId: 'test-user',
        setlistId: '33333333-3333-4333-8333-333333333333',
      }),
    }),
  );
  expect(lists.selectedId).toBe(libraryId);
  expect(store.songs).toHaveLength(1);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'setlist-scope-revoked',
      newValue: JSON.stringify({ userId: 'test-user', setlistId: libraryId }),
    }),
  );
  expect(lists.selectedId).toBeUndefined();
  expect(store.songs).toEqual([]);
});

it('поздний список не возвращает membership после нового ответа', async () => {
  const lists = useSetlistsStore(),
    previous = { ...lists.current! };
  const responses: Array<(response: Response) => void> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          responses.push(resolve);
        }),
    ),
  );
  const older = lists.initialize(true),
    newer = lists.initialize(true);
  responses[1]!(Response.json({ setlists: [] }));
  await newer;
  responses[0]!(Response.json({ setlists: [previous] }));
  await older;
  expect(lists.setlists).toEqual([]);
  expect(lists.selectedId).toBeUndefined();
  expect(lists.loading).toBe(false);
});

it('поздний список не возвращает scope после отзыва соседней вкладки', async () => {
  const lists = useSetlistsStore(),
    previous = { ...lists.current! };
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const initialization = lists.initialize(true);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'setlist-scope-revoked',
      newValue: JSON.stringify({ userId: 'test-user', setlistId: libraryId }),
    }),
  );
  finish(Response.json({ setlists: [previous] }));
  await initialization;
  expect(lists.setlists).toEqual([]);
  expect(lists.selectedId).toBeUndefined();
  expect(lists.loading).toBe(false);
});

describe('синхронизация сетлистов без переключения', () => {
  const otherId = '44444444-4444-4444-8444-444444444444';
  function addOther() {
    const lists = useSetlistsStore();
    lists.setlists.push({
      id: otherId,
      title: 'Other',
      revision: 0,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
      role: 'viewer',
    });
    return lists;
  }
  it('сохраняет другой сетлист отдельно, не меняет выбор и песни открытого', async () => {
    const lists = addOther(),
      store = useSongsStore();
    serverSongs = [serverSong];
    await store.refresh();
    const otherSong = {
      ...serverSong,
      id: '55555555-5555-4555-8555-555555555555',
      setlistId: otherId,
      title: 'Другая песня',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          setlistId: otherId,
          setlistRevision: 3,
          role: 'viewer',
          songs: [otherSong],
        }),
      ),
    );
    await store.syncSetlist(otherId);
    expect(lists.selectedId).toBe(libraryId);
    expect(store.songs.map((song) => song.title)).toEqual(['Песня']);
    expect((await readSnapshot('test-user', otherId)).songs.map((song) => song.title)).toEqual([
      'Другая песня',
    ]);
    expect(lists.setlists.find((item) => item.id === otherId)?.revision).toBe(3);
  });
  it('объединяет одновременные запросы одного сетлиста', async () => {
    addOther();
    let finish!: (response: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const store = useSongsStore(),
      first = store.syncSetlist(otherId),
      second = store.syncSetlist(otherId);
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(Response.json({ setlistId: otherId, setlistRevision: 1, role: 'viewer', songs: [] }));
    await Promise.all([first, second]);
  });
  it('не сохраняет запоздалый снимок после выхода', async () => {
    addOther();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const task = useSongsStore().syncSetlist(otherId);
    useAuthStore().invalidate();
    finish(Response.json({ setlistId: otherId, setlistRevision: 4, role: 'viewer', songs: [] }));
    await expect(task).rejects.toThrow('Контекст изменился');
    expect((await readSnapshot('test-user', otherId)).meta?.libraryRevision).not.toBe(4);
  });
  it('при отзыве доступа удаляет только недоступный сетлист', async () => {
    const lists = addOther();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'SETLIST_ACCESS_DENIED' }, { status: 403 })),
    );
    await expect(useSongsStore().syncSetlist(otherId)).rejects.toMatchObject({
      code: 'SETLIST_ACCESS_DENIED',
    });
    expect(lists.selectedId).toBe(libraryId);
    expect(lists.setlists.map((item) => item.id)).toEqual([libraryId]);
  });
});

describe('время синхронизации', () => {
  it('восстанавливает успешную дату из кеша и сохраняет её при ошибке', async () => {
    const store = useSongsStore();
    await store.syncSetlist(libraryId);
    const successfulAt = store.syncedAt[libraryId];
    expect(successfulAt).toBe((await readSnapshot('test-user', libraryId)).meta?.updatedAt);
    store.syncedAt = {};
    await store.loadSyncTimes();
    expect(store.syncedAt[libraryId]).toBe(successfulAt);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'Недоступно' }, { status: 500 })),
    );
    await expect(store.syncSetlist(libraryId)).rejects.toThrow('Недоступно');
    expect(store.syncedAt[libraryId]).toBe(successfulAt);
    useAuthStore().invalidate();
    expect(store.syncedAt).toEqual({});
  });
});

describe('истечение входа сохраняет офлайн-библиотеку', () => {
  it('сохраняет снимок и выбор, блокирует изменения и синхронизацию', async () => {
    serverSongs = [serverSong];
    const songs = useSongsStore(),
      lists = useSetlistsStore(),
      auth = useAuthStore();
    await songs.refresh();
    const cachedAt = songs.meta?.updatedAt;
    calls = [];
    notifyUnauthorized();
    expect(auth.reauthRequired).toBe(true);
    expect(auth.user?.id).toBe('test-user');
    expect(songs.songs.map((song) => song.title)).toEqual(['Песня']);
    expect(lists.selectedId).toBe(libraryId);
    expect(songs.canWrite).toBe(false);
    expect(lists.canManage).toBe(false);
    await expect(songs.create({ title: 'X', artist: 'Y' })).rejects.toThrow('Нет права');
    await expect(lists.create('New')).rejects.toThrow('требуется интернет и вход');
    await expect(songs.syncSetlist(libraryId)).rejects.toThrow('требуется интернет и вход');
    expect(calls).toEqual([]);
    await songs.load();
    expect(songs.meta?.updatedAt).toBe(cachedAt);
    expect((await readSnapshot('test-user', libraryId)).songs).toHaveLength(1);
  });
  it('отбрасывает поздний снимок после истечения, оставляя предыдущий кэш', async () => {
    serverSongs = [serverSong];
    const songs = useSongsStore();
    await songs.refresh();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const task = songs.refresh();
    notifyUnauthorized();
    expect(songs.isSyncing).toBe(false);
    finish(
      Response.json({
        setlistId: libraryId,
        setlistRevision: 2,
        role: 'owner',
        songs: [{ ...serverSong, title: 'Поздняя песня', revision: 2 }],
      }),
    );
    await task;
    expect(songs.songs.map((song) => song.title)).toEqual(['Песня']);
    expect((await readSnapshot('test-user', libraryId)).songs.map((song) => song.title)).toEqual([
      'Песня',
    ]);
  });
  it('отбрасывает поздние сетлисты после истечения, не очищая выбор', async () => {
    const lists = useSetlistsStore();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const task = lists.initialize(true);
    notifyUnauthorized();
    expect(lists.loading).toBe(false);
    finish(Response.json({ setlists: [] }));
    await task;
    expect(lists.selectedId).toBe(libraryId);
    expect(lists.setlists).toHaveLength(1);
  });
  it('повторная проверка того же пользователя сохраняет кэш', async () => {
    serverSongs = [serverSong];
    const songs = useSongsStore(),
      auth = useAuthStore();
    await songs.refresh();
    notifyUnauthorized();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          user: { id: 'test-user', displayName: 'Test' },
          csrfToken: 'restored',
          refreshEnabled: true,
        }),
      ),
    );
    await auth.initialize(true);
    expect(auth.reauthRequired).toBe(false);
    expect(songs.songs.map((song) => song.title)).toEqual(['Песня']);
    expect((await readSnapshot('test-user', libraryId)).songs).toHaveLength(1);
  });
});

it('повторная проверка временно недоступной авторизации восстанавливает синхронизацию', async () => {
  const auth = useAuthStore(),
    lists = useSetlistsStore(),
    songs = useSongsStore();
  const list = { ...lists.current! };
  auth.verificationPending = true;
  expect(songs.canWrite).toBe(false);
  await expect(songs.create({ title: 'X', artist: 'Y' })).rejects.toThrow('Нет права');
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      paths.push(url);
      if (url.endsWith('/v1/auth/session'))
        return Response.json({
          user: { id: 'test-user', displayName: 'Test' },
          csrfToken: 'restored',
          refreshEnabled: true,
        });
      if (url.endsWith('/v1/setlists')) return Response.json({ setlists: [list] });
      return Response.json({
        setlistId: libraryId,
        setlistRevision: 1,
        role: 'owner',
        songs: [serverSong],
      });
    }),
  );
  await songs.retryConnection();
  expect(auth.verificationPending).toBe(false);
  expect(songs.canWrite).toBe(true);
  expect(songs.songs.map((song) => song.title)).toEqual(['Песня']);
  expect(paths.map((path) => path.replace(apiBaseUrl, ''))).toEqual([
    '/v1/auth/session',
    '/v1/setlists',
    `/v1/setlists/${libraryId}/snapshot`,
  ]);
});

it('100 дней офлайна и отказ refresh сохраняют файл для повторного входа того же пользователя', async () => {
  const auth = useAuthStore(),
    lists = useSetlistsStore(),
    songs = useSongsStore();
  const list = { ...lists.current! };
  serverSongs = [serverSong];
  await songs.refresh();
  const db = await openSetlistDatabase('test-user', libraryId);
  await db.put('serverFiles', new Blob(['cached-file']), 'long-offline-file');
  db.close();
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date(Date.now() + 100 * 24 * 60 * 60 * 1000));
    auth.offline = true;
    await songs.load();
    expect(songs.songs.map((song) => song.title)).toEqual(['Песня']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await auth.initialize(true);
    expect(auth.reauthRequired).toBe(true);
    expect(lists.selectedId).toBe(libraryId);
    let saved = await openSetlistDatabase('test-user', libraryId);
    expect(await saved.get('serverFiles', 'long-offline-file')).toBeDefined();
    saved.close();
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requests.push(url);
        return url.endsWith('/v1/auth/session')
          ? Response.json({
              user: { id: 'test-user', displayName: 'Test' },
              csrfToken: 'restored',
              refreshEnabled: true,
            })
          : Response.json({ setlists: [list] });
      }),
    );
    await auth.initialize(true);
    await lists.initialize(true);
    saved = await openSetlistDatabase('test-user', libraryId);
    expect(await saved.get('serverFiles', 'long-offline-file')).toBeDefined();
    saved.close();
    expect(requests).toHaveLength(2);
    expect(
      requests.every((url) => url.endsWith('/v1/auth/session') || url.endsWith('/v1/setlists')),
    ).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
