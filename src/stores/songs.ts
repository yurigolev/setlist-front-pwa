import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NewSong, Song } from '@/domain/song'
import { IndexedDbSongRepository } from '@/repositories/indexedDbSongRepository'
import { saveAttachment } from '@/services/attachments'

const repository = new IndexedDbSongRepository()

export const useSongsStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const isLoading = ref(false)

  async function load(): Promise<void> {
    isLoading.value = true
    try { songs.value = await repository.list() } finally { isLoading.value = false }
  }
  function get(id: string): Promise<Song | undefined> { return repository.getById(id) }
  async function create(input: NewSong): Promise<Song> {
    const song = await repository.create(input)
    await load()
    return song
  }
  async function update(song: Song): Promise<Song> {
    // Не передаём в IndexedDB Vue Proxy и чужие поля из FilePicker: Safari/macOS
    // отказывается клонировать их при пакетной загрузке изображений.
    const persistableSong: Song = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      content: song.content,
      createdAt: song.createdAt,
      updatedAt: song.updatedAt,
      attachments: song.attachments.map((attachment) => ({
        id: attachment.id,
        songId: attachment.songId,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        fileKey: attachment.fileKey,
        createdAt: attachment.createdAt,
      })),
    }
    const updatedSong = await repository.update(persistableSong)
    await load()
    return updatedSong
  }
  async function addAttachment(song: Song, file: File): Promise<Song> {
    const attachment = await saveAttachment(song, file)
    return update({ ...song, attachments: [...song.attachments, attachment] })
  }
  return { songs, isLoading, load, get, create, update, addAttachment }
})
