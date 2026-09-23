import { createApp, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Attachment } from '@/domain/song'
import AttachmentList from './AttachmentList.vue'

const get = vi.fn<(fileKey: string) => Promise<Blob | undefined>>()

vi.mock('@/repositories/attachmentFileRepository', () => ({
  IndexedDbAttachmentFileRepository: class {
    get(fileKey: string): Promise<Blob | undefined> { return get(fileKey) }
  },
}))

const attachments: Attachment[] = [
  { id: 'image-1', songId: 'song-1', kind: 'image', name: 'chords.png', mimeType: 'image/png', fileKey: 'image-file', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'audio-1', songId: 'song-1', kind: 'audio', name: 'playback.mp3', mimeType: 'audio/mpeg', fileKey: 'audio-file', createdAt: '2026-01-01T00:00:00.000Z' },
]

let host: HTMLDivElement
let unmount: (() => void) | undefined

beforeEach(async () => {
  get.mockImplementation(async (fileKey) => new Blob([fileKey], { type: fileKey === 'audio-file' ? 'audio/mpeg' : 'image/png' }))
  vi.stubGlobal('URL', { createObjectURL: vi.fn((fileKey: Blob) => `blob:${fileKey.type}`), revokeObjectURL: vi.fn() })
  host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(AttachmentList, { attachments }) })
  app.mount(host)
  unmount = () => app.unmount()
  await Promise.resolve()
  await nextTick()
})

afterEach(() => {
  unmount?.()
  host.remove()
  document.body.classList.remove('gallery-is-open')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AttachmentList', () => {
  it('показывает закреплённый бабл плеера и запускает воспроизведение', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const player = host.querySelector<HTMLElement>('.audio-player')

    expect(player).not.toBeNull()
    expect(player?.querySelector('strong')?.textContent).toBe('playback.mp3')
    player?.querySelector<HTMLButtonElement>('.player-toggle')?.click()
    await nextTick()
    expect(play).toHaveBeenCalledOnce()
  })

  it('открывает и закрывает полноэкранный просмотр скриншота', async () => {
    host.querySelector<HTMLButtonElement>('.image-preview')?.click()
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.body.classList.contains('gallery-is-open')).toBe(true)
    expect(host.querySelector<HTMLElement>('.audio-player')?.style.display).toBe('none')
    expect(document.querySelector<HTMLElement>('.gallery-player')).not.toBeNull()
    expect(document.querySelector('.gallery-thumbnails')).toBeNull()

    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    document.querySelector<HTMLButtonElement>('.gallery-player .player-toggle')?.click()
    await nextTick()
    expect(play).toHaveBeenCalledOnce()

    document.querySelector<HTMLButtonElement>('.gallery-viewer .icon-button')?.click()
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.classList.contains('gallery-is-open')).toBe(false)
    expect(host.querySelector<HTMLElement>('.audio-player')?.style.display).toBe('')
  })

  it('в форме показывает аудио как вложение без закреплённого плеера', async () => {
    unmount?.()
    const app = createApp({ render: () => h(AttachmentList, { attachments, mode: 'edit' }) })
    app.mount(host)
    unmount = () => app.unmount()
    await Promise.resolve()
    await nextTick()

    expect(host.querySelector('.audio-player')).toBeNull()
    expect(host.querySelector('.attachment-audio-card')?.textContent).toContain('playback.mp3')
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Удалить playback.mp3"]')).not.toBeNull()
  })

  it('задаёт число равных ячеек для ряда превью', () => {
    const grid = host.querySelector<HTMLElement>('.attachments--view .attachment-grid')

    expect(grid?.style.getPropertyValue('--preview-count')).toBe('1')
  })
})
