import { computed, ref } from 'vue';
import { clearPrivateDatabases } from '@/repositories/database';
import { withNetworkDeadline } from '@/services/networkDeadline';

export interface SessionUser {
  id: string;
  displayName: string;
  username?: string;
  picture?: string;
}
interface SessionData {
  user: SessionUser;
  csrfToken: string;
  refreshEnabled?: boolean;
}
export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const rememberedKey = 'setlist-session-user';
const logoutKey = 'setlist-logout-pending';
const lockName = 'setlist-auth-session';
const user = ref<SessionUser>(),
  ready = ref(false),
  offline = ref(false),
  verificationPending = ref(false),
  reauthRequired = ref(false);
const accessDenied = ref(false),
  logoutPending = ref(false),
  error = ref('');
const localOnly = computed(
  () => offline.value || reauthRequired.value || verificationPending.value,
);
let csrfToken: string | undefined,
  generation = 0,
  credentialRevision = 0;
let initialization: Promise<void> | undefined, refreshPending: Promise<boolean> | undefined;
let unauthorizedCallback: (() => void) | undefined;
let eventsAttached = false;

export function sessionVersion(): number {
  return generation;
}
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/[\r\n]/.test(value)
    ? value
    : '/';
}
export function sessionOptions(options: RequestInit = {}): RequestInit {
  const headers: Record<string, string> =
    options.headers instanceof Headers || Array.isArray(options.headers)
      ? Object.fromEntries(new Headers(options.headers).entries())
      : { ...options.headers };
  if (
    options.method &&
    !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase()) &&
    csrfToken
  )
    headers['X-CSRF-Token'] = csrfToken;
  return {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  };
}
// Compatibility for callers configuring the transport; all state stays in this composable.
export function configureSession(token?: string, unauthorized?: () => void): void {
  generation++;
  credentialRevision++;
  csrfToken = token;
  unauthorizedCallback = unauthorized;
  if (!token) {
    user.value = undefined;
    ready.value = false;
    offline.value = false;
    verificationPending.value = false;
    reauthRequired.value = false;
    accessDenied.value = false;
    logoutPending.value = false;
    error.value = '';
    initialization = undefined;
    refreshPending = undefined;
  }
}
function signalReset(): void {
  window.dispatchEvent(new Event('setlist-session-reset'));
}
function rememberedUser(): SessionUser | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(rememberedKey) ?? 'null');
    if (saved && typeof saved.id === 'string' && typeof saved.displayName === 'string')
      return saved;
  } catch {
    localStorage.removeItem(rememberedKey);
  }
}
function reset(broadcast = true, previousUserId?: string): void {
  generation++;
  credentialRevision++;
  csrfToken = undefined;
  user.value = undefined;
  offline.value = false;
  verificationPending.value = false;
  reauthRequired.value = false;
  accessDenied.value = false;
  if (broadcast) {
    localStorage.removeItem(rememberedKey);
    for (const key of Object.keys(localStorage))
      if (key.startsWith('setlist-selection:')) localStorage.removeItem(key);
    localStorage.setItem(
      'setlist-session-reset',
      JSON.stringify({
        reason: previousUserId ? 'account-change' : 'logout',
        previousUserId,
        time: Date.now(),
        nonce: Math.random(),
      }),
    );
  }
  signalReset();
}
function purge(userId?: string): Promise<void> {
  return clearPrivateDatabases(userId).catch((cause) => {
    error.value = cause instanceof Error ? cause.message : 'Не удалось удалить личный кэш';
    throw cause;
  });
}
function invalidate(): void {
  reset();
  void purge().catch(() => undefined);
}
function expire(): void {
  generation++;
  csrfToken = undefined;
  credentialRevision++;
  user.value ??= rememberedUser();
  reauthRequired.value = true;
  verificationPending.value = false;
  offline.value = false;
  error.value =
    'Срок входа истёк. Войдите через Яндекс для синхронизации. Сохранённые песни доступны для просмотра.';
  unauthorizedCallback?.();
}
export function notifyUnauthorized(): void {
  expire();
}
function denyAccess(broadcast = true): void {
  accessDenied.value = true;
  if (broadcast && user.value)
    localStorage.setItem(
      'setlist-access-denied',
      JSON.stringify({ userId: user.value.id, time: Date.now(), nonce: Math.random() }),
    );
  signalReset();
  if (user.value) void purge(user.value.id).catch(() => undefined);
}
function attachEvents(): void {
  if (eventsAttached) return;
  eventsAttached = true;
  window.addEventListener('setlist-access-denied', () => denyAccess());
  window.addEventListener('storage', (event) => {
    if (event.key === 'setlist-access-denied') {
      try {
        if (JSON.parse(event.newValue ?? 'null')?.userId === user.value?.id) denyAccess(false);
      } catch {
        /* malformed notification */
      }
    }
    if (event.key === 'setlist-session-reset') {
      let change: { reason?: string; previousUserId?: string } | null = null;
      try {
        change = JSON.parse(event.newValue ?? 'null');
      } catch {
        /* legacy notification */
      }
      if (change?.reason === 'account-change' && typeof change.previousUserId === 'string') {
        // A delayed notification must not erase the new account's fresh cache or session.
        if (user.value?.id === change.previousUserId) reset(false);
        void purge(change.previousUserId).catch(() => undefined);
        return;
      }
      reset(false);
      logoutPending.value = localStorage.getItem(logoutKey) !== null;
      void purge().catch(() => undefined);
    }
  });
}
function checkData(data: unknown): SessionData {
  const value = data as Partial<SessionData> | null;
  if (
    !value?.user ||
    typeof value.user.id !== 'string' ||
    typeof value.user.displayName !== 'string' ||
    typeof value.csrfToken !== 'string'
  )
    throw new Error('Некорректный ответ авторизации');
  return value as SessionData;
}
async function accept(data: SessionData, epoch: number): Promise<boolean> {
  if (epoch !== generation || logoutPending.value) return false;
  const previous = user.value ?? rememberedUser();
  if (previous && previous.id !== data.user.id) {
    reset(true, previous.id);
    await purge(previous.id);
    if (epoch + 1 !== generation || logoutPending.value) return false;
  }
  user.value = data.user;
  csrfToken = data.csrfToken;
  credentialRevision++;
  accessDenied.value = false;
  offline.value = false;
  verificationPending.value = false;
  reauthRequired.value = false;
  localStorage.setItem(rememberedKey, JSON.stringify(data.user));
  error.value = '';
  return true;
}
function raw(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, sessionOptions(options));
}
async function withLock<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!navigator.locks) return work();
  return signal
    ? navigator.locks.request(lockName, { signal }, work)
    : navigator.locks.request(lockName, work);
}
function failedResponse(response: Response): never {
  throw new Error(`Не удалось проверить вход (${response.status}). Повторите попытку.`);
}
async function recover(epoch: number, signal?: AbortSignal): Promise<boolean> {
  if (refreshPending) return refreshPending;
  const run = (signal: AbortSignal) =>
    withLock(async () => {
      signal.throwIfAborted();
      if (epoch !== generation || logoutPending.value) return false;
      // Another tab may already have rotated shared cookies while this tab waited.
      let current: SessionData | undefined;
      const sessionResponse = await raw('/v1/auth/session', { signal });
      if (epoch !== generation || logoutPending.value) return false;
      if (sessionResponse.ok) current = checkData(await sessionResponse.json());
      else if (sessionResponse.status !== 401) failedResponse(sessionResponse);
      if (current?.refreshEnabled !== false) {
        if (current) return accept(current, epoch);
        const context = await raw('/v1/auth/refresh-context', { signal });
        if (epoch !== generation || logoutPending.value) return false;
        if (context.status === 401) {
          expire();
          return false;
        }
        if (!context.ok) failedResponse(context);
        current = checkData(await context.json());
      }
      if (epoch !== generation || logoutPending.value) return false;
      csrfToken = current!.csrfToken;
      const response = await raw('/v1/auth/refresh', { method: 'POST', signal });
      if (epoch !== generation || logoutPending.value) return false;
      if (response.status === 401) {
        expire();
        return false;
      }
      if (response.status === 409) {
        const updated = await raw('/v1/auth/session', { signal });
        if (epoch !== generation || logoutPending.value) return false;
        if (!updated.ok) throw new Error('Обновление входа ещё не завершено. Повторите попытку.');
        return accept(checkData(await updated.json()), epoch);
      }
      if (!response.ok) failedResponse(response);
      return accept(checkData(await response.json()), epoch);
    }, signal);
  const pending = signal ? run(signal) : withNetworkDeadline(run);
  refreshPending = pending;
  try {
    return await pending;
  } finally {
    if (refreshPending === pending) refreshPending = undefined;
  }
}
function networkFailure(cause: unknown): void {
  if (
    !navigator.onLine ||
    cause instanceof TypeError ||
    (cause instanceof DOMException && cause.name === 'TimeoutError')
  ) {
    offline.value = true;
    user.value ??= rememberedUser();
  }
  error.value = cause instanceof Error ? cause.message : 'Не удалось проверить вход';
}
function initialize(force = false): Promise<void> {
  attachEvents();
  if (initialization) return initialization;
  if (ready.value && !force) return Promise.resolve();
  const epoch = generation;
  const pending = (async () => {
    try {
      logoutPending.value = localStorage.getItem(logoutKey) !== null;
      if (logoutPending.value) return;
      if (!navigator.onLine) {
        user.value ??= rememberedUser();
        offline.value = true;
        verificationPending.value = false;
        return;
      }
      await withNetworkDeadline(async (signal) => {
        const response = await raw('/v1/auth/session', { signal });
        if (epoch !== generation) return;
        if (response.status === 401) await recover(epoch, signal);
        else if (!response.ok) failedResponse(response);
        else {
          const data = checkData(await response.json());
          if (epoch !== generation) return;
          if (data.refreshEnabled === false) await recover(epoch, signal);
          else await accept(data, epoch);
        }
      });
    } catch (cause) {
      if (epoch === generation) {
        // Cached identity permits reading, but cannot authorize writes before verification.
        if (!user.value) {
          user.value = rememberedUser();
        }
        networkFailure(cause);
        if (!csrfToken) verificationPending.value = !!user.value && !offline.value;
      }
    }
  })();
  initialization = pending;
  void pending.finally(() => {
    if (initialization === pending) {
      ready.value = true;
      initialization = undefined;
    }
  });
  return pending;
}
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const epoch = generation,
    identity = user.value?.id,
    revision = credentialRevision;
  let response: Response;
  try {
    response = await raw(path, options);
  } catch (cause) {
    if (epoch === generation) networkFailure(cause);
    throw cause;
  }
  if (epoch !== generation) return response; // caller's context guards discard late results
  if (response.status !== 401) return response;
  if (logoutPending.value || reauthRequired.value) return response;
  try {
    const restored =
      (revision !== credentialRevision && !localOnly.value) || (await recover(epoch));
    if (!restored || epoch !== generation || identity !== user.value?.id) return response;
    // Current API uses strings/FormData/Blobs, all reusable. Streams cannot be retried.
    if (options.body instanceof ReadableStream) return response;
    const retried = await raw(path, options);
    if (epoch === generation && retried.status === 401) expire();
    return retried;
  } catch (cause) {
    if (epoch === generation) networkFailure(cause);
    throw cause;
  }
}
function login(returnTo: unknown): void {
  if (logoutPending.value || localStorage.getItem(logoutKey)) {
    error.value = 'Сначала завершите выход при подключении к интернету.';
    return;
  }
  window.location.assign(
    `${apiBaseUrl}/v1/auth/yandex/start?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`,
  );
}
async function logout(): Promise<void> {
  const retry = localStorage.getItem(logoutKey);
  const expectedUser = retry ?? user.value?.id;
  let options = sessionOptions({ method: 'POST' });
  localStorage.setItem(logoutKey, expectedUser ?? '');
  logoutPending.value = true;
  reset();
  const cleanup = purge();
  void cleanup.catch(() => undefined);
  try {
    // Wait for this tab's in-flight refresh, even on browsers without Web Locks.
    await refreshPending?.catch(() => undefined);
    await withLock(async () => {
      if (retry !== null || !new Headers(options.headers).has('x-csrf-token')) {
        let response = await raw('/v1/auth/session');
        if (response.status === 401) response = await raw('/v1/auth/refresh-context');
        if (response.status === 401) {
          localStorage.removeItem(logoutKey);
          logoutPending.value = false;
          return;
        }
        if (!response.ok) failedResponse(response);
        const current = checkData(await response.json());
        if (expectedUser && current.user.id !== expectedUser) {
          localStorage.removeItem(logoutKey);
          logoutPending.value = false;
          throw new Error('Сессия изменилась. Войдите с нужным аккаунтом и повторите выход.');
        }
        options = { ...options, headers: { 'X-CSRF-Token': current.csrfToken } };
      }
      const response = await fetch(`${apiBaseUrl}/v1/auth/logout`, options);
      if (!response.ok && response.status !== 401)
        throw new Error('Не удалось завершить сессию на сервере. Повторите выход при подключении.');
      localStorage.removeItem(logoutKey);
      logoutPending.value = false;
    });
  } finally {
    await cleanup;
  }
}
export function useAuthSession() {
  attachEvents();
  return {
    user,
    ready,
    offline,
    verificationPending,
    reauthRequired,
    localOnly,
    accessDenied,
    logoutPending,
    error,
    initialize,
    login,
    logout,
    invalidate,
    authFetch,
  };
}
