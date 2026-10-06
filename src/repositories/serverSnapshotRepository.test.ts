import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSetlistDatabase } from './database'
import { publishSnapshot, readServerFile, readSnapshot } from './serverSnapshotRepository'
import * as api from '@/services/libraryApi'

const libraryId = '22222222-2222-4222-8222-222222222222'
const songId = '11111111-1111-4111-8111-111111111111'
const song = { id: songId, title: 'Подтверждена', artist: 'Автор', content: '', revision: 1, attachments: [], createdAt: '', updatedAt: '' }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); indexedDB.deleteDatabase('setlist-library') })
describe('снимок IndexedDB', () => {
  it('не смешивает старую локальную базу с серверным снимком', async () => {
    const db = await openSetlistDatabase()
    await db.put('songs', { ...song, title: 'Старая тестовая' }); db.close()
    expect((await readSnapshot()).songs).toEqual([])
    await publishSnapshot({ libraryId, libraryRevision: 1, songs: [song] })
    expect((await readSnapshot()).songs.map((item) => item.title)).toEqual(['Подтверждена'])
  })
  it('сохраняет предыдущую ревизию при ошибке загрузки файла', async () => {
    await publishSnapshot({ libraryId, libraryRevision: 1, songs: [song] })
    vi.spyOn(api, 'downloadAttachment').mockRejectedValue(new Error('Сеть недоступна'))
    const attachment = { id: '33333333-3333-4333-8333-333333333333', songId, kind: 'image' as const, name: 'a.png', mimeType: 'image/png', fileKey: 'server:33333333-3333-4333-8333-333333333333', byteSize: 5, checksum: 'a'.repeat(64), contentUrl: '/v1/attachments/33333333-3333-4333-8333-333333333333/content', createdAt: '' }
    await expect(publishSnapshot({ libraryId, libraryRevision: 2, songs: [{ ...song, attachments: [attachment] }] })).rejects.toThrow('Сеть недоступна')
    expect(await readSnapshot()).toMatchObject({ songs: [{ attachments: [] }], meta: { libraryRevision: 1, complete: true } })
  })
  it('сохраняет серверный файл в IndexedDB как байты и возвращает Blob для просмотра', async () => {
    vi.stubGlobal('crypto', {}) // Public HTTP origin: Web Crypto is unavailable.
    const attachment = { id: '33333333-3333-4333-8333-333333333333', songId, kind: 'image' as const, name: 'a.png', mimeType: 'image/png', fileKey: 'server:33333333-3333-4333-8333-333333333333:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', byteSize: 5, checksum: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', contentUrl: '/v1/attachments/33333333-3333-4333-8333-333333333333/content', createdAt: '' }
    vi.spyOn(api, 'downloadAttachment').mockResolvedValue(new Blob(['hello'], { type: 'image/png' }))
    await publishSnapshot({ libraryId, libraryRevision: 2, songs: [{ ...song, attachments: [attachment] }] })
    const db = await openSetlistDatabase()
    const stored = await db.get('serverFiles', attachment.fileKey)
    db.close()
    expect(stored).toMatchObject({ mimeType: 'image/png' })
    expect(stored).not.toBeInstanceOf(Blob)
    expect(await (await readServerFile(attachment.fileKey))?.text()).toBe('hello')
  })
  it('удаляет песни отсутствующие в новой публикации', async () => {
    await publishSnapshot({ libraryId, libraryRevision: 1, songs: [song] })
    await publishSnapshot({ libraryId, libraryRevision: 2, songs: [] })
    expect(await readSnapshot()).toMatchObject({ songs: [], meta: { libraryRevision: 2 } })
  })
  it('отклоняет повреждённый файл на HTTP и сохраняет предыдущий снимок', async () => {
    await publishSnapshot({ libraryId, libraryRevision: 1, songs: [song] })
    vi.stubGlobal('crypto', {})
    const attachment = { id: '33333333-3333-4333-8333-333333333333', songId, kind: 'image' as const, name: 'a.png', mimeType: 'image/png', fileKey: 'server:corrupt-file', byteSize: 5, checksum: 'a'.repeat(64), contentUrl: '/v1/attachments/33333333-3333-4333-8333-333333333333/content', createdAt: '' }
    vi.spyOn(api, 'downloadAttachment').mockResolvedValue(new Blob(['hello'], { type: 'image/png' }))
    await expect(publishSnapshot({ libraryId, libraryRevision: 2, songs: [{ ...song, attachments: [attachment] }] })).rejects.toThrow('Контрольная сумма файла не совпадает со снимком')
    expect(await readSnapshot()).toMatchObject({ songs: [{ attachments: [] }], meta: { libraryRevision: 1 } })
    expect(await readServerFile(attachment.fileKey)).toBeUndefined()
  })
  it('откатывает публикацию при ошибке квоты IndexedDB', async () => {
    await publishSnapshot({ libraryId, libraryRevision: 1, songs: [song] })
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === 'serverSongs' && value.title === 'Новая версия') throw new DOMException('Недостаточно места', 'QuotaExceededError')
      return originalPut.call(this, value, key)
    })
    await expect(publishSnapshot({ libraryId, libraryRevision: 2, songs: [{ ...song, title: 'Новая версия' }] })).rejects.toThrow('Недостаточно места')
    vi.restoreAllMocks()
    expect(await readSnapshot()).toMatchObject({ songs: [{ title: 'Подтверждена' }], meta: { libraryRevision: 1 } })
  })
})
