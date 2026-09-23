import { openSetlistDatabase } from './database'

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
