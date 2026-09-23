import type { NewSong, Song } from '@/domain/song'
import { openSetlistDatabase } from './database'
import type { SongRepository } from './songRepository'
import { createUuid } from '@/services/uuid'

function cleanOptionalText(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text || undefined
}

export class IndexedDbSongRepository implements SongRepository {
  async create(input: NewSong): Promise<Song> {
    const title = input.title.trim()
    if (!title) {
      throw new Error('Название песни обязательно')
    }

    const now = new Date().toISOString()
    const song: Song = {
      id: createUuid(),
      title,
      artist: cleanOptionalText(input.artist),
      content: cleanOptionalText(input.content),
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }

    const database = await openSetlistDatabase()
    await database.put('songs', song)
    database.close()
    return song
  }

  async getById(id: string): Promise<Song | undefined> {
    const database = await openSetlistDatabase()
    const song = await database.get('songs', id)
    database.close()
    return song
  }

  async list(): Promise<Song[]> {
    const database = await openSetlistDatabase()
    const songs = await database.getAll('songs')
    database.close()
    return songs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async update(song: Song): Promise<Song> {
    const title = song.title.trim()
    if (!title) {
      throw new Error('Название песни обязательно')
    }

    const updatedSong: Song = {
      ...song,
      title,
      artist: cleanOptionalText(song.artist),
      content: cleanOptionalText(song.content),
      updatedAt: new Date().toISOString(),
    }
    const database = await openSetlistDatabase()
    await database.put('songs', updatedSong)
    database.close()
    return updatedSong
  }
}
