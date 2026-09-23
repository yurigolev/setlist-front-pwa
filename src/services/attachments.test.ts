import { describe, expect, it } from 'vitest'
import { attachmentKind, attachmentLimitMessage, attachmentValidationMessage } from './attachments'
import type { Song } from '@/domain/song'

function songWithAttachments(kinds: Array<'image' | 'audio'>): Song {
  return {
    id: 'song-1', title: 'Песня', attachments: kinds.map((kind, index) => ({ id: String(index), songId: 'song-1', kind, name: `${index}.${kind}`, mimeType: '', fileKey: String(index), createdAt: '' })), createdAt: '', updatedAt: '',
  }
}

describe('проверка вложений', () => {
  it('принимает изображения и MP3', () => {
    expect(attachmentKind(new File(['a'], 'аккорды.png', { type: 'image/png' }))).toBe('image')
    expect(attachmentKind(new File(['a'], 'playback.mp3', { type: '' }))).toBe('audio')
  })

  it('отклоняет неподдерживаемый файл с понятной причиной', () => {
    const file = new File(['text'], 'слова.txt', { type: 'text/plain' })
    expect(attachmentKind(file)).toBeUndefined()
    expect(attachmentValidationMessage(file)).toContain('PNG, JPEG, WebP и MP3')
  })

  it('не ограничивает количество скриншотов и сохраняет один плейбэк', () => {
    expect(attachmentLimitMessage(songWithAttachments(['image', 'image', 'image', 'image', 'image']), new File(['a'], 'ещё.png', { type: 'image/png' }))).toBeUndefined()
    expect(attachmentLimitMessage(songWithAttachments(['audio']), new File(['a'], 'ещё.mp3', { type: 'audio/mpeg' }))).toContain('один MP3')
  })
})
