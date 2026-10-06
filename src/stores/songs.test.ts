import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSongsStore } from './songs'

const id = '11111111-1111-4111-8111-111111111111'
const libraryId = '22222222-2222-4222-8222-222222222222'
const serverSong = { id, title: 'Песня', artist: 'Артист', notes: 'Текст', revision: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', attachments: [] }
let serverSongs: typeof serverSong[]
let calls: Array<{ path: string; options?: RequestInit }>
beforeEach(() => {
  setActivePinia(createPinia())
  serverSongs = []
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    calls.push({ path: url, options })
    if (url.endsWith('/v1/library/snapshot')) return Response.json({ libraryId, libraryRevision: 1, songs: serverSongs })
    if (url.endsWith('/v1/songs') && options?.method === 'POST') { serverSongs = [serverSong]; return Response.json(serverSong) }
    return Response.json({ code: 'NOT_FOUND', message: 'Not found', requestId: id }, { status: 404 })
  }))
})
afterEach(() => { vi.unstubAllGlobals(); indexedDB.deleteDatabase('setlist-library') })

describe('серверная библиотека', () => {
  it('передаёт notes и стабильный ключ, затем читает подтверждённый снимок', async () => {
    const store = useSongsStore()
    const saved = await store.create({ title: 'Песня', artist: 'Артист', content: 'Текст' }, id)
    expect(saved.content).toBe('Текст')
    expect(store.songs).toHaveLength(1)
    const post = calls.find((call) => call.options?.method === 'POST')!
    expect(post.options?.headers).toMatchObject({ 'Idempotency-Key': id })
    expect(JSON.parse(String(post.options?.body))).toEqual({ title: 'Песня', artist: 'Артист', notes: 'Текст' })
  })
  it('не отправляет старые локальные записи на сервер при загрузке', async () => {
    const store = useSongsStore()
    await store.load()
    expect(store.songs).toEqual([])
    expect(calls.map((call) => call.path)).toEqual(['/v1/library/snapshot'])
  })
  it('требует исполнителя до запроса', async () => {
    await expect(useSongsStore().create({ title: 'Песня' })).rejects.toThrow('исполнителя')
    expect(calls).toEqual([])
  })
})
