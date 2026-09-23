import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestPersistentStorage } from './storageStatus'

const originalStorage = navigator.storage

afterEach(() => {
  Object.defineProperty(navigator, 'storage', { configurable: true, value: originalStorage })
})

describe('requestPersistentStorage', () => {
  it('показывает ошибку, если браузер отклонил запрос', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: vi.fn().mockRejectedValue(new Error('denied')),
        persisted: vi.fn(),
        estimate: vi.fn(),
      },
    })

    await expect(requestPersistentStorage()).resolves.toEqual({ persistence: 'error' })
  })
})
