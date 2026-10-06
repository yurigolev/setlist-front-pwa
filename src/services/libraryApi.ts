import type { Attachment, NewSong, Song } from '@/domain/song'

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly currentRevision?: number) { super(message) }
}
export class UnknownResultError extends Error {
  constructor(readonly cause: unknown) { super('Результат запроса неизвестен. Обновите библиотеку перед повтором.') }
}

const configuredUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
export const apiBaseUrl = configuredUrl?.replace(/\/+$/, '') ?? ''
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ сервера')
  return value as Record<string, unknown>
}
function serverSong(value: unknown): Song {
  const data = object(value)
  if (typeof data.id !== 'string' || !uuid.test(data.id) || typeof data.title !== 'string' || typeof data.artist !== 'string' || typeof data.notes !== 'string' || !Number.isInteger(data.revision) || Number(data.revision) < 1 || typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') throw new Error('Некорректная песня в ответе сервера')
  return { id: data.id, title: data.title, artist: data.artist, content: data.notes, revision: Number(data.revision), createdAt: data.createdAt, updatedAt: data.updatedAt, attachments: Array.isArray(data.attachments) ? data.attachments.map(serverAttachment) : [] }
}
function serverAttachment(value: unknown): Attachment {
  const data = object(value)
  if (typeof data.id !== 'string' || !uuid.test(data.id) || typeof data.songId !== 'string' || !uuid.test(data.songId) || !['image', 'audio'].includes(String(data.kind)) || typeof data.filename !== 'string' || typeof data.mimeType !== 'string' || !Number.isInteger(data.byteSize) || Number(data.byteSize) < 1 || typeof data.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(data.checksum) || typeof data.contentUrl !== 'string' || typeof data.createdAt !== 'string') throw new Error('Некорректное вложение в ответе сервера')
  return { id: data.id, songId: data.songId, kind: data.kind as Attachment['kind'], name: data.filename, mimeType: data.mimeType, fileKey: `server:${data.id}:${data.checksum}`, byteSize: Number(data.byteSize), checksum: data.checksum, contentUrl: data.contentUrl, createdAt: data.createdAt }
}
export interface LibrarySnapshot { libraryId: string; libraryRevision: number; songs: Song[] }
async function request(path: string, options: RequestInit = {}): Promise<Response> {
  let response: Response
  try { response = await fetch(`${apiBaseUrl}${path}`, { ...options, cache: 'no-store' }) }
  catch (cause) { throw new UnknownResultError(cause) }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new ApiError(typeof data.message === 'string' ? data.message : `Ошибка сервера ${response.status}`, response.status, typeof data.code === 'string' ? data.code : undefined, typeof data.currentRevision === 'number' ? data.currentRevision : undefined)
  }
  return response
}
async function json(path: string, options?: RequestInit): Promise<unknown> { return (await request(path, options)).json() }
function songInput(song: NewSong): { title: string; artist: string; notes: string } {
  const title = song.title.trim(), artist = song.artist?.trim() ?? ''
  if (!title || !artist) throw new Error('Укажите название и исполнителя.')
  return { title, artist, notes: song.content ?? '' }
}
export async function fetchSnapshot(): Promise<LibrarySnapshot> {
  const data = object(await json('/v1/library/snapshot'))
  if (typeof data.libraryId !== 'string' || !uuid.test(data.libraryId) || !Number.isInteger(data.libraryRevision) || Number(data.libraryRevision) < 0 || !Array.isArray(data.songs)) throw new Error('Некорректный снимок библиотеки')
  return { libraryId: data.libraryId, libraryRevision: Number(data.libraryRevision), songs: data.songs.map(serverSong) }
}
export async function createSong(input: NewSong, key: string): Promise<Song> { return serverSong(await json('/v1/songs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(songInput(input)) })) }
export async function patchSong(song: Song): Promise<Song> { return serverSong(await json(`/v1/songs/${song.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': String(song.revision) }, body: JSON.stringify(songInput(song)) })) }
export async function deleteSong(song: Song): Promise<void> { await request(`/v1/songs/${song.id}`, { method: 'DELETE', headers: { 'If-Match': String(song.revision) } }) }
export async function uploadAttachment(song: Song, file: File, id: string, revision = song.revision): Promise<Attachment> {
  const form = new FormData(); form.set('file', file.type ? file : new File([file], file.name, { type: 'audio/mpeg' }))
  return serverAttachment(await json(`/v1/songs/${song.id}/attachments`, { method: 'POST', headers: { 'If-Match': String(revision), 'X-Attachment-Id': id }, body: form }))
}
export async function deleteAttachment(id: string): Promise<void> { await request(`/v1/attachments/${id}`, { method: 'DELETE' }) }
export async function downloadAttachment(attachment: Attachment): Promise<Blob> {
  const url = new URL(attachment.contentUrl!, `${apiBaseUrl || location.origin}/`)
  const base = new URL(apiBaseUrl || location.origin)
  if (url.origin !== base.origin || !url.pathname.startsWith('/v1/attachments/')) throw new Error('Некорректный адрес вложения')
  return (await request(url.pathname + url.search)).blob()
}

export async function checkAttachment(file: File): Promise<void> {
  const kind = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
    ? 'image'
    : file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3') ? 'audio' : undefined
  if (!kind) throw new Error('Поддерживаются PNG, JPEG, WebP и MP3.')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  const isMp3 = bytes.length >= 3 && (String.fromCharCode(...bytes.slice(0, 3)) === 'ID3' || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  if (!(kind === 'image' ? isPng || isJpeg || isWebp : isMp3)) throw new Error(`Файл «${file.name}» не соответствует формату содержимого.`)
}
