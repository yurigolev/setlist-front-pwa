import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, UnknownResultError, createSong, fetchSnapshot, patchSong, uploadAttachment } from './libraryApi'

const id = '11111111-1111-4111-8111-111111111111'
const responseSong = { id, title: 'Песня', artist: 'Артист', notes: 'Заметка', revision: 3, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
afterEach(() => vi.unstubAllGlobals())
describe('контракт API', () => {
  it('создаёт песню с notes и Idempotency-Key', async () => {
    const fetcher = vi.fn(async () => Response.json(responseSong))
    vi.stubGlobal('fetch', fetcher)
    const song = await createSong({ title: 'Песня', artist: 'Артист', content: 'Заметка' }, id)
    expect(song.content).toBe('Заметка')
    expect(fetcher.mock.calls[0][0]).toBe('/v1/songs')
    const options = fetcher.mock.calls[0][1] as RequestInit
    expect(options.headers).toMatchObject({ 'Idempotency-Key': id })
    expect(JSON.parse(String(options.body))).toEqual({ title: 'Песня', artist: 'Артист', notes: 'Заметка' })
  })
  it('передаёт ревизию и не отправляет вложения в PATCH', async () => {
    const fetcher = vi.fn(async () => Response.json(responseSong))
    vi.stubGlobal('fetch', fetcher)
    await patchSong({ ...responseSong, content: 'Заметка', attachments: [{ id, songId: id, kind: 'image', name: 'a.png', mimeType: 'image/png', fileKey: 'local', createdAt: '' }] })
    const options = fetcher.mock.calls[0][1] as RequestInit
    expect(options.headers).toMatchObject({ 'If-Match': '3' })
    expect(JSON.parse(String(options.body))).toEqual({ title: 'Песня', artist: 'Артист', notes: 'Заметка' })
  })
  it('отправляет один файл, UUID и исходную ревизию', async () => {
    const fetcher = vi.fn(async () => Response.json({ id, songId: id, kind: 'audio', filename: 'test.mp3', mimeType: 'audio/mpeg', byteSize: 3, checksum: 'a'.repeat(64), contentUrl: `/v1/attachments/${id}/content`, createdAt: '2026-01-01T00:00:00Z' }))
    vi.stubGlobal('fetch', fetcher)
    await uploadAttachment({ ...responseSong, content: '', attachments: [] }, new File(['abc'], 'test.mp3'), id)
    const options = fetcher.mock.calls[0][1] as RequestInit
    expect(options.headers).toMatchObject({ 'If-Match': '3', 'X-Attachment-Id': id })
    expect((options.body as FormData).getAll('file')).toHaveLength(1)
  })
  it('показывает конфликт с актуальной ревизией', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'REVISION_CONFLICT', message: 'Conflict', requestId: id, currentRevision: 4 }, { status: 409 })))
    await expect(patchSong({ ...responseSong, content: '', attachments: [] })).rejects.toMatchObject({ status: 409, code: 'REVISION_CONFLICT', currentRevision: 4 } satisfies Partial<ApiError>)
  })
  it('отклоняет повреждённый снимок', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ libraryId: id, libraryRevision: 0, songs: [{ title: 'missing id' }] })))
    await expect(fetchSnapshot()).rejects.toThrow('Некорректная песня')
  })
  it('повторяет создание с прежним ключом после потерянного ответа', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(Response.json(responseSong))
    vi.stubGlobal('fetch', fetcher)
    await expect(createSong({ title: 'Песня', artist: 'Артист' }, id)).rejects.toBeInstanceOf(UnknownResultError)
    await createSong({ title: 'Песня', artist: 'Артист' }, id)
    expect(fetcher.mock.calls.map((call) => call[1].headers['Idempotency-Key'])).toEqual([id, id])
  })
  it('повторяет загрузку с тем же UUID и ревизией после потерянного ответа', async () => {
    const attachment = { id, songId: id, kind: 'audio', filename: 'test.mp3', mimeType: 'audio/mpeg', byteSize: 3, checksum: 'a'.repeat(64), contentUrl: `/v1/attachments/${id}/content`, createdAt: '2026-01-01T00:00:00Z' }
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('response lost')).mockResolvedValueOnce(Response.json(attachment))
    vi.stubGlobal('fetch', fetcher)
    const song = { ...responseSong, content: '', attachments: [] }
    const file = new File(['abc'], 'test.mp3', { type: 'audio/mpeg' })
    await expect(uploadAttachment(song, file, id, 3)).rejects.toBeInstanceOf(UnknownResultError)
    await uploadAttachment(song, file, id, 3)
    expect(fetcher.mock.calls.map((call) => call[1].headers['X-Attachment-Id'])).toEqual([id, id])
    expect(fetcher.mock.calls.map((call) => call[1].headers['If-Match'])).toEqual(['3', '3'])
  })
})
