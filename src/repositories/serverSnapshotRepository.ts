import type { Song } from '@/domain/song'
import { openSetlistDatabase } from './database'
import { downloadAttachment, type LibrarySnapshot } from '@/services/libraryApi'
import { sha256Hex } from '@/services/checksum'

export interface SnapshotMeta { libraryId: string; libraryRevision: number; updatedAt: string; source: 'server'; complete: true }
export async function readSnapshot(): Promise<{ songs: Song[]; meta?: SnapshotMeta }> {
  const db = await openSetlistDatabase()
  try { return { songs: await db.getAll('serverSongs'), meta: await db.get('serverMeta', 'complete') as SnapshotMeta | undefined } }
  finally { db.close() }
}
export async function readServerFile(key: string): Promise<Blob | undefined> {
  const db = await openSetlistDatabase()
  try {
    const file = await db.get('serverFiles', key)
    return file instanceof Blob ? file : file ? new Blob([file.data], { type: file.mimeType }) : undefined
  } finally { db.close() }
}
async function verifiedBytes(blob: Blob, size: number, checksum: string): Promise<ArrayBuffer> {
  if (blob.size !== size) throw new Error('Размер файла не совпадает со снимком')
  const data = await blob.arrayBuffer()
  const hex = await sha256Hex(data)
  if (hex !== checksum) throw new Error('Контрольная сумма файла не совпадает со снимком')
  return data
}
export async function publishSnapshot(snapshot: LibrarySnapshot): Promise<SnapshotMeta> {
  const db = await openSetlistDatabase()
  const downloaded: string[] = []
  try {
    const needed = snapshot.songs.flatMap((song) => song.attachments)
    for (const attachment of needed) {
      if (await db.get('serverFiles', attachment.fileKey)) continue
      const blob = await downloadAttachment(attachment)
      const data = await verifiedBytes(blob, attachment.byteSize!, attachment.checksum!)
      await db.put('serverFiles', { data, mimeType: attachment.mimeType }, attachment.fileKey)
      downloaded.push(attachment.fileKey)
    }
    const meta: SnapshotMeta = { libraryId: snapshot.libraryId, libraryRevision: snapshot.libraryRevision, updatedAt: new Date().toISOString(), source: 'server', complete: true }
    const transaction = db.transaction(['serverSongs', 'serverFiles', 'serverMeta'], 'readwrite')
    void transaction.done.catch(() => undefined)
    try {
      await transaction.objectStore('serverSongs').clear()
      for (const song of snapshot.songs) await transaction.objectStore('serverSongs').put(song)
      const keep = new Set(needed.map((attachment) => attachment.fileKey))
      for (const key of await transaction.objectStore('serverFiles').getAllKeys()) if (!keep.has(key)) await transaction.objectStore('serverFiles').delete(key)
      await transaction.objectStore('serverMeta').put(meta, 'complete')
      await transaction.done
    } catch (error) {
      try { transaction.abort() } catch { /* транзакция уже прервана браузером */ }
      throw error
    }
    return meta
  } catch (error) {
    try {
      const transaction = db.transaction('serverFiles', 'readwrite')
      for (const key of downloaded) await transaction.store.delete(key)
      await transaction.done
    } catch { /* исходная ошибка публикации важнее ошибки очистки */ }
    throw error
  } finally { db.close() }
}
