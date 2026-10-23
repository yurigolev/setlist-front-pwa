import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { authFetch, configureSession, useAuthSession, sessionVersion } from './useAuthSession';
import { openSetlistDatabase } from '@/repositories/database';

const identity = { id: 'alice', displayName: 'Alice' };
const data = (csrfToken = 'old', profile = identity) => ({
  user: profile,
  csrfToken,
  refreshEnabled: true,
});
const unauthorized = () => new Response(null, { status: 401 });
beforeEach(() => {
  localStorage.clear();
  configureSession();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function signedIn() {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(data()));
  await useAuthSession().initialize();
}

describe('единая авторизация', () => {
  it('параллельные 401 разделяют один refresh, повторяют запросы с новым CSRF без смены поколения', async () => {
    await signedIn();
    const epoch = sessionVersion();
    let renewed = false;
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (String(url).endsWith('/auth/session')) return unauthorized();
      if (String(url).endsWith('/refresh-context')) return Response.json(data('new'));
      if (String(url).endsWith('/auth/refresh')) {
        renewed = true;
        return Response.json(data('new'));
      }
      if (!renewed) return unauthorized();
      expect(new Headers(options?.headers).get('x-csrf-token')).toBe('new');
      expect(options?.body).toBe('payload');
      return Response.json({ ok: true });
    });
    const responses = await Promise.all([
      authFetch('/v1/a', { method: 'POST', body: 'payload' }),
      authFetch('/v1/b', { method: 'POST', body: 'payload' }),
    ]);
    expect(responses.every((r) => r.ok)).toBe(true);
    expect(
      vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh')),
    ).toHaveLength(1);
    expect(sessionVersion()).toBe(epoch);
  });
  it('не запускает цикл после повторного 401', async () => {
    await signedIn();
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/refresh-context') || String(url).endsWith('/auth/refresh'))
        return Response.json(data());
      return unauthorized();
    });
    expect((await authFetch('/v1/a')).status).toBe(401);
    expect(useAuthSession().reauthRequired.value).toBe(true);
    expect(vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).endsWith('/v1/a'))).toHaveLength(
      2,
    );
    expect(
      vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh')),
    ).toHaveLength(1);
  });
  it.each(['network', 'server'])(
    'не повторяет mutation с неизвестным результатом: %s',
    async (kind) => {
      await signedIn();
      vi.mocked(fetch).mockClear();
      vi.mocked(fetch).mockImplementation(async () => {
        if (kind === 'network') throw new TypeError('Failed to fetch');
        return new Response(null, { status: 503 });
      });
      const result = authFetch('/v1/a', { method: 'POST', body: 'payload' });
      if (kind === 'network') await expect(result).rejects.toThrow('Failed to fetch');
      else expect((await result).status).toBe(503);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(useAuthSession().reauthRequired.value).toBe(false);
    },
  );
  it('сетевой сбой refresh сохраняет личность и не требует повторного входа', async () => {
    await signedIn();
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/refresh-context')) throw new TypeError('Failed to fetch');
      return unauthorized();
    });
    await expect(authFetch('/v1/a')).rejects.toThrow('Failed to fetch');
    expect(useAuthSession().user.value?.id).toBe('alice');
    expect(useAuthSession().reauthRequired.value).toBe(false);
    expect(useAuthSession().offline.value).toBe(true);
  });
  it('logout во время refresh не восстанавливает личность и ждёт ротацию до серверного выхода', async () => {
    await signedIn();
    let finish!: (r: Response) => void;
    let started!: () => void;
    const refreshing = new Promise<void>((r) => {
      started = r;
    });
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/refresh-context')) return Response.json(data());
      if (String(url).endsWith('/auth/refresh')) {
        started();
        return new Promise<Response>((r) => {
          finish = r;
        });
      }
      if (String(url).endsWith('/auth/logout')) return new Response(null, { status: 204 });
      return unauthorized();
    });
    const request = authFetch('/v1/a');
    await refreshing;
    const logout = useAuthSession().logout();
    expect(useAuthSession().user.value).toBeUndefined();
    finish(Response.json(data('new')));
    await logout;
    await request;
    expect(useAuthSession().user.value).toBeUndefined();
    expect(localStorage.getItem('setlist-session-user')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).endsWith('/v1/a'))).toHaveLength(
      1,
    );
  });
  it('ответ другого аккаунта не повторяет исходную mutation и удаляет прежний кэш', async () => {
    await signedIn();
    const db = await openSetlistDatabase('alice', 'scope');
    await db.put('serverFiles', new Blob(['secret']), 'file');
    db.close();
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('/auth/session')
        ? Response.json(data('bob', { id: 'bob', displayName: 'Bob' }))
        : unauthorized(),
    );
    expect((await authFetch('/v1/a', { method: 'POST' })).status).toBe(401);
    expect(useAuthSession().user.value?.id).toBe('bob');
    expect(vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).endsWith('/v1/a'))).toHaveLength(
      1,
    );
    const old = await openSetlistDatabase('alice', 'scope');
    expect(await old.get('serverFiles', 'file')).toBeUndefined();
    old.close();
  });
  it('409 ротации перепроверяет access без второго refresh', async () => {
    await signedIn();
    let sessions = 0;
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/auth/session'))
        return ++sessions === 1 ? unauthorized() : Response.json(data('new'));
      if (String(url).endsWith('/refresh-context')) return Response.json(data());
      if (String(url).endsWith('/auth/refresh')) return new Response(null, { status: 409 });
      return sessions > 1 ? Response.json({ ok: true }) : unauthorized();
    });
    expect((await authFetch('/v1/a')).ok).toBe(true);
    expect(useAuthSession().reauthRequired.value).toBe(false);
    expect(
      vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh')),
    ).toHaveLength(1);
  });
  it('Web Lock перепроверяет access другой вкладки без ротации', async () => {
    await signedIn();
    const lock = vi.fn(async (_name: string, work: () => Promise<unknown>) => work());
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: lock } });
    try {
      let requests = 0;
      vi.mocked(fetch).mockImplementation(async (url) =>
        String(url).endsWith('/auth/session')
          ? Response.json(data('other-tab'))
          : ++requests === 1
            ? unauthorized()
            : Response.json({ ok: true }),
      );
      expect((await authFetch('/v1/a')).ok).toBe(true);
      expect(lock).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).endsWith('/auth/refresh'))).toBe(
        false,
      );
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    }
  });
});

it('истечение refresh меняет поколение, поэтому запоздалый успешный ответ нельзя публиковать', async () => {
  await signedIn();
  const epoch = sessionVersion();
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).endsWith('/v1/late')
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : unauthorized(),
  );
  const late = authFetch('/v1/late');
  await authFetch('/v1/expired');
  expect(sessionVersion()).toBeGreaterThan(epoch);
  expect(useAuthSession().reauthRequired.value).toBe(true);
  finish(Response.json({ stale: true }));
  await late;
  expect(useAuthSession().reauthRequired.value).toBe(true);
  expect(useAuthSession().user.value?.id).toBe('alice');
});

it('все потребители composable разделяют состояние и одну инициализацию', async () => {
  const first = useAuthSession(),
    second = useAuthSession();
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const a = first.initialize(),
    b = second.initialize(true);
  expect(a).toBe(b);
  expect(first.user).toBe(second.user);
  expect(fetch).toHaveBeenCalledTimes(1);
  finish(Response.json(data()));
  await Promise.all([a, b]);
  expect(first.ready.value).toBe(true);
  expect(second.user.value?.id).toBe('alice');
});

it('устаревшая инициализация не помечает новую сессию готовой', async () => {
  const callbacks: Array<(response: Response) => void> = [];
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        callbacks.push(resolve);
      }),
  );
  const old = useAuthSession().initialize();
  configureSession();
  const current = useAuthSession().initialize();
  callbacks[0]!(Response.json(data()));
  await old;
  expect(useAuthSession().ready.value).toBe(false);
  expect(useAuthSession().user.value).toBeUndefined();
  callbacks[1]!(Response.json(data('new')));
  await current;
  expect(useAuthSession().ready.value).toBe(true);
  expect(useAuthSession().user.value?.id).toBe('alice');
});

it('после перезапуска незавершённый выход блокирует восстановление и отзывается новым CSRF', async () => {
  localStorage.setItem('setlist-logout-pending', 'alice');
  const auth = useAuthSession();
  await auth.initialize();
  expect(fetch).not.toHaveBeenCalled();
  expect(auth.logoutPending.value).toBe(true);
  expect(auth.user.value).toBeUndefined();
  vi.mocked(fetch)
    .mockResolvedValueOnce(unauthorized())
    .mockResolvedValueOnce(Response.json(data('context')))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  await auth.logout();
  expect(localStorage.getItem('setlist-logout-pending')).toBeNull();
  expect(auth.logoutPending.value).toBe(false);
  expect(new Headers(vi.mocked(fetch).mock.calls[2]?.[1]?.headers).get('x-csrf-token')).toBe(
    'context',
  );
  expect(
    vi.mocked(fetch).mock.calls.some((call) => String(call[0]).endsWith('/auth/refresh')),
  ).toBe(false);
});

it('ошибка 503 при refresh сохраняет личность, поколение и кэш без reauth', async () => {
  await signedIn();
  const epoch = sessionVersion();
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).endsWith('/auth/refresh')
      ? new Response(null, { status: 503 })
      : String(url).endsWith('/refresh-context')
        ? Response.json(data())
        : unauthorized(),
  );
  await expect(authFetch('/v1/a')).rejects.toThrow('(503)');
  expect(useAuthSession().reauthRequired.value).toBe(false);
  expect(useAuthSession().offline.value).toBe(false);
  expect(useAuthSession().user.value?.id).toBe('alice');
  expect(sessionVersion()).toBe(epoch);
  expect(localStorage.getItem('setlist-session-user')).toContain('alice');
});

it('сетевой сбой исходного запроса переводит сессию в режим чтения без повторов', async () => {
  await signedIn();
  vi.mocked(fetch).mockClear();
  vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(authFetch('/v1/a', { method: 'PATCH', body: 'payload' })).rejects.toThrow(
    'Failed to fetch',
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(useAuthSession().localOnly.value).toBe(true);
  expect(useAuthSession().user.value?.id).toBe('alice');
  expect(useAuthSession().reauthRequired.value).toBe(false);
});

it('legacy bootstrap перепроверяет cookie после Web Lock: другая вкладка уже обновила сессию', async () => {
  let unlock!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, work: () => Promise<unknown>) => {
        entered();
        await new Promise<void>((resolve) => {
          unlock = resolve;
        });
        return work();
      },
    },
  });
  try {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ ...data('legacy'), refreshEnabled: false }))
      .mockResolvedValueOnce(Response.json(data('other-tab')));
    const initialize = useAuthSession().initialize();
    await waiting;
    unlock();
    await initialize;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(fetch).mock.calls.every((call) => String(call[0]).endsWith('/auth/session')),
    ).toBe(true);
    expect(useAuthSession().user.value?.id).toBe('alice');
    const { sessionOptions } = await import('./useAuthSession');
    expect(new Headers(sessionOptions({ method: 'POST' }).headers).get('x-csrf-token')).toBe(
      'other-tab',
    );
  } finally {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  }
});

it('незавершённая конкурирующая ротация 409 остаётся временной ошибкой без выхода', async () => {
  await signedIn();
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).endsWith('/refresh-context')
      ? Response.json(data())
      : String(url).endsWith('/auth/refresh')
        ? new Response(null, { status: 409 })
        : unauthorized(),
  );
  await expect(authFetch('/v1/a')).rejects.toThrow('Обновление входа ещё не завершено');
  expect(useAuthSession().reauthRequired.value).toBe(false);
  expect(useAuthSession().user.value?.id).toBe('alice');
  expect(
    vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).endsWith('/v1/a')),
  ).toHaveLength(1);
});

it('холодный старт при 503 сохраняет кэш и разрешает только чтение до успешной проверки', async () => {
  localStorage.setItem('setlist-session-user', JSON.stringify(identity));
  const db = await openSetlistDatabase('alice', 'scope');
  await db.put('serverFiles', new Blob(['offline']), 'cached');
  db.close();
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
  const auth = useAuthSession();
  await auth.initialize();
  expect(auth.user.value?.id).toBe('alice');
  expect(auth.verificationPending.value).toBe(true);
  expect(auth.localOnly.value).toBe(true);
  expect(auth.offline.value).toBe(false);
  expect(auth.reauthRequired.value).toBe(false);
  const cached = await openSetlistDatabase('alice', 'scope');
  expect(await cached.get('serverFiles', 'cached')).toBeDefined();
  cached.close();
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(data()));
  await auth.initialize(true);
  expect(auth.verificationPending.value).toBe(false);
  expect(auth.localOnly.value).toBe(false);
});

it('503 при перепроверке действующей сессии не блокирует подтверждённую личность', async () => {
  await signedIn();
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
  const auth = useAuthSession();
  await auth.initialize(true);
  expect(auth.user.value?.id).toBe('alice');
  expect(auth.verificationPending.value).toBe(false);
  expect(auth.localOnly.value).toBe(false);
  expect(auth.reauthRequired.value).toBe(false);
});

it('запоздалая смена аккаунта другой вкладки удаляет только прежний кэш', async () => {
  await signedIn();
  const bob = { id: 'bob', displayName: 'Bob' };
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(data('bob', bob)));
  await useAuthSession().initialize(true);
  const current = await openSetlistDatabase('bob', 'scope');
  await current.put('serverFiles', new Blob(['new-account']), 'fresh');
  current.close();
  const old = await openSetlistDatabase('alice', 'scope');
  await old.put('serverFiles', new Blob(['old-account']), 'old');
  old.close();
  const epoch = sessionVersion();
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'setlist-session-reset',
      newValue: JSON.stringify({ reason: 'account-change', previousUserId: 'alice' }),
    }),
  );
  expect(useAuthSession().user.value?.id).toBe('bob');
  expect(sessionVersion()).toBe(epoch);
  await vi.waitFor(async () => {
    const old = await openSetlistDatabase('alice', 'scope');
    const saved = await old.get('serverFiles', 'old');
    old.close();
    expect(saved).toBeUndefined();
  });
  const saved = await openSetlistDatabase('bob', 'scope');
  expect(await saved.get('serverFiles', 'fresh')).toBeDefined();
  saved.close();
});

it('смена аккаунта другой вкладки сбрасывает текущий прежний контекст', async () => {
  await signedIn();
  const epoch = sessionVersion();
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'setlist-session-reset',
      newValue: JSON.stringify({ reason: 'account-change', previousUserId: 'alice' }),
    }),
  );
  expect(useAuthSession().user.value).toBeUndefined();
  expect(sessionVersion()).toBeGreaterThan(epoch);
});

it('холодный старт без сети показывает offline без ошибки онлайн-проверки', async () => {
  localStorage.setItem('setlist-session-user', JSON.stringify(identity));
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const auth = useAuthSession();
  await auth.initialize();
  expect(auth.user.value?.id).toBe('alice');
  expect(auth.offline.value).toBe(true);
  expect(auth.verificationPending.value).toBe(false);
  expect(auth.reauthRequired.value).toBe(false);
  expect(auth.localOnly.value).toBe(true);
});

describe('вход через Яндекс', () => {
  it.each([
    ['/songs/a?tab=notes', '/songs/a?tab=notes'],
    ['/invite', '/invite'],
    ['https://evil.test', '/'],
    ['//evil.test', '/'],
  ])('открывает серверный OAuth с безопасным returnTo: %s', (returnTo, expected) => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    useAuthSession().login(returnTo);
    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(
      `/v1/auth/yandex/start?returnTo=${encodeURIComponent(expected)}`,
    );
  });
  it('не начинает новый вход, пока не завершён предыдущий выход', () => {
    localStorage.setItem('setlist-logout-pending', 'alice');
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    useAuthSession().login('/invite');
    expect(assign).not.toHaveBeenCalled();
    expect(useAuthSession().error.value).toContain('Сначала завершите выход');
  });
});
