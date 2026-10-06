import { openSetlistDatabase } from './database'
import { readServerFile } from './serverSnapshotRepository'

export interface AttachmentFileRepository {
  save(fileKey: string, file: Blob): Promise<void>
  get(fileKey: string): Promise<Blob | undefined>
  remove(fileKey: string): Promise<void>
}

export class IndexedDbAttachmentFileRepository implements AttachmentFileRepository {
  async save(fileKey: string, file: Blob): Promise<void> {
    const database = await openSetlistDatabase()
    try {
      await database.put('files', file, fileKey)
    } finally {
      database.close()
    }
  }

  async get(fileKey: string): Promise<Blob | undefined> {
    if (fileKey.startsWith('server:')) return readServerFile(fileKey)
    const database = await openSetlistDatabase()
    try {
      return await database.get('files', fileKey)
    } finally {
      database.close()
    }
  }

  async remove(fileKey: string): Promise<void> {
    const database = await openSetlistDatabase()
    try {
      await database.delete('files', fileKey)
    } finally {
      database.close()
    }
  }
}
