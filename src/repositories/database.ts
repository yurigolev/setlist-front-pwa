import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Attachment, Song } from '@/domain/song'

interface SetlistDatabase extends DBSchema {
  songs: {
    key: string
    value: Song
  }
  files: {
    key: string
    value: Blob
  }
  attachments: {
    key: string
    value: Attachment
    indexes: { 'by-song': string }
  }
}

const databaseName = 'setlist-library'

export function openSetlistDatabase(): Promise<IDBPDatabase<SetlistDatabase>> {
  return openDB<SetlistDatabase>(databaseName, 1, {
    upgrade(database) {
      database.createObjectStore('songs', { keyPath: 'id' })
      database.createObjectStore('files')
      const attachments = database.createObjectStore('attachments', { keyPath: 'id' })
      attachments.createIndex('by-song', 'songId')
    },
  })
}
