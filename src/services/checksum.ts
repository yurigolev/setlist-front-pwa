import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  // Web Crypto is unavailable on public HTTP origins. Keep SHA-256 verification
  // there with the same digest algorithm rather than skipping integrity checks.
  const subtle = globalThis.crypto?.subtle
  const digest = subtle
    ? new Uint8Array(await subtle.digest('SHA-256', data))
    : sha256(new Uint8Array(data))
  return bytesToHex(digest)
}
