import type { SongTag } from './song';

export const TAG_COLORS = [
  { value: '#82A5ED', name: 'Синий' },
  { value: '#B69AE8', name: 'Фиолетовый' },
  { value: '#E194BC', name: 'Розовый' },
  { value: '#E88F91', name: 'Красный' },
  { value: '#E5A278', name: 'Оранжевый' },
  { value: '#D6B86D', name: 'Жёлтый' },
  { value: '#B5C97A', name: 'Лаймовый' },
  { value: '#83BE91', name: 'Зелёный' },
  { value: '#75C4AF', name: 'Мятный' },
  { value: '#77BFCB', name: 'Бирюзовый' },
  { value: '#A0AFCA', name: 'Серый' },
  { value: '#C3A28B', name: 'Песочный' },
] as const;

export function isTagColor(value: unknown): value is string {
  return typeof value === 'string' && value.length === 7 && /^#[0-9a-f]{6}$/i.test(value);
}

export function suggestTagColor(tags: SongTag[]): string {
  const count = (color: string) => tags.filter((tag) => tag.color?.toUpperCase() === color).length;
  return TAG_COLORS.reduce((best, color) => (count(color.value) < count(best.value) ? color : best))
    .value;
}
