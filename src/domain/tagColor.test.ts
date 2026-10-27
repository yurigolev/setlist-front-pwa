import { expect, it } from 'vitest';
import { isTagColor, suggestTagColor, TAG_COLORS } from './tagColor';

it('выбирает наименее используемый цвет, учитывает регистр и игнорирует бесцветные теги', () => {
  const tags = TAG_COLORS.map((color, index) => ({
    id: String(index),
    name: String(index),
    color: color.value.toLowerCase(),
  }));
  expect(suggestTagColor([])).toBe(TAG_COLORS[0].value);
  expect(suggestTagColor([{ id: 'none', name: 'Без цвета' }, tags[0]!])).toBe(TAG_COLORS[1].value);
  expect(suggestTagColor([...tags, tags[0]!])).toBe(TAG_COLORS[1].value);
});
it('принимает только непрозрачный шестизначный HEX', () => {
  expect(isTagColor('#abcDEF')).toBe(true);
  for (const color of [null, undefined, '#abc', '#AABBCCDD', '#AABBCC\n', 'red', 'AABBCC'])
    expect(isTagColor(color)).toBe(false);
});
