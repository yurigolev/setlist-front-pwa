import { describe, expect, it } from 'vitest';
import { searchSongs } from './songSearch';
import type { Song } from '@/domain/song';

const songs: Song[] = [
  {
    id: '1',
    title: 'Wonderwall',
    artist: 'Oasis',
    content: 'Капо на втором ладу',
    attachments: [],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    title: 'Ночной поезд',
    artist: 'Кино',
    content: 'Вступать после третьего такта',
    attachments: [],
    createdAt: '',
    updatedAt: '',
  },
];

describe('локальный поиск песен', () => {
  it('находит песню по названию без учёта регистра', () =>
    expect(searchSongs(songs, 'WONDER')).toEqual([songs[0]]));
  it('находит песню по исполнителю', () => expect(searchSongs(songs, 'киНО')).toEqual([songs[1]]));
  it('находит песню по заметкам', () =>
    expect(searchSongs(songs, 'третьего такта')).toEqual([songs[1]]));
  it('возвращает все песни для пустого запроса и ничего для несовпадения', () => {
    expect(searchSongs(songs, ' ')).toEqual(songs);
    expect(searchSongs(songs, 'нет такого')).toEqual([]);
  });
});

it('фильтрует по любому выбранному тегу, включая песни без тегов и прежний кэш', async () => {
  const { filterSongsByTags } = await import('./songSearch');
  const tagged = [
    { ...songs[0]!, tagIds: ['a', 'b'] },
    { ...songs[1]!, tagIds: ['b'] },
    { ...songs[0]!, id: 'legacy' },
  ];
  expect(filterSongsByTags(tagged, [])).toBe(tagged);
  expect(filterSongsByTags(tagged, ['a', 'b']).map((song) => song.id)).toEqual(['1', '2']);
  expect(filterSongsByTags(searchSongs(tagged, 'кино'), ['b']).map((song) => song.id)).toEqual([
    '2',
  ]);
  expect(filterSongsByTags(tagged, ['missing'])).toEqual([]);
});
