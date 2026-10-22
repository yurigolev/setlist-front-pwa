import { useAuthStore } from './auth';
import { useSetlistsStore } from './setlists';
import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref, watch } from 'vue';
import type { NewSong, Song } from '@/domain/song';
import * as api from '@/services/libraryApi';
import { sessionVersion } from '@/composables/useAuthSession';
import { createUuid } from '@/services/uuid';
import { attachmentValidationMessage } from '@/services/attachments';
import {
  publishSnapshot,
  readSnapshot,
  readSnapshotMeta,
  type SnapshotMeta,
} from '@/repositories/serverSnapshotRepository';

export const useSongsStore = defineStore('songs', () => {
  const auth = useAuthStore(),
    setlists = useSetlistsStore();
  const songs = ref<Song[]>([]),
    isLoading = ref(false),
    isSyncing = ref(false),
    syncError = ref(''),
    meta = ref<SnapshotMeta>(),
    online = ref(navigator.onLine);
  const syncedAt = ref<Record<string, string>>({});
  const backgroundSyncs = new Map<string, Promise<void>>();
  const backgroundKey = (id: string) => `${sessionVersion()}:${auth.user?.id}:${id}`;
  let generation = 0,
    pending: Promise<void> | undefined;
  function reset(): void {
    generation++;
    pending = undefined;
    songs.value = [];
    meta.value = undefined;
    syncError.value = '';
    isLoading.value = false;
    isSyncing.value = false;
  }
  function resetSession(): void {
    reset();
    syncedAt.value = {};
  }
  window.addEventListener('setlist-session-reset', resetSession);
  onScopeDispose(() => window.removeEventListener('setlist-session-reset', resetSession));
  watch(() => auth.user?.id, resetSession, { flush: 'sync' });
  watch(
    () => auth.reauthRequired,
    (required) => {
      if (!required) return;
      generation++;
      pending = undefined;
      isLoading.value = false;
      isSyncing.value = false;
    },
    { flush: 'sync' },
  );
  watch(() => setlists.selectedId, reset, { flush: 'sync' });
  const updateOnline = () => {
    online.value = navigator.onLine;
    if (online.value) void retryConnection().catch(() => undefined);
  };
  async function retryConnection(): Promise<void> {
    await auth.initialize(true);
    if (auth.user && !auth.localOnly && !auth.accessDenied) {
      await setlists.initialize(true);
      await load();
    }
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  onScopeDispose(() => {
    window.removeEventListener('online', updateOnline);
    window.removeEventListener('offline', updateOnline);
  });
  const canWrite = computed(
    () =>
      Boolean(auth.user && setlists.current && setlists.current.role !== 'viewer') &&
      !auth.localOnly &&
      !auth.accessDenied &&
      online.value,
  );
  const cacheUserId = computed(() => auth.user?.id),
    cacheSetlistId = computed(() => setlists.selectedId);
  function context(write = false) {
    const userId = auth.user?.id,
      setlistId = setlists.selectedId,
      epoch = generation,
      sessionEpoch = sessionVersion();
    if (!userId || !setlistId) throw new Error('Выберите сет-лист');
    if (write && !canWrite.value)
      throw new Error('Нет права изменять песни. Требуются интернет и роль owner/editor.');
    return {
      userId,
      setlistId,
      valid: () =>
        epoch === generation &&
        sessionVersion() === sessionEpoch &&
        auth.user?.id === userId &&
        setlists.selectedId === setlistId,
    };
  }
  async function failure(c: ReturnType<typeof context>, cause: unknown): Promise<void> {
    if (!c.valid()) return;
    if (
      cause instanceof api.ApiError &&
      ((cause.status === 403 && cause.code === 'SETLIST_ACCESS_DENIED') ||
        (cause.status === 404 && cause.code === 'SETLIST_NOT_FOUND'))
    )
      await setlists.revokeScope(c.setlistId);
    if (c.valid() && cause instanceof api.ApiError && cause.code === 'SETLIST_ROLE_REQUIRED')
      await setlists.initialize(true).catch(() => undefined);
  }
  async function load(): Promise<void> {
    await setlists.initialize();
    if (!setlists.selectedId) {
      reset();
      return;
    }
    const c = context();
    isLoading.value = true;
    try {
      const local = await readSnapshot(c.userId, c.setlistId);
      if (!c.valid()) return;
      songs.value = local.songs;
      meta.value = local.meta;
    } finally {
      if (c.valid()) isLoading.value = false;
    }
    if (online.value && !auth.localOnly) await refresh().catch(() => undefined);
  }
  async function refreshRun(): Promise<void> {
    if (auth.localOnly) {
      await auth.initialize(true);
      if (!auth.localOnly) await setlists.initialize(true);
    }
    if (auth.localOnly)
      throw new Error(
        auth.reauthRequired
          ? 'Войдите через Telegram для синхронизации. Сохранённые песни доступны для просмотра.'
          : 'Не удалось проверить вход. Подключитесь к интернету.',
      );
    const c = context();
    isSyncing.value = true;
    syncError.value = '';
    try {
      const snapshot = await api.fetchSnapshot(c.setlistId);
      if (!c.valid()) return;
      const published = await publishSnapshot(snapshot, c.userId, c.valid, c.setlistId);
      const local = await readSnapshot(c.userId, c.setlistId);
      if (!c.valid()) return;
      meta.value = published;
      syncedAt.value[c.setlistId] = published.updatedAt;
      songs.value = local.songs;
      online.value = true;
      if (setlists.current && snapshot.role) {
        setlists.current.role = snapshot.role;
        setlists.current.revision = snapshot.libraryRevision;
      }
    } catch (cause) {
      if (!c.valid()) return;
      syncError.value = cause instanceof Error ? cause.message : 'Не удалось обновить сет-лист';
      if (cause instanceof api.UnknownResultError) online.value = false;
      await failure(c, cause);
      throw cause;
    } finally {
      if (c.valid()) isSyncing.value = false;
    }
  }
  function refresh(): Promise<void> {
    const background =
      setlists.selectedId && backgroundSyncs.get(backgroundKey(setlists.selectedId));
    if (background) return background.then(() => refresh());
    if (pending) return pending;
    const task = refreshRun();
    pending = task;
    void task
      .finally(() => {
        if (pending === task) pending = undefined;
      })
      .catch(() => undefined);
    return task;
  }
  async function loadSyncTimes(): Promise<void> {
    const userId = auth.user?.id,
      version = sessionVersion();
    if (!userId) return;
    for (const item of [...setlists.setlists]) {
      const cached = await readSnapshotMeta(userId, item.id);
      if (auth.user?.id !== userId || sessionVersion() !== version) return;
      if (
        cached &&
        setlists.setlists.some((list) => list.id === item.id) &&
        (!syncedAt.value[item.id] || cached.updatedAt > syncedAt.value[item.id]!)
      )
        syncedAt.value[item.id] = cached.updatedAt;
    }
  }
  function syncSetlist(id: string): Promise<void> {
    if (!auth.user || auth.localOnly || auth.accessDenied || !online.value)
      return Promise.reject(new Error('Для синхронизации требуется интернет и вход'));
    if (!setlists.setlists.some((item) => item.id === id))
      return Promise.reject(new Error('Нет доступа к сетлисту'));
    if (id === setlists.selectedId) {
      const c = context();
      return refresh().then(() => {
        if (!c.valid()) throw new Error('Контекст изменился');
      });
    }
    const key = backgroundKey(id);
    const existing = backgroundSyncs.get(key);
    if (existing) return existing;
    const userId = auth.user.id,
      version = sessionVersion();
    const valid = () =>
      auth.user?.id === userId &&
      sessionVersion() === version &&
      setlists.setlists.some((item) => item.id === id);
    const task = (async () => {
      try {
        const snapshot = await api.fetchSnapshot(id);
        if (!valid()) throw new Error('Контекст изменился');
        const published = await publishSnapshot(snapshot, userId, valid, id);
        if (!valid()) throw new Error('Контекст изменился');
        syncedAt.value[id] = published.updatedAt;
        const item = setlists.setlists.find((item) => item.id === id)!;
        item.revision = snapshot.libraryRevision;
        if (snapshot.role) item.role = snapshot.role;
      } catch (cause) {
        if (
          valid() &&
          cause instanceof api.ApiError &&
          ((cause.code === 'SETLIST_ACCESS_DENIED' && cause.status === 403) ||
            (cause.code === 'SETLIST_NOT_FOUND' && cause.status === 404))
        )
          await setlists.revokeScope(id);
        throw cause;
      }
    })();
    backgroundSyncs.set(key, task);
    void task
      .finally(() => {
        if (backgroundSyncs.get(key) === task) backgroundSyncs.delete(key);
      })
      .catch(() => undefined);
    return task;
  }
  function get(id: string): Promise<Song | undefined> {
    return Promise.resolve(songs.value.find((song) => song.id === id));
  }
  async function write<T>(work: (id: string) => Promise<T>, song?: Song): Promise<T> {
    const c = context(true);
    if (song && song.setlistId !== c.setlistId)
      throw new Error('Песня относится к другому сет-листу');
    try {
      const result = await work(c.setlistId);
      if (!c.valid()) throw new Error('Контекст изменился');
      // A refresh already in flight may precede this mutation. Wait, then fetch its result.
      if (pending) await pending.catch(() => undefined);
      if (!c.valid()) throw new Error('Контекст изменился');
      await refresh();
      if (!c.valid()) throw new Error('Контекст изменился');
      return result;
    } catch (cause) {
      await failure(c, cause);
      if (
        c.valid() &&
        (cause instanceof api.UnknownResultError ||
          (cause instanceof api.ApiError && cause.status === 409))
      )
        await refresh().catch(() => undefined);
      throw cause;
    }
  }
  async function create(input: NewSong, key = createUuid()): Promise<Song> {
    return write((id) => api.createSong(input, key, id));
  }
  async function update(song: Song): Promise<Song> {
    return write((id) => api.patchSong(song, id), song);
  }
  async function remove(song: Song): Promise<void> {
    await write((id) => api.deleteSong(song, id), song);
  }
  async function addAttachment(
    song: Song,
    file: File,
    id = createUuid(),
    revision = song.revision,
  ): Promise<Song> {
    const c = context(true),
      validation = attachmentValidationMessage(file);
    if (validation) throw new Error(validation);
    await api.checkAttachment(file);
    if (!c.valid()) throw new Error('Контекст изменился');
    await write((scope) => api.uploadAttachment(song, file, id, revision, scope), song);
    return (await get(song.id))!;
  }
  async function removeAttachment(song: Song, id: string): Promise<Song> {
    await write((scope) => api.deleteAttachment(id, scope, song.revision), song);
    return (await get(song.id))!;
  }
  async function copy(song: Song, targetSetlistId: string): Promise<Song> {
    const c = context();
    if (
      auth.localOnly ||
      auth.accessDenied ||
      !online.value ||
      song.setlistId !== c.setlistId ||
      targetSetlistId === c.setlistId ||
      !setlists.setlists.some((item) => item.id === targetSetlistId && item.role !== 'viewer')
    )
      throw new Error('Выберите другой доступный сет-лист с правом записи');
    try {
      const result = await api.copySong(song, c.setlistId, targetSetlistId);
      if (!c.valid()) throw new Error('Контекст изменился');
      return result;
    } catch (cause) {
      if (
        c.valid() &&
        cause instanceof api.ApiError &&
        [403, 404].includes(cause.status) &&
        cause.code !== 'CSRF_INVALID'
      )
        await setlists.initialize(true).catch(() => undefined);
      throw cause;
    }
  }
  return {
    canWrite,
    cacheUserId,
    cacheSetlistId,
    songs,
    isLoading,
    isSyncing,
    syncError,
    meta,
    online,
    load,
    retryConnection,
    refresh,
    syncSetlist,
    syncedAt,
    loadSyncTimes,
    get,
    create,
    update,
    remove,
    addAttachment,
    removeAttachment,
    copy,
  };
});
