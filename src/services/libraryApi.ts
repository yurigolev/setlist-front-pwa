import type { Attachment, NewSong, Song, SongTag } from '@/domain/song';
import { isTagColor } from '@/domain/tagColor';
import { isTagName, normalizeTagName } from '@/domain/tagName';
import { apiBaseUrl, authFetch, sessionVersion } from './sessionTransport';
export { apiBaseUrl } from './sessionTransport';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly currentRevision?: number,
  ) {
    super(message);
  }
}
export class UnknownResultError extends Error {
  constructor(readonly cause: unknown) {
    super('Результат запроса неизвестен. Обновите библиотеку перед повтором.');
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Некорректный ответ сервера');
  return value as Record<string, unknown>;
}
export function serverSong(value: unknown): Song {
  const data = object(value);
  if (
    typeof data.id !== 'string' ||
    !uuid.test(data.id) ||
    typeof data.title !== 'string' ||
    typeof data.artist !== 'string' ||
    typeof data.notes !== 'string' ||
    !Number.isInteger(data.revision) ||
    Number(data.revision) < 1 ||
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string'
  )
    throw new Error('Некорректная песня в ответе сервера');
  return {
    setlistId: typeof data.setlistId === 'string' ? data.setlistId : undefined,
    id: data.id,
    title: data.title,
    artist: data.artist,
    content: data.notes,
    revision: Number(data.revision),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    tagIds: serverTagIds(data.tagIds),
    attachments: Array.isArray(data.attachments) ? data.attachments.map(serverAttachment) : [],
  };
}
function serverTagIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !uuid.test(id)))
    throw new Error('Некорректные теги песни');
  return [...new Set(value as string[])];
}
export function serverTag(value: unknown): SongTag {
  const data = object(value);
  if (
    typeof data.id !== 'string' ||
    !uuid.test(data.id) ||
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    (data.color !== undefined && data.color !== null && !isTagColor(data.color))
  )
    throw new Error('Некорректный тег');
  return {
    id: data.id,
    name: data.name,
    ...(data.color !== undefined
      ? { color: data.color === null ? null : String(data.color).toUpperCase() }
      : {}),
  };
}
function serverAttachment(value: unknown): Attachment {
  const data = object(value);
  if (
    typeof data.id !== 'string' ||
    !uuid.test(data.id) ||
    typeof data.songId !== 'string' ||
    !uuid.test(data.songId) ||
    !['image', 'audio'].includes(String(data.kind)) ||
    typeof data.filename !== 'string' ||
    typeof data.mimeType !== 'string' ||
    !Number.isInteger(data.byteSize) ||
    Number(data.byteSize) < 1 ||
    typeof data.checksum !== 'string' ||
    !/^[0-9a-f]{64}$/.test(data.checksum) ||
    typeof data.contentUrl !== 'string' ||
    typeof data.createdAt !== 'string'
  )
    throw new Error('Некорректное вложение в ответе сервера');
  return {
    setlistId: typeof data.setlistId === 'string' ? data.setlistId : undefined,
    id: data.id,
    songId: data.songId,
    kind: data.kind as Attachment['kind'],
    name: data.filename,
    mimeType: data.mimeType,
    fileKey: `server:${data.id}:${data.checksum}`,
    byteSize: Number(data.byteSize),
    checksum: data.checksum,
    contentUrl: data.contentUrl,
    createdAt: data.createdAt,
  };
}
export interface LibrarySnapshot {
  libraryId: string;
  libraryRevision: number;
  role?: 'owner' | 'editor' | 'viewer';
  songs: Song[];
  tags?: SongTag[];
}
export async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const version = sessionVersion();
  let response: Response;
  try {
    response = await authFetch(path, options);
  } catch (cause) {
    throw new UnknownResultError(cause);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (
      response.status === 403 &&
      data.code === 'LEGACY_OWNER_REQUIRED' &&
      version === sessionVersion()
    )
      window.dispatchEvent(new Event('setlist-access-denied'));
    throw new ApiError(
      data.code === 'TAG_NAME_CONFLICT'
        ? 'Тег с таким названием уже существует.'
        : data.code === 'TAG_NOT_FOUND'
          ? 'Тег уже удалён. Обновите библиотеку.'
          : data.code === 'INVALID_TAG_IDS'
            ? 'Теги изменились. Обновите библиотеку и выберите их снова.'
            : typeof data.message === 'string'
              ? data.message
              : `Ошибка сервера ${response.status}`,
      response.status,
      typeof data.code === 'string' ? data.code : undefined,
      typeof data.currentRevision === 'number' ? data.currentRevision : undefined,
    );
  }
  return response;
}
export async function json(path: string, options?: RequestInit): Promise<unknown> {
  return (await request(path, options)).json();
}
function songInput(song: NewSong): {
  title: string;
  artist: string;
  notes: string;
  tagIds?: string[];
} {
  const title = song.title.trim(),
    artist = song.artist?.trim() ?? '';
  if (!title || !artist) throw new Error('Укажите название и исполнителя.');
  return {
    title,
    artist,
    notes: song.content ?? '',
    ...(song.tagIds !== undefined ? { tagIds: serverTagIds(song.tagIds) } : {}),
  };
}
function scope(id: string): string {
  if (!uuid.test(id)) throw new Error('Выберите сет-лист');
  return `/v1/setlists/${id}`;
}
export async function fetchSnapshot(setlistId: string): Promise<LibrarySnapshot> {
  const data = object(await json(`${scope(setlistId)}/snapshot`));
  if (
    data.setlistId !== setlistId ||
    !Number.isInteger(data.setlistRevision) ||
    Number(data.setlistRevision) < 0 ||
    !['owner', 'editor', 'viewer'].includes(String(data.role)) ||
    !Array.isArray(data.songs)
  )
    throw new Error('Некорректный снимок библиотеки');
  const songs = data.songs.map(serverSong);
  if (data.tags !== undefined && !Array.isArray(data.tags))
    throw new Error('Некорректные теги снимка');
  const tags = ((data.tags ?? []) as unknown[]).map(serverTag);
  if (
    new Set(tags.map((tag) => tag.id)).size !== tags.length ||
    songs.some((song) => song.tagIds?.some((id) => !tags.some((tag) => tag.id === id)))
  )
    throw new Error('Некорректные связи тегов снимка');
  if (
    songs.some(
      (song) =>
        song.setlistId !== setlistId ||
        song.attachments.some((file) => file.setlistId !== setlistId || file.songId !== song.id),
    )
  )
    throw new Error('Некорректный контекст песни');
  return {
    libraryId: setlistId,
    libraryRevision: Number(data.setlistRevision),
    role: data.role as 'owner' | 'editor' | 'viewer',
    songs,
    tags,
  };
}
export async function createSong(input: NewSong, key: string, setlistId: string): Promise<Song> {
  return serverSong(
    await json(`${scope(setlistId)}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(songInput(input)),
    }),
  );
}
export async function patchSong(song: Song, setlistId: string): Promise<Song> {
  return serverSong(
    await json(`${scope(setlistId)}/songs/${song.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': String(song.revision) },
      body: JSON.stringify(songInput(song)),
    }),
  );
}
export async function deleteSong(song: Song, setlistId: string): Promise<void> {
  await request(`${scope(setlistId)}/songs/${song.id}`, {
    method: 'DELETE',
    headers: { 'If-Match': String(song.revision) },
  });
}
export async function uploadAttachment(
  song: Song,
  file: File,
  id: string,
  revision = song.revision,
  setlistId: string,
): Promise<Attachment> {
  const form = new FormData();
  form.set('file', file.type ? file : new File([file], file.name, { type: 'audio/mpeg' }));
  return serverAttachment(
    await json(`${scope(setlistId)}/songs/${song.id}/attachments`, {
      method: 'POST',
      headers: { 'If-Match': String(revision), 'X-Attachment-Id': id },
      body: form,
    }),
  );
}
export async function deleteAttachment(
  id: string,
  setlistId: string,
  revision?: number,
): Promise<void> {
  await request(`${scope(setlistId)}/attachments/${id}`, {
    method: 'DELETE',
    headers: { 'If-Match': String(revision) },
  });
}
export async function copySong(
  song: Song,
  sourceId: string,
  targetSetlistId: string,
): Promise<Song> {
  return serverSong(
    await json(`${scope(sourceId)}/songs/${song.id}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetSetlistId }),
    }),
  );
}
export async function downloadAttachment(attachment: Attachment): Promise<Blob> {
  const url = new URL(attachment.contentUrl!, `${apiBaseUrl || location.origin}/`);
  const base = new URL(apiBaseUrl || location.origin);
  if (
    !attachment.setlistId ||
    url.origin !== base.origin ||
    url.pathname !== `${scope(attachment.setlistId)}/attachments/${attachment.id}/content` ||
    url.search ||
    url.hash
  )
    throw new Error('Некорректный адрес вложения');
  return (await request(url.pathname)).blob();
}

export async function checkAttachment(file: File): Promise<void> {
  const kind =
    file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
      ? 'image'
      : file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')
        ? 'audio'
        : undefined;
  if (!kind) throw new Error('Поддерживаются PNG, JPEG, WebP и MP3.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const isMp3 =
    bytes.length >= 3 &&
    (String.fromCharCode(...bytes.slice(0, 3)) === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (!(kind === 'image' ? isPng || isJpeg || isWebp : isMp3))
    throw new Error(`Файл «${file.name}» не соответствует формату содержимого.`);
}

function tagInput(name: string, color?: string | null): { name: string; color?: string | null } {
  const normalized = normalizeTagName(name);
  if (!isTagName(normalized))
    throw new Error('Название тега должно содержать от 1 до 40 символов.');
  if (color !== undefined && color !== null && !isTagColor(color))
    throw new Error('Укажите цвет в формате #RRGGBB.');
  return {
    name: normalized,
    ...(color !== undefined ? { color: color?.toUpperCase() ?? null } : {}),
  };
}
export async function createTag(
  name: string,
  setlistId: string,
  color?: string | null,
): Promise<SongTag> {
  return serverTag(
    await json(`${scope(setlistId)}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagInput(name, color)),
    }),
  );
}
export async function updateTag(
  id: string,
  name: string,
  setlistId: string,
  color?: string | null,
): Promise<SongTag> {
  return serverTag(
    await json(`${scope(setlistId)}/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagInput(name, color)),
    }),
  );
}
export async function deleteTag(id: string, setlistId: string): Promise<void> {
  await request(`${scope(setlistId)}/tags/${id}`, { method: 'DELETE' });
}
