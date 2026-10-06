import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Attachment, Song } from '@/domain/song'

interface SetlistDatabase extends DBSchema {
  serverSongs: { key: string; value: Song }
  serverFiles: { key: string; value: Blob | { data: ArrayBuffer; mimeType: string } }
  temporaryFiles: { key: string; value: Blob }
  serverMeta: { key: string; value: unknown }
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
  return openDB<SetlistDatabase>(databaseName, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('songs', { keyPath: 'id' })
        database.createObjectStore('files')
        const attachments = database.createObjectStore('attachments', { keyPath: 'id' })
        attachments.createIndex('by-song', 'songId')
      }
      database.createObjectStore('serverSongs', { keyPath: 'id' })
      database.createObjectStore('serverFiles')
      database.createObjectStore('temporaryFiles')
      database.createObjectStore('serverMeta')
    },
  })
}
