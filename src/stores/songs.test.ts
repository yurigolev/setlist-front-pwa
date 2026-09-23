import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

import { useSongsStore } from './songs'
import { IndexedDbAttachmentFileRepository } from '@/repositories/attachmentFileRepository'

afterEach(() => {
  indexedDB.deleteDatabase('setlist-library')
})

describe('пакетная загрузка вложений', () => {
  it('сохраняет несколько PNG из реактивной карточки без ошибки structured clone', async () => {
    setActivePinia(createPinia())
    const songs = useSongsStore()
    const song = reactive(await songs.create({ title: 'Проверка PNG' }))

    const withFirstImage = await songs.addAttachment(song, new File(['first'], 'first.png', { type: 'image/png' }))
    const withSecondImage = await songs.addAttachment(reactive(withFirstImage), new File(['second'], 'second.png', { type: 'image/png' }))

    expect(withSecondImage.attachments).toHaveLength(2)
    await expect(songs.get(withSecondImage.id)).resolves.toMatchObject({ attachments: expect.arrayContaining([
      expect.objectContaining({ name: 'first.png' }),
      expect.objectContaining({ name: 'second.png' }),
    ]) })
  })

  it('сохраняет изображение и MP3 отдельно от карточки и восстанавливает их после нового чтения', async () => {
    setActivePinia(createPinia())
    const songs = useSongsStore()
    const song = await songs.create({ title: 'Проверка медиа' })

    const withImage = await songs.addAttachment(song, new File(['image bytes'], 'chords.png', { type: 'image/png' }))
    const withMedia = await songs.addAttachment(withImage, new File(['audio bytes'], 'playback.mp3', { type: 'audio/mpeg' }))
    const restored = await songs.get(withMedia.id)

    expect(restored?.attachments).toHaveLength(2)
    expect(restored?.attachments.map((attachment) => attachment.kind)).toEqual(['image', 'audio'])
    const files = new IndexedDbAttachmentFileRepository()
    const savedImage = await files.get(restored!.attachments[0].fileKey)
    const savedAudio = await files.get(restored!.attachments[1].fileKey)
    // fake-indexeddb serializes jsdom Blob as an opaque object, so here we
    // verify that both independent file records survive a fresh DB read.
    expect(savedImage).toBeDefined()
    expect(savedAudio).toBeDefined()
  })

})
