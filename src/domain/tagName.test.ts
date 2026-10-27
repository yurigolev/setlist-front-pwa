import { expect, it } from 'vitest';
import { isTagName, normalizeTagName } from './tagName';

it('нормализует Unicode и пробелы, сохраняя регистр имени', () => {
  expect(normalizeTagName('  ПЕ\u0308СНИ\t  вечера  ')).toBe('ПЁСНИ вечера');
});

it('проверяет длину после нормализации в Unicode-символах', () => {
  for (const name of ['', ' \n\t ', 'я'.repeat(41), '🎵'.repeat(41)])
    expect(isTagName(name)).toBe(false);
  for (const name of ['я', 'я'.repeat(40), '🎵'.repeat(40), ` ${'Е\u0308'.repeat(40)} `])
    expect(isTagName(name)).toBe(true);
});
