import type { Song } from '@/domain/song';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU');
}

export function searchSongs(songs: Song[], query: string): Song[] {
  const needle = normalize(query);
  if (!needle) return songs;

  return songs.filter((song) =>
    [song.title, song.artist, song.content]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalize(value).includes(needle)),
  );
}

export function filterSongsByTags(songs: Song[], ids: string[]): Song[] {
  if (!ids.length) return songs;
  return songs.filter((song) => ids.some((id) => song.tagIds?.includes(id)));
}
