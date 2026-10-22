import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { Attachment, Song } from '@/domain/song';

interface SetlistDatabase extends DBSchema {
  serverSongs: { key: string; value: Song };
  serverFiles: { key: string; value: Blob | { data: ArrayBuffer; mimeType: string } };
  temporaryFiles: { key: string; value: Blob };
  serverMeta: { key: string; value: unknown };
  songs: {
    key: string;
    value: Song;
  };
  files: {
    key: string;
    value: Blob;
  };
  attachments: {
    key: string;
    value: Attachment;
    indexes: { 'by-song': string };
  };
}

const databaseName = 'setlist-library';
const connections = new Set<IDBPDatabase<SetlistDatabase>>();
let cacheGeneration = 0;

export async function openSetlistDatabase(
  userId?: string,
  setlistId?: string,
): Promise<IDBPDatabase<SetlistDatabase>> {
  const generation = cacheGeneration;
  const name = userId
    ? `${databaseName}:user:${encodeURIComponent(userId)}${setlistId ? `:setlist:${encodeURIComponent(setlistId)}` : ''}`
    : databaseName;
  if (userId) {
    const names: string[] = JSON.parse(localStorage.getItem('setlist-private-databases') ?? '[]');
    if (!names.includes(name))
      localStorage.setItem('setlist-private-databases', JSON.stringify([...names, name]));
  }
  const db = await openDB<SetlistDatabase>(name, 2, {
    blocking(_currentVersion, _blockedVersion, event) {
      (event.target as IDBDatabase).close();
    },
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('songs', { keyPath: 'id' });
        database.createObjectStore('files');
        const attachments = database.createObjectStore('attachments', { keyPath: 'id' });
        attachments.createIndex('by-song', 'songId');
      }
      database.createObjectStore('serverSongs', { keyPath: 'id' });
      database.createObjectStore('serverFiles');
      database.createObjectStore('temporaryFiles');
      database.createObjectStore('serverMeta');
    },
  });
  if (generation !== cacheGeneration) {
    db.close();
    throw new Error('Сессия изменилась');
  }
  connections.add(db);
  const close = db.close.bind(db);
  db.close = () => {
    connections.delete(db);
    close();
  };
  return db;
}

export function closePrivateConnections(): void {
  cacheGeneration++;
  for (const db of connections) db.close();
  connections.clear();
}

export async function clearPrivateDatabases(userId?: string, setlistId?: string): Promise<void> {
  if (!userId) cacheGeneration++;
  const names: string[] = JSON.parse(localStorage.getItem('setlist-private-databases') ?? '[]');
  const targets = userId
    ? names.filter((name) =>
        setlistId
          ? name ===
            `${databaseName}:user:${encodeURIComponent(userId)}:setlist:${encodeURIComponent(setlistId)}`
          : name.startsWith(`${databaseName}:user:${encodeURIComponent(userId)}:`) ||
            name === `${databaseName}:user:${encodeURIComponent(userId)}`,
      )
    : [databaseName, ...names];
  for (const db of connections) if (targets.includes(db.name)) db.close();
  await Promise.all(
    targets.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () =>
            reject(new Error('Закройте другие вкладки Setlist, чтобы удалить личный офлайн-кэш.'));
        }),
    ),
  );
  const registeredNow: string[] = JSON.parse(
    localStorage.getItem('setlist-private-databases') ?? '[]',
  );
  const remaining = registeredNow.filter((name) => !targets.includes(name));
  if (remaining.length)
    localStorage.setItem('setlist-private-databases', JSON.stringify(remaining));
  else localStorage.removeItem('setlist-private-databases');
}

export async function reconcilePrivateScopes(
  userId: string,
  accessibleIds: string[],
  isCurrent: () => boolean,
): Promise<void> {
  const prefix = `${databaseName}:user:${encodeURIComponent(userId)}:setlist:`;
  const names: string[] = JSON.parse(localStorage.getItem('setlist-private-databases') ?? '[]');
  const missing = names
    .filter((name) => name.startsWith(prefix))
    .map((name) => decodeURIComponent(name.slice(prefix.length)))
    .filter((id) => !accessibleIds.includes(id));
  for (const id of missing) {
    if (!isCurrent()) return;
    await clearPrivateDatabases(userId, id);
  }
}
