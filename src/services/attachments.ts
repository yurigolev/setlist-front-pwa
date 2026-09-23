import type { Attachment, AttachmentKind, Song } from '@/domain/song'
import { IndexedDbAttachmentFileRepository } from '@/repositories/attachmentFileRepository'
import { createUuid } from './uuid'

const acceptedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const mp3Extensions = ['.mp3']
export const MAX_AUDIO_ATTACHMENTS = 1

export function attachmentKind(file: File): AttachmentKind | undefined {
  if (acceptedImageTypes.has(file.type)) return 'image'
  if (file.type === 'audio/mpeg' || mp3Extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) return 'audio'
  return undefined
}

export function attachmentValidationMessage(file: File): string | undefined {
  if (attachmentKind(file)) return undefined
  return `«${file.name}» не добавлен: поддерживаются PNG, JPEG, WebP и MP3.`
}

export function attachmentLimitMessage(song: Song, file: File): string | undefined {
  const kind = attachmentKind(file)
  if (kind === 'audio' && song.attachments.filter((attachment) => attachment.kind === 'audio').length >= MAX_AUDIO_ATTACHMENTS) {
    return 'Для песни можно добавить только один MP3-плейбэк.'
  }
}

export async function saveAttachment(song: Song, file: File): Promise<Attachment> {
  const kind = attachmentKind(file)
  if (!kind) throw new Error(attachmentValidationMessage(file))
  const limitMessage = attachmentLimitMessage(song, file)
  if (limitMessage) throw new Error(limitMessage)

  const attachment: Attachment = {
    id: createUuid(),
    songId: song.id,
    kind,
    name: file.name,
    mimeType: file.type || (kind === 'audio' ? 'audio/mpeg' : 'application/octet-stream'),
    fileKey: `attachment:${createUuid()}`,
    createdAt: new Date().toISOString(),
  }
  // Safari иногда не клонирует File из системного picker в IndexedDB. Обычный Blob
  // с теми же байтами стабильно поддерживается structured clone во всех целевых браузерах.
  const data = await file.arrayBuffer()
  const persistentBlob = new Blob([data], { type: attachment.mimeType })
  await new IndexedDbAttachmentFileRepository().save(attachment.fileKey, persistentBlob)
  return attachment
}
