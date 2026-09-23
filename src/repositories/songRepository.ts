import type { NewSong, Song } from '@/domain/song'

export interface SongRepository {
  create(song: NewSong): Promise<Song>
  getById(id: string): Promise<Song | undefined>
  list(): Promise<Song[]>
  update(song: Song): Promise<Song>
}
