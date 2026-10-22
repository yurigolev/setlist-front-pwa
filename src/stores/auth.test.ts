import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';
import { safeReturnTo, sessionOptions, configureSession } from '@/services/sessionTransport';
import { openSetlistDatabase } from '@/repositories/database';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  configureSession();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
describe('сессия Telegram', () => {
  it('инициализирует один запрос, cookie и CSRF без сохранения токена', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ user: { id: 'a', displayName: 'Alice' }, csrfToken: 'csrf' }),
    );
    const auth = useAuthStore();
    await Promise.all([auth.initialize(), auth.initialize()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(sessionOptions({ method: 'PATCH' }).headers).toMatchObject({ 'X-CSRF-Token': 'csrf' });
    expect(localStorage.getItem('setlist-session-user')).not.toContain('csrf');
  });
  it('истечение refresh сохраняет последнюю личность для чтения', async () => {
    localStorage.setItem('setlist-session-user', JSON.stringify({ id: 'a', displayName: 'Alice' }));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const auth = useAuthStore();
    await auth.initialize();
    expect(auth.user?.id).toBe('a');
    expect(auth.reauthRequired).toBe(true);
    expect(localStorage.getItem('setlist-session-user')).not.toBeNull();
  });
  it('сбой сети разрешает только чтение последней личности', async () => {
    localStorage.setItem('setlist-session-user', JSON.stringify({ id: 'a', displayName: 'Alice' }));
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const auth = useAuthStore();
    await auth.initialize();
    expect(auth.user?.id).toBe('a');
    expect(auth.offline).toBe(true);
  });
  it('выход немедленно очищает RAM, затем сервер и личный cache', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ user: { id: 'logout-user', displayName: 'Alice' }, csrfToken: 'csrf' }),
    );
    const auth = useAuthStore();
    await auth.initialize();
    const db = await openSetlistDatabase('logout-user');
    await db.put('serverMeta', 'secret', 'complete');
    db.close();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const logout = auth.logout();
    expect(auth.user).toBeUndefined();
    await logout;
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'csrf' },
    });
    expect(localStorage.getItem('setlist-private-databases')).toBeNull();
  });
  it('после сбоя выхода позволяет повторить отзыв cookie прежним CSRF без личных данных', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ user: { id: 'retry', displayName: 'Alice' }, csrfToken: 'csrf-retry' }),
    );
    const auth = useAuthStore();
    await auth.initialize();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(auth.logout()).rejects.toThrow('Failed to fetch');
    expect(auth.user).toBeUndefined();
    expect(auth.logoutPending).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ user: { id: 'retry', displayName: 'Alice' }, csrfToken: 'fresh-csrf' }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await auth.logout();
    expect(auth.logoutPending).toBe(false);
    expect(vi.mocked(fetch).mock.calls[3]?.[1]?.headers).toMatchObject({
      'X-CSRF-Token': 'fresh-csrf',
    });
  });
  it('выход из другой вкладки очищает RAM без нового broadcast', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ user: { id: 'a', displayName: 'Alice' }, csrfToken: 'csrf' }),
    );
    const auth = useAuthStore();
    await auth.initialize();
    localStorage.setItem('setlist-session-reset', 'original-signal');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'setlist-session-reset', newValue: 'other-tab-signal' }),
    );
    expect(auth.user).toBeUndefined();
    expect(localStorage.getItem('setlist-session-reset')).toBe('original-signal');
  });
  it('запрет библиотеки сохраняет пользователя, но удаляет его cache и блокирует запись', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ user: { id: 'denied', displayName: 'Alice' }, csrfToken: 'csrf' }),
    );
    const auth = useAuthStore();
    await auth.initialize();
    const db = await openSetlistDatabase('denied');
    await db.put('serverMeta', 'secret', 'complete');
    db.close();
    window.dispatchEvent(new Event('setlist-access-denied'));
    expect(auth.user?.id).toBe('denied');
    expect(auth.accessDenied).toBe(true);
  });
  it('запрещает внешние returnTo и сохраняет внутренний путь', () => {
    expect(safeReturnTo('//evil.test')).toBe('/');
    expect(safeReturnTo('/\\evil.test')).toBe('/');
    expect(safeReturnTo('/songs/a?tab=notes')).toBe('/songs/a?tab=notes');
  });
});

it('сохраняет файлы при истечении refresh и переиспользует их после входа того же пользователя', async () => {
  const identity = { id: 'cached', displayName: 'Cached' };
  localStorage.setItem('setlist-session-user', JSON.stringify(identity));
  const db = await openSetlistDatabase('cached', 'scope');
  await db.put('serverFiles', new Blob(['offline-content']), 'file');
  db.close();
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
  const auth = useAuthStore();
  await auth.initialize();
  expect(auth.user?.id).toBe('cached');
  expect(auth.reauthRequired).toBe(true);
  let saved = await openSetlistDatabase('cached', 'scope');
  expect(await saved.get('serverFiles', 'file')).toBeDefined();
  saved.close();
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ user: identity, csrfToken: 'csrf', refreshEnabled: true }),
  );
  await auth.initialize(true);
  expect(auth.reauthRequired).toBe(false);
  saved = await openSetlistDatabase('cached', 'scope');
  expect(await saved.get('serverFiles', 'file')).toBeDefined();
  saved.close();
});
