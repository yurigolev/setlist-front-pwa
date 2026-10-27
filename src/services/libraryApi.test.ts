import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from './sessionTransport';
import { configureSession } from './sessionTransport';
import {
  ApiError,
  UnknownResultError,
  createSong,
  fetchSnapshot,
  patchSong,
  uploadAttachment,
} from './libraryApi';

const id = '11111111-1111-4111-8111-111111111111';
const responseSong = {
  setlistId: id,
  id,
  title: 'Песня',
  artist: 'Артист',
  notes: 'Заметка',
  revision: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  configureSession();
});
describe('контракт API', () => {
  it.each([401, 403])('запоздалый %i прежней сессии не сбрасывает новую', async (status) => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    configureSession('old');
    const request = fetchSnapshot(id);
    const reset = vi.fn();
    configureSession('new', reset);
    const events = vi.spyOn(window, 'dispatchEvent');
    finish(Response.json({ code: 'LEGACY_OWNER_REQUIRED' }, { status }));
    await expect(request).rejects.toBeInstanceOf(ApiError);
    expect(reset).not.toHaveBeenCalled();
    expect(events).not.toHaveBeenCalled();
  });
  it('создаёт песню с notes и Idempotency-Key', async () => {
    const fetcher = vi.fn(async () => Response.json(responseSong));
    vi.stubGlobal('fetch', fetcher);
    const song = await createSong({ title: 'Песня', artist: 'Артист', content: 'Заметка' }, id, id);
    expect(song.content).toBe('Заметка');
    expect(fetcher.mock.calls[0][0]).toBe(`${apiBaseUrl}/v1/setlists/${id}/songs`);
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.headers).toMatchObject({ 'Idempotency-Key': id });
    expect(JSON.parse(String(options.body))).toEqual({
      title: 'Песня',
      artist: 'Артист',
      notes: 'Заметка',
    });
  });
  it('передаёт ревизию и не отправляет вложения в PATCH', async () => {
    const fetcher = vi.fn(async () => Response.json(responseSong));
    vi.stubGlobal('fetch', fetcher);
    await patchSong(
      {
        ...responseSong,
        content: 'Заметка',
        attachments: [
          {
            id,
            songId: id,
            kind: 'image',
            name: 'a.png',
            mimeType: 'image/png',
            fileKey: 'local',
            createdAt: '',
          },
        ],
      },
      id,
    );
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.headers).toMatchObject({ 'If-Match': '3' });
    expect(JSON.parse(String(options.body))).toEqual({
      title: 'Песня',
      artist: 'Артист',
      notes: 'Заметка',
    });
  });
  it('отправляет один файл, UUID и исходную ревизию', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id,
        songId: id,
        kind: 'audio',
        filename: 'test.mp3',
        mimeType: 'audio/mpeg',
        byteSize: 3,
        checksum: 'a'.repeat(64),
        contentUrl: `/v1/attachments/${id}/content`,
        createdAt: '2026-01-01T00:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    await uploadAttachment(
      { ...responseSong, content: '', attachments: [] },
      new File(['abc'], 'test.mp3'),
      id,
      3,
      id,
    );
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.headers).toMatchObject({ 'If-Match': '3', 'X-Attachment-Id': id });
    expect((options.body as FormData).getAll('file')).toHaveLength(1);
  });
  it('показывает конфликт с актуальной ревизией', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'REVISION_CONFLICT', message: 'Conflict', requestId: id, currentRevision: 4 },
          { status: 409 },
        ),
      ),
    );
    await expect(
      patchSong({ ...responseSong, content: '', attachments: [] }, id),
    ).rejects.toMatchObject({
      status: 409,
      code: 'REVISION_CONFLICT',
      currentRevision: 4,
    } satisfies Partial<ApiError>);
  });
  it('отклоняет повреждённый снимок', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          setlistId: id,
          setlistRevision: 0,
          role: 'owner',
          songs: [{ title: 'missing id' }],
        }),
      ),
    );
    await expect(fetchSnapshot(id)).rejects.toThrow('Некорректная песня');
  });
  it('повторяет создание с прежним ключом после потерянного ответа', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(Response.json(responseSong));
    vi.stubGlobal('fetch', fetcher);
    await expect(createSong({ title: 'Песня', artist: 'Артист' }, id, id)).rejects.toBeInstanceOf(
      UnknownResultError,
    );
    await createSong({ title: 'Песня', artist: 'Артист' }, id, id);
    expect(fetcher.mock.calls.map((call) => call[1].headers['Idempotency-Key'])).toEqual([id, id]);
  });
  it('повторяет загрузку с тем же UUID и ревизией после потерянного ответа', async () => {
    const attachment = {
      id,
      songId: id,
      kind: 'audio',
      filename: 'test.mp3',
      mimeType: 'audio/mpeg',
      byteSize: 3,
      checksum: 'a'.repeat(64),
      contentUrl: `/v1/attachments/${id}/content`,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(Response.json(attachment));
    vi.stubGlobal('fetch', fetcher);
    const song = { ...responseSong, content: '', attachments: [] };
    const file = new File(['abc'], 'test.mp3', { type: 'audio/mpeg' });
    await expect(uploadAttachment(song, file, id, 3, id)).rejects.toBeInstanceOf(
      UnknownResultError,
    );
    await uploadAttachment(song, file, id, 3, id);
    expect(fetcher.mock.calls.map((call) => call[1].headers['X-Attachment-Id'])).toEqual([id, id]);
    expect(fetcher.mock.calls.map((call) => call[1].headers['If-Match'])).toEqual(['3', '3']);
  });
});

it('удаляет файл с ревизией песни и scoped URL', async () => {
  const { deleteAttachment } = await import('./libraryApi');
  const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  await deleteAttachment(id, id, 4);
  expect(fetcher.mock.calls[0][0]).toBe(`${apiBaseUrl}/v1/setlists/${id}/attachments/${id}`);
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ 'If-Match': '4' });
});

it('передаёт tagIds, сохраняет отсутствие PATCH и очищает явным []', async () => {
  const fetcher = vi.fn(async () => Response.json({ ...responseSong, tagIds: [id] }));
  vi.stubGlobal('fetch', fetcher);
  const created = await createSong({ title: 'Песня', artist: 'Артист', tagIds: [id] }, id, id);
  expect(created.tagIds).toEqual([id]);
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).tagIds).toEqual([id]);
  await patchSong({ ...created, tagIds: undefined }, id);
  expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).not.toHaveProperty('tagIds');
  await patchSong({ ...created, tagIds: [] }, id);
  expect(JSON.parse(String(fetcher.mock.calls[2]![1]?.body)).tagIds).toEqual([]);
});
it('проверяет связи тегов снимка и принимает прежний снимок без тегов', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      setlistId: id,
      setlistRevision: 1,
      role: 'viewer',
      songs: [{ ...responseSong, tagIds: [id] }],
      tags: [{ id, name: 'Акустика' }],
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  expect((await fetchSnapshot(id)).tags).toEqual([{ id, name: 'Акустика' }]);
  fetcher.mockImplementation(async () =>
    Response.json({
      setlistId: id,
      setlistRevision: 1,
      role: 'viewer',
      songs: [{ ...responseSong, tagIds: [id] }],
      tags: [],
    }),
  );
  await expect(fetchSnapshot(id)).rejects.toThrow('связи тегов');
  fetcher.mockImplementation(async () =>
    Response.json({ setlistId: id, setlistRevision: 1, role: 'viewer', songs: [responseSong] }),
  );
  expect((await fetchSnapshot(id)).tags).toEqual([]);
});
it('создаёт и переименовывает scoped теги, проверяет длину и сообщает конфликт', async () => {
  const { createTag, updateTag, deleteTag } = await import('./libraryApi');
  const fetcher = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ id, name: 'Новый тег' }),
  );
  vi.stubGlobal('fetch', fetcher);
  await createTag('  Новый   тег ', id);
  expect(fetcher.mock.calls[0]?.[0]).toBe(`${apiBaseUrl}/v1/setlists/${id}/tags`);
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ name: 'Новый тег' });
  await updateTag(id, 'Название', id);
  expect(fetcher.mock.calls[1]?.[1]?.method).toBe('PATCH');
  await deleteTag(id, id);
  expect(fetcher.mock.calls[2]?.[1]?.method).toBe('DELETE');
  await expect(createTag('a'.repeat(41), id)).rejects.toThrow('40');
  fetcher.mockImplementation(async () =>
    Response.json(
      { code: 'TAG_NAME_CONFLICT', message: 'Tag name already exists' },
      { status: 409 },
    ),
  );
  await expect(updateTag(id, 'Дубль', id)).rejects.toThrow('Тег с таким названием уже существует.');
});
it('цвет необязателен, нормализуется и может быть явно снят', async () => {
  const { createTag, updateTag, serverTag } = await import('./libraryApi');
  const fetcher = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ id, name: 'Цветной', color: '#82a5ed' }),
  );
  vi.stubGlobal('fetch', fetcher);
  expect((await createTag('Цветной', id, '#82a5ed')).color).toBe('#82A5ED');
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
    name: 'Цветной',
    color: '#82A5ED',
  });
  await updateTag(id, 'Цветной', id, null);
  expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
    name: 'Цветной',
    color: null,
  });
  await updateTag(id, 'Другое имя', id);
  expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({ name: 'Другое имя' });
  expect(serverTag({ id, name: 'Без цвета', color: null }).color).toBeNull();
  expect(serverTag({ id, name: 'Старый' }).color).toBeUndefined();
  expect(() => serverTag({ id, name: 'Плохой', color: 'red' })).toThrow('Некорректный тег');
  await expect(createTag('Плохой', id, '#1234')).rejects.toThrow('#RRGGBB');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
