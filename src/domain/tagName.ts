export function normalizeTagName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function isTagName(name: string): boolean {
  const length = [...normalizeTagName(name)].length;
  return length >= 1 && length <= 40;
}
