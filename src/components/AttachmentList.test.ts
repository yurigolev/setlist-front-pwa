import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Attachment } from '@/domain/song';
import AttachmentList from './AttachmentList.vue';

const get = vi.fn<(fileKey: string) => Promise<Blob | undefined>>();

vi.mock('@/repositories/attachmentFileRepository', () => ({
  IndexedDbAttachmentFileRepository: class {
    get(fileKey: string): Promise<Blob | undefined> {
      return get(fileKey);
    }
  },
}));

const attachments: Attachment[] = [
  {
    id: 'image-1',
    songId: 'song-1',
    kind: 'image',
    name: 'chords.png',
    mimeType: 'image/png',
    fileKey: 'image-file',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'audio-1',
    songId: 'song-1',
    kind: 'audio',
    name: 'playback.mp3',
    mimeType: 'audio/mpeg',
    fileKey: 'audio-file',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

let host: HTMLDivElement;
let unmount: (() => void) | undefined;

async function mountAttachments(items: Attachment[]): Promise<void> {
  unmount?.();
  const app = createApp({ render: () => h(AttachmentList, { attachments: items }) });
  app.mount(host);
  unmount = () => app.unmount();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

beforeEach(async () => {
  get.mockImplementation(
    async (fileKey) =>
      new Blob([fileKey], { type: fileKey === 'audio-file' ? 'audio/mpeg' : 'image/png' }),
  );
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((fileKey: Blob) => `blob:${fileKey.type}`),
    revokeObjectURL: vi.fn(),
  });
  host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(AttachmentList, { attachments }) });
  app.mount(host);
  unmount = () => app.unmount();
  await Promise.resolve();
  await nextTick();
});

afterEach(() => {
  unmount?.();
  host.remove();
  document.body.classList.remove('gallery-is-open');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AttachmentList', () => {
  it('показывает закреплённый бабл плеера и запускает воспроизведение', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const player = host.querySelector<HTMLElement>('.audio-player');

    expect(player).not.toBeNull();
    expect(player?.querySelector('strong')?.textContent).toBe('playback.mp3');
    player?.querySelector<HTMLButtonElement>('.player-toggle')?.click();
    await nextTick();
    expect(play).toHaveBeenCalledOnce();
  });

  it('открывает и закрывает полноэкранный просмотр скриншота', async () => {
    host.querySelector<HTMLButtonElement>('.image-preview')?.click();
    await nextTick();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.classList.contains('gallery-is-open')).toBe(true);
    expect(host.querySelector('.audio-player')).toBeNull();
    expect(document.querySelectorAll('.audio-player')).toHaveLength(1);
    expect(document.querySelector<HTMLElement>('.gallery-player')).not.toBeNull();
    expect(document.querySelector('.gallery-thumbnails')).toBeNull();

    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    document.querySelector<HTMLButtonElement>('.gallery-player .player-toggle')?.click();
    await nextTick();
    expect(play).toHaveBeenCalledOnce();

    document.querySelector<HTMLButtonElement>('.gallery-viewer .icon-button')?.click();
    await nextTick();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.classList.contains('gallery-is-open')).toBe(false);
    expect(host.querySelector('.audio-player')).not.toBeNull();
  });

  it('в форме показывает аудио как вложение без закреплённого плеера', async () => {
    unmount?.();
    const app = createApp({ render: () => h(AttachmentList, { attachments, mode: 'edit' }) });
    app.mount(host);
    unmount = () => app.unmount();
    await Promise.resolve();
    await nextTick();

    expect(host.querySelector('.audio-player')).toBeNull();
    expect(host.querySelector('.attachment-audio-card')?.textContent).toContain('playback.mp3');
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Удалить playback.mp3"]'),
    ).not.toBeNull();
  });

  it('задаёт число равных ячеек для ряда превью', () => {
    const grid = host.querySelector<HTMLElement>('.attachments--view .attachment-grid');

    expect(grid?.style.getPropertyValue('--preview-count')).toBe('1');
  });

  it('ограничивает восемь изображений тремя превью и открывает скрытые изображения', async () => {
    const images = Array.from({ length: 8 }, (_, index) => ({
      ...attachments[0]!,
      id: `image-${index}`,
      name: `image-${index}.png`,
    }));
    await mountAttachments(images);
    expect(host.querySelectorAll('.image-preview')).toHaveLength(3);
    expect(host.querySelector('.attachment-overflow')?.textContent?.trim()).toBe('+5');
    expect(
      host
        .querySelector<HTMLElement>('.attachment-grid')
        ?.style.getPropertyValue('--preview-count'),
    ).toBe('4');

    host.querySelector<HTMLButtonElement>('.attachment-overflow')?.click();
    await nextTick();
    expect(document.querySelector('.gallery-viewer__header strong')?.textContent).toBe('4 из 8');
    expect(document.querySelector('.gallery-stage img')?.getAttribute('alt')).toContain(
      'image-3.png',
    );
  });

  it('меняет аудиофайл и сохраняет тот же плеер при открытии и закрытии галереи', async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const second = {
      ...attachments[1]!,
      id: 'audio-2',
      name: 'rehearsal.mp3',
      fileKey: 'audio-file-2',
    };
    await mountAttachments([...attachments, second]);
    expect(host.querySelectorAll('.attachment-audio-row')).toHaveLength(2);

    host.querySelectorAll<HTMLButtonElement>('.attachment-audio-select')[1]?.click();
    await nextTick();
    expect(pause).toHaveBeenCalled();
    expect(host.querySelector('.audio-player strong')?.textContent).toBe(second.name);
    expect(host.querySelectorAll('.attachment-audio-select')[1]?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    const player = host.querySelector('.audio-player')!;
    const element = host.querySelector('audio')!;
    Object.defineProperty(element, 'duration', { value: 240, configurable: true });
    element.currentTime = 42;
    element.dispatchEvent(new Event('loadedmetadata'));
    element.dispatchEvent(new Event('timeupdate'));
    element.dispatchEvent(new Event('play'));
    await nextTick();

    host.querySelector<HTMLButtonElement>('.image-preview')?.click();
    await nextTick();
    expect(document.querySelector('.gallery-player')).toBe(player);
    expect(document.querySelector('.gallery-player strong')?.textContent).toBe(second.name);
    expect(document.querySelector<HTMLInputElement>('.gallery-player input')?.value).toBe('42');
    expect(
      document.querySelector('.gallery-player [aria-label="Поставить на паузу"]'),
    ).not.toBeNull();
    expect(host.querySelector('audio')).toBe(element);

    document.querySelector<HTMLButtonElement>('.gallery-viewer .icon-button')?.click();
    await nextTick();
    expect(host.querySelector('.audio-player')).toBe(player);
    expect(host.querySelector('audio')).toBe(element);
    expect(host.querySelector<HTMLInputElement>('.audio-player input')?.value).toBe('42');
    host.querySelector<HTMLButtonElement>('.player-toggle')?.click();
    await nextTick();
    expect(play).toHaveBeenCalledOnce();
  });

  it('возвращает к началу на странице и в галерее, сохраняя состояние воспроизведения', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const element = host.querySelector('audio')!;
    Object.defineProperty(element, 'duration', { value: 240, configurable: true });
    element.dispatchEvent(new Event('loadedmetadata'));
    element.currentTime = 42;
    element.dispatchEvent(new Event('timeupdate'));
    await nextTick();

    host.querySelector<HTMLButtonElement>('[aria-label="Начать заново"]')!.click();
    await nextTick();
    expect(element.currentTime).toBe(0);
    expect(host.querySelector<HTMLInputElement>('.audio-player input')?.value).toBe('0');
    expect(host.querySelector('[aria-label="Воспроизвести плейбэк"]')).not.toBeNull();

    element.currentTime = 90;
    element.dispatchEvent(new Event('timeupdate'));
    element.dispatchEvent(new Event('play'));
    host.querySelector<HTMLButtonElement>('.image-preview')!.click();
    await nextTick();
    document
      .querySelector<HTMLButtonElement>('.gallery-player [aria-label="Начать заново"]')!
      .click();
    await nextTick();
    expect(element.currentTime).toBe(0);
    expect(document.querySelector<HTMLInputElement>('.gallery-player input')?.value).toBe('0');
    expect(
      document.querySelector('.gallery-player [aria-label="Поставить на паузу"]'),
    ).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it('не позволяет выбрать недоступный аудиофайл и сохраняет скачивание изображений', async () => {
    get.mockImplementation(async (key) => (key === 'missing' ? undefined : new Blob([key])));
    await mountAttachments([
      ...attachments,
      { ...attachments[1]!, id: 'missing', fileKey: 'missing', name: 'missing.mp3' },
    ]);
    expect(host.querySelectorAll<HTMLButtonElement>('.attachment-audio-select')[1]?.disabled).toBe(
      true,
    );
    host.querySelector<HTMLButtonElement>('.image-preview')?.click();
    await nextTick();
    expect(document.querySelector('.gallery-viewer a[download]')?.getAttribute('download')).toBe(
      'chords.png',
    );
    expect(document.querySelector('.gallery-viewer a[download]')?.getAttribute('href')).toMatch(
      /^blob:/,
    );
    expect(host.querySelectorAll('.attachment-audio-download')).toHaveLength(1);
  });
});
