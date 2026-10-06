import { createHash, webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sha256Hex } from './checksum'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('SHA-256 на HTTP и HTTPS', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
  ])('проверяет известный вектор без crypto.subtle: %s', async (input, expected) => {
    vi.stubGlobal('crypto', {})
    expect(await sha256Hex(new TextEncoder().encode(input).buffer)).toBe(expected)
  })

  it('совпадает с нативным SHA-256 для бинарного файла из нескольких блоков', async () => {
    const bytes = Uint8Array.from({ length: 1025 }, (_, i) => i % 256)
    const expected = createHash('sha256').update(bytes).digest('hex')
    vi.stubGlobal('crypto', {})
    expect(await sha256Hex(bytes.buffer)).toBe(expected)
    vi.stubGlobal('crypto', webcrypto)
    expect(await sha256Hex(bytes.buffer)).toBe(expected)
  })
})
