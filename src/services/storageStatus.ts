export type PersistenceState = 'granted' | 'not-granted' | 'unavailable' | 'error'

export interface StorageStatus {
  persistence: PersistenceState
  usageBytes?: number
  quotaBytes?: number
}

type BrowserStorage = Pick<StorageManager, 'estimate' | 'persist' | 'persisted'>

function browserStorage(): BrowserStorage | undefined {
  return navigator.storage
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = browserStorage()
  if (!storage) {
    return { persistence: 'unavailable' }
  }

  try {
    const [isPersistent, estimate] = await Promise.all([
      storage.persisted(),
      storage.estimate(),
    ])
    return {
      persistence: isPersistent ? 'granted' : 'not-granted',
      usageBytes: estimate.usage,
      quotaBytes: estimate.quota,
    }
  } catch {
    return { persistence: 'error' }
  }
}

export async function requestPersistentStorage(): Promise<StorageStatus> {
  const storage = browserStorage()
  if (!storage) {
    return { persistence: 'unavailable' }
  }

  try {
    await storage.persist()
    return await readStorageStatus()
  } catch {
    return { persistence: 'error' }
  }
}
