import { describe, expect, it } from 'vitest'
import { searchSongs } from './songSearch'
import type { Song } from '@/domain/song'

const songs: Song[] = [
  { id: '1', title: 'Wonderwall', artist: 'Oasis', content: 'Капо на втором ладу', attachments: [], createdAt: '', updatedAt: '' },
  { id: '2', title: 'Ночной поезд', artist: 'Кино', content: 'Вступать после третьего такта', attachments: [], createdAt: '', updatedAt: '' },
]

describe('локальный поиск песен', () => {
  it('находит песню по названию без учёта регистра', () => expect(searchSongs(songs, 'WONDER')).toEqual([songs[0]]))
  it('находит песню по исполнителю', () => expect(searchSongs(songs, 'киНО')).toEqual([songs[1]]))
  it('находит песню по заметкам', () => expect(searchSongs(songs, 'третьего такта')).toEqual([songs[1]]))
  it('возвращает все песни для пустого запроса и ничего для несовпадения', () => {
    expect(searchSongs(songs, ' ')).toEqual(songs)
    expect(searchSongs(songs, 'нет такого')).toEqual([])
  })
})
