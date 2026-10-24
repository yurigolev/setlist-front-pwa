import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore, type SessionUser } from './auth';
import { sessionVersion } from '@/composables/useAuthSession';
import { ApiError, UnknownResultError, json, request } from '@/services/libraryApi';
import { withNetworkDeadline } from '@/services/networkDeadline';
import {
  clearPrivateDatabases,
  closePrivateConnections,
  reconcilePrivateScopes,
} from '@/repositories/database';
export type Role = 'owner' | 'editor' | 'viewer';
export interface Setlist {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
  role: Role;
}
export interface Member {
  user: SessionUser;
  role: Role;
  createdAt: string;
}
export interface Invitation {
  id: string;
  role: 'editor' | 'viewer';
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  usedAt: string | null;
}
export const useSetlistsStore = defineStore('setlists', () => {
  const auth = useAuthStore();
  const setlists = ref<Setlist[]>([]),
    selectedId = ref<string>(),
    ready = ref(false),
    loading = ref(false),
    error = ref(''),
    online = ref(navigator.onLine);
  const current = computed(() => setlists.value.find((item) => item.id === selectedId.value));
  const canManage = computed(
    () => current.value?.role === 'owner' && !auth.localOnly && !auth.accessDenied && online.value,
  );
  const updateOnline = () => {
    online.value = navigator.onLine;
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  onScopeDispose(() => {
    window.removeEventListener('online', updateOnline);
    window.removeEventListener('offline', updateOnline);
  });
  let selectionVersion = 0;
  let generation = 0;
  let initializationVersion = 0;
  const key = () => `setlist-selection:${auth.user?.id}`;
  function rememberSelection(): void {
    if (!auth.user) return;
    if (!setlists.value.length) {
      localStorage.removeItem(key());
      return;
    }
    localStorage.setItem(
      key(),
      JSON.stringify({
        id: selectedId.value,
        setlist: current.value,
        setlists: setlists.value,
      }),
    );
  }
  function savedSelection(): { id?: string; setlists: Setlist[] } {
    try {
      const saved = JSON.parse(localStorage.getItem(key()) ?? 'null');
      // Keep the previous single-setlist format readable after an update.
      const items = saved?.setlists ?? (saved?.setlist ? [saved.setlist] : []);
      return {
        id: typeof saved?.id === 'string' ? saved.id : undefined,
        setlists: Array.isArray(items)
          ? items.filter(
              (item): item is Setlist =>
                item &&
                typeof item.id === 'string' &&
                typeof item.title === 'string' &&
                ['owner', 'editor', 'viewer'].includes(item.role) &&
                Number.isInteger(item.revision),
            )
          : [],
      };
    } catch {
      return { setlists: [] };
    }
  }
  function restoreSelection(): boolean {
    const saved = savedSelection();
    if (!setlists.value.length) setlists.value = saved.setlists;
    const id =
      setlists.value.find((item) => item.id === selectedId.value)?.id ??
      setlists.value.find((item) => item.id === saved.id)?.id ??
      setlists.value[0]?.id;
    if (id) select(id);
    return Boolean(id);
  }
  function reset(): void {
    generation++;
    selectedId.value = undefined;
    setlists.value = [];
    ready.value = false;
    loading.value = false;
    error.value = '';
    closePrivateConnections();
  }
  watch(() => auth.user?.id, reset, { flush: 'sync' });
  watch(
    () => auth.reauthRequired,
    (required) => {
      if (!required) return;
      generation++;
      initializationVersion++;
      loading.value = false;
    },
    { flush: 'sync' },
  );
  window.addEventListener('setlist-session-reset', reset);
  onScopeDispose(() => window.removeEventListener('setlist-session-reset', reset));
  function select(id: string): void {
    if (id === selectedId.value) {
      rememberSelection();
      return;
    }
    if (!setlists.value.some((item) => item.id === id)) throw new Error('Нет доступа к сет-листу');
    selectionVersion++;
    closePrivateConnections();
    selectedId.value = id;
    rememberSelection();
  }
  async function initialize(force = false): Promise<void> {
    if (ready.value && !force) return;
    const userId = auth.user?.id,
      epoch = generation,
      sessionEpoch = sessionVersion();
    if (!userId) return;
    const requestVersion = ++initializationVersion;
    const valid = () =>
      auth.user?.id === userId &&
      epoch === generation &&
      sessionVersion() === sessionEpoch &&
      requestVersion === initializationVersion;
    loading.value = true;
    error.value = '';
    try {
      if (auth.localOnly) {
        if (valid()) restoreSelection();
      } else {
        const data = (await withNetworkDeadline((signal) => json('/v1/setlists', { signal }))) as {
          setlists: Setlist[];
        };
        if (!valid()) return;
        if (!Array.isArray(data.setlists)) throw new Error('Некорректный ответ сервера');
        if (selectedId.value && !data.setlists.some((item) => item.id === selectedId.value)) {
          selectionVersion++;
          closePrivateConnections();
          selectedId.value = undefined;
        }
        await reconcilePrivateScopes(
          userId,
          data.setlists.map((item) => item.id),
          valid,
        );
        if (!valid()) return;
        setlists.value = data.setlists;
        const saved = savedSelection();
        const id =
          setlists.value.find((item) => item.id === selectedId.value)?.id ??
          setlists.value.find((item) => item.id === saved?.id)?.id ??
          setlists.value[0]?.id;
        if (id) select(id);
        else {
          selectedId.value = undefined;
          localStorage.removeItem(key());
        }
      }
      if (valid()) ready.value = true;
    } catch (cause) {
      if (valid() && cause instanceof UnknownResultError && auth.localOnly && restoreSelection()) {
        ready.value = true;
        return;
      }
      if (valid())
        error.value = cause instanceof Error ? cause.message : 'Не удалось открыть сет-листы';
      throw cause;
    } finally {
      if (valid()) loading.value = false;
    }
  }
  function capture(manage = false) {
    const userId = auth.user?.id,
      id = selectedId.value,
      epoch = generation,
      scopeEpoch = selectionVersion,
      sessionEpoch = sessionVersion();
    if (
      !userId ||
      auth.localOnly ||
      auth.accessDenied ||
      !online.value ||
      !id ||
      (manage && !canManage.value)
    )
      throw new Error('Нет права изменять сет-лист');
    return {
      id,
      revision: current.value!.revision,
      valid: () =>
        epoch === generation &&
        sessionVersion() === sessionEpoch &&
        scopeEpoch === selectionVersion &&
        userId === auth.user?.id &&
        id === selectedId.value,
    };
  }
  async function operation<T>(work: () => Promise<T>, valid: () => boolean): Promise<T> {
    try {
      const result = await work();
      if (!valid()) throw new Error('Контекст изменился');
      return result;
    } catch (cause) {
      if (
        valid() &&
        cause instanceof ApiError &&
        ((cause.status === 403 && cause.code === 'SETLIST_ACCESS_DENIED') ||
          (cause.status === 404 && cause.code === 'SETLIST_NOT_FOUND'))
      )
        await revokeScope(selectedId.value!);
      if (valid() && cause instanceof ApiError && cause.code === 'SETLIST_ROLE_REQUIRED')
        await initialize(true).catch(() => undefined);
      throw cause;
    }
  }
  async function revokeScope(id: string, broadcast = true): Promise<void> {
    const userId = auth.user?.id;
    if (!userId) return;
    initializationVersion++;
    loading.value = false;
    if (broadcast)
      localStorage.setItem(
        'setlist-scope-revoked',
        JSON.stringify({ userId, setlistId: id, nonce: Math.random(), time: Date.now() }),
      );
    if (selectedId.value === id) {
      selectionVersion++;
      closePrivateConnections();
      selectedId.value = undefined;
      localStorage.removeItem(key());
    }
    setlists.value = setlists.value.filter((item) => item.id !== id);
    rememberSelection();
    await clearPrivateDatabases(userId, id);
  }
  function recheckOnFocus(): void {
    if (!auth.user || !navigator.onLine) return;
    void (async () => {
      await auth.initialize(true);
      if (auth.user && !auth.localOnly) await initialize(true);
    })().catch(() => undefined);
  }
  window.addEventListener('focus', recheckOnFocus);
  onScopeDispose(() => window.removeEventListener('focus', recheckOnFocus));
  function otherTabRevoked(event: StorageEvent): void {
    if (event.key !== 'setlist-scope-revoked') return;
    try {
      const data = JSON.parse(event.newValue ?? 'null');
      if (data?.userId === auth.user?.id && typeof data.setlistId === 'string')
        void revokeScope(data.setlistId, false).catch(() => undefined);
    } catch {
      /* Ignore malformed cross-tab messages. */
    }
  }
  window.addEventListener('storage', otherTabRevoked);
  onScopeDispose(() => window.removeEventListener('storage', otherTabRevoked));
  async function create(title: string): Promise<Setlist> {
    if (!auth.user || auth.localOnly || auth.accessDenied || !online.value)
      throw new Error('Для создания требуется интернет и вход');
    const epoch = generation,
      userId = auth.user.id,
      sessionEpoch = sessionVersion();
    const item = (await json('/v1/setlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })) as Setlist;
    if (epoch !== generation || sessionVersion() !== sessionEpoch || userId !== auth.user?.id)
      throw new Error('Контекст изменился');
    setlists.value.push(item);
    ready.value = true;
    select(item.id);
    return item;
  }
  async function rename(title: string): Promise<void> {
    const c = capture(true);
    const item = await operation(
      () =>
        json(`/v1/setlists/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'If-Match': String(c.revision) },
          body: JSON.stringify({ title }),
        }) as Promise<Setlist>,
      c.valid,
    );
    setlists.value = setlists.value.map((s) => (s.id === item.id ? item : s));
    rememberSelection();
  }
  async function remove(): Promise<void> {
    const c = capture(true);
    await operation(
      () =>
        request(`/v1/setlists/${c.id}`, {
          method: 'DELETE',
          headers: { 'If-Match': String(c.revision) },
        }),
      c.valid,
    );
    await revokeScope(c.id);
    await initialize(true);
  }
  async function members(): Promise<Member[]> {
    const c = capture(true);
    return (
      await operation(
        () => json(`/v1/setlists/${c.id}/members`) as Promise<{ members: Member[] }>,
        c.valid,
      )
    ).members;
  }
  async function changeRole(userId: string, role: Role): Promise<void> {
    const c = capture(true);
    await operation(
      () =>
        request(`/v1/setlists/${c.id}/members/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }),
      c.valid,
    );
    await initialize(true);
  }
  async function removeMember(userId: string): Promise<void> {
    const c = capture(true);
    await operation(
      () => request(`/v1/setlists/${c.id}/members/${userId}`, { method: 'DELETE' }),
      c.valid,
    );
    await initialize(true);
  }
  async function invitations(): Promise<Invitation[]> {
    const c = capture(true);
    return (
      await operation(
        () => json(`/v1/setlists/${c.id}/invitations`) as Promise<{ invitations: Invitation[] }>,
        c.valid,
      )
    ).invitations;
  }
  async function invite(
    role: 'editor' | 'viewer',
  ): Promise<{ invitation: Invitation; token: string }> {
    const c = capture(true);
    return operation(
      () =>
        json(`/v1/setlists/${c.id}/invitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }) as Promise<{ invitation: Invitation; token: string }>,
      c.valid,
    );
  }
  async function revoke(id: string): Promise<void> {
    const c = capture(true);
    await operation(
      () => request(`/v1/setlists/${c.id}/invitations/${id}`, { method: 'DELETE' }),
      c.valid,
    );
  }
  async function accept(token: string): Promise<Setlist> {
    const epoch = generation,
      userId = auth.user?.id,
      sessionEpoch = sessionVersion();
    if (!userId || auth.localOnly || auth.accessDenied || !online.value)
      throw new Error('Войдите при подключении к интернету');
    const data = (await json('/v1/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })) as { setlist: Setlist };
    if (epoch !== generation || sessionVersion() !== sessionEpoch || userId !== auth.user?.id)
      throw new Error('Контекст изменился');
    await initialize(true);
    select(data.setlist.id);
    return data.setlist;
  }
  return {
    setlists,
    selectedId,
    current,
    ready,
    loading,
    error,
    canManage,
    initialize,
    select,
    create,
    rename,
    remove,
    members,
    changeRole,
    removeMember,
    invitations,
    invite,
    revoke,
    accept,
    revokeScope,
  };
});
