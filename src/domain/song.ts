export interface SongTag {
  id: string;
  name: string;
  color?: string | null;
}

export type AttachmentKind = 'image' | 'audio';

export interface Attachment {
  setlistId?: string;
  id: string;
  songId: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  fileKey: string;
  createdAt: string;
  byteSize?: number;
  checksum?: string;
  contentUrl?: string;
}

export interface Song {
  setlistId?: string;
  id: string;
  title: string;
  artist?: string;
  content?: string;
  tagIds?: string[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  revision?: number;
}

export interface NewSong {
  tagIds?: string[];
  title: string;
  artist?: string;
  content?: string;
}
