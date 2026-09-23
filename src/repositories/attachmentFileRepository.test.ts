import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { IndexedDbAttachmentFileRepository } from './attachmentFileRepository'

afterEach(() => {
  indexedDB.deleteDatabase('setlist-library')
})

describe('IndexedDbAttachmentFileRepository', () => {
  it('не делает файл доступным, если запись отклонена', async () => {
    const repository = new IndexedDbAttachmentFileRepository()
    const originalOpen = indexedDB.open.bind(indexedDB)
    indexedDB.open = (() => {
      throw new DOMException('Недостаточно места', 'QuotaExceededError')
    }) as IDBFactory['open']

    await expect(repository.save('audio-1', new Blob(['mp3']))).rejects.toThrow('Недостаточно места')

    indexedDB.open = originalOpen
    await expect(repository.get('audio-1')).resolves.toBeUndefined()
  })
})
