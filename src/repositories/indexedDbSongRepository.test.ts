import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { IndexedDbSongRepository } from './indexedDbSongRepository'

afterEach(async () => {
  indexedDB.deleteDatabase('setlist-library')
})

describe('IndexedDbSongRepository', () => {
  it('создаёт и читает минимальную песню', async () => {
    const repository = new IndexedDbSongRepository()

    const created = await repository.create({ title: '  Wonderwall  ' })
    const restored = await repository.getById(created.id)

    expect(created.title).toBe('Wonderwall')
    expect(created.attachments).toEqual([])
    expect(restored).toEqual(created)
  })

  it('не сохраняет песню без названия', async () => {
    const repository = new IndexedDbSongRepository()

    await expect(repository.create({ title: '   ' })).rejects.toThrow('Название песни обязательно')
    await expect(repository.list()).resolves.toEqual([])
  })
})
