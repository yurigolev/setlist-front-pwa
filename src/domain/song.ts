export type AttachmentKind = 'image' | 'audio'

export interface Attachment {
  id: string
  songId: string
  kind: AttachmentKind
  name: string
  mimeType: string
  fileKey: string
  createdAt: string
  byteSize?: number
  checksum?: string
  contentUrl?: string
}

export interface Song {
  id: string
  title: string
  artist?: string
  content?: string
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
  revision?: number
}

export interface NewSong {
  title: string
  artist?: string
  content?: string
}
