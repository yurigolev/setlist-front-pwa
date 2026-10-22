<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import {
  PhDownloadSimple,
  PhMusicNote,
  PhPause,
  PhPlay,
  PhSkipBack,
  PhX,
} from '@phosphor-icons/vue';
import type { Attachment } from '@/domain/song';
import { IndexedDbAttachmentFileRepository } from '@/repositories/attachmentFileRepository';

const props = withDefaults(
  defineProps<{
    attachments: Attachment[];
    userId?: string;
    setlistId?: string;
    mode?: 'view' | 'edit';
  }>(),
  { mode: 'view', userId: undefined, setlistId: undefined },
);
const emit = defineEmits<{ remove: [attachment: Attachment] }>();
const urls = ref<Record<string, string>>({});
const selectedIndex = ref(0);
const galleryOpen = ref(false);
const galleryPlayerId = useId();
const audioElement = ref<HTMLAudioElement>();
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const selectedAudioId = ref<string>();
const touchStart = ref<{ x: number; y: number }>();

let activeUrls: string[] = [];
let generation = 0;

const images = computed(() =>
  props.attachments.filter((attachment) => attachment.kind === 'image'),
);
const audioFiles = computed(() =>
  props.attachments.filter((attachment) => attachment.kind === 'audio'),
);
const audio = computed(
  () =>
    audioFiles.value.find((attachment) => attachment.id === selectedAudioId.value) ??
    audioFiles.value[0],
);
const selectedImage = computed(() => images.value[selectedIndex.value]);
const playbackPercent = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0,
);
const visibleImages = computed(() =>
  props.mode === 'view' ? images.value.slice(0, images.value.length > 4 ? 3 : 4) : images.value,
);

async function load(): Promise<void> {
  const current = ++generation;
  activeUrls.forEach((url) => URL.revokeObjectURL(url));
  activeUrls = [];
  urls.value = {};
  galleryOpen.value = false;
  selectedIndex.value = 0;
  audioElement.value?.pause();
  isPlaying.value = false;
  currentTime.value = 0;
  duration.value = 0;
  const nextUrls: Record<string, string> = {};
  await Promise.all(
    props.attachments.map(async (attachment) => {
      const file = await new IndexedDbAttachmentFileRepository(props.userId, props.setlistId).get(
        attachment.fileKey,
      );
      if (!file || current !== generation) return;
      const url = URL.createObjectURL(file);
      activeUrls.push(url);
      nextUrls[attachment.id] = url;
    }),
  );
  if (current === generation) urls.value = nextUrls;
}

function openGallery(index: number): void {
  selectedIndex.value = index;
  galleryOpen.value = true;
}
function closeGallery(): void {
  galleryOpen.value = false;
}
function showImage(index: number): void {
  selectedIndex.value = (index + images.value.length) % images.value.length;
}
function imageEdgeClick(event: MouseEvent): void {
  if (!images.value.length) return;
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  showImage(selectedIndex.value + (event.clientX - bounds.left < bounds.width / 2 ? -1 : 1));
}
function touchEnd(event: TouchEvent): void {
  const start = touchStart.value;
  const touch = event.changedTouches[0];
  touchStart.value = undefined;
  if (!start || !touch) return;
  const horizontalDistance = touch.clientX - start.x;
  const verticalDistance = touch.clientY - start.y;
  if (
    Math.abs(horizontalDistance) > 44 &&
    Math.abs(horizontalDistance) > Math.abs(verticalDistance)
  )
    showImage(selectedIndex.value + (horizontalDistance > 0 ? -1 : 1));
}
async function togglePlayback(): Promise<void> {
  const player = audioElement.value;
  if (!player) return;
  if (player.paused) {
    try {
      await player.play();
    } catch {
      isPlaying.value = false;
    }
  } else player.pause();
}
function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0:00';
  return `${Math.floor(value / 60)}:${Math.floor(value % 60)
    .toString()
    .padStart(2, '0')}`;
}
function seek(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (audioElement.value) audioElement.value.currentTime = value;
  currentTime.value = value;
}
function restartPlayback(): void {
  if (audioElement.value) audioElement.value.currentTime = 0;
  currentTime.value = 0;
}
function selectAudio(attachment: Attachment): void {
  if (attachment.id === audio.value?.id || !urls.value[attachment.id]) return;
  audioElement.value?.pause();
  isPlaying.value = false;
  currentTime.value = 0;
  duration.value = 0;
  selectedAudioId.value = attachment.id;
}
function audioMetadata(attachment: Attachment): string {
  const format = attachment.name.split('.').pop()?.toUpperCase() || 'Аудио';
  if (attachment.id === audio.value?.id && duration.value)
    return `${format} · ${formatTime(duration.value)}`;
  if (attachment.byteSize)
    return `${format} · ${(attachment.byteSize / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
  return format;
}

watch(() => [props.attachments, props.userId, props.setlistId], load, {
  deep: true,
  immediate: true,
  flush: 'sync',
});
watch(galleryOpen, async (isOpen) => {
  document.body.classList.toggle('gallery-is-open', isOpen);
  if (isOpen) await nextTick();
});
onBeforeUnmount(() => {
  generation++;
  activeUrls.forEach((url) => URL.revokeObjectURL(url));
  document.body.classList.remove('gallery-is-open');
});
</script>

<template>
  <section
    v-if="mode === 'view' || attachments.length"
    class="attachments"
    :class="`attachments--${mode}`"
    aria-label="Вложения"
  >
    <div v-if="mode === 'view'" class="attachments__title">
      <h2 class="attachments__heading">Файлы</h2>
      <span v-if="attachments.length">{{ attachments.length }}</span>
    </div>
    <h3 v-if="mode === 'view' && images.length" class="attachments__subheading">
      Изображения · {{ images.length }}
    </h3>
    <div
      v-if="images.length || (mode === 'edit' && audio)"
      class="attachment-grid"
      :style="
        mode === 'view'
          ? {
              '--preview-count':
                visibleImages.length + (images.length > visibleImages.length ? 1 : 0),
            }
          : undefined
      "
    >
      <div v-for="(image, index) in visibleImages" :key="image.id" class="image-preview-wrap">
        <button
          class="image-preview"
          type="button"
          :aria-label="`Открыть скриншот ${index + 1}: ${image.name}`"
          @click="openGallery(index)"
        >
          <img v-if="urls[image.id]" :src="urls[image.id]" :alt="`Скрин аккордов: ${image.name}`" />
        </button>
        <button
          v-if="mode === 'edit'"
          class="attachment-remove"
          type="button"
          :aria-label="`Удалить ${image.name}`"
          @click="emit('remove', image)"
        >
          <PhX :size="16" weight="bold" />
        </button>
      </div>
      <button
        v-if="mode === 'view' && images.length > visibleImages.length"
        class="attachment-overflow"
        type="button"
        :aria-label="`Показать ещё ${images.length - visibleImages.length} скриншотов`"
        @click="openGallery(visibleImages.length)"
      >
        +{{ images.length - visibleImages.length }}
      </button>
      <div v-if="mode === 'edit' && audio" class="attachment-audio-card">
        <PhMusicNote :size="30" weight="fill" aria-hidden="true" />
        <span
          ><strong>{{ audio.name }}</strong
          ><small>{{ duration ? formatTime(duration) : 'MP3-плейбэк' }}</small></span
        >
        <button
          class="attachment-remove"
          type="button"
          :aria-label="`Удалить ${audio.name}`"
          @click="emit('remove', audio)"
        >
          <PhX :size="17" weight="bold" />
        </button>
        <audio
          v-if="urls[audio.id]"
          :src="urls[audio.id]"
          preload="metadata"
          @loadedmetadata="duration = $event.currentTarget.duration"
        />
      </div>
    </div>
    <template v-if="mode === 'view' && audioFiles.length">
      <h3 class="attachments__subheading attachments__subheading--audio">
        Аудио · {{ audioFiles.length }}
      </h3>
      <ul class="attachment-audio-list" aria-label="Аудиофайлы">
        <li
          v-for="file in audioFiles"
          :key="file.id"
          class="attachment-audio-row"
          :class="{ 'attachment-audio-row--selected': audio?.id === file.id }"
        >
          <button
            type="button"
            class="attachment-audio-select"
            :aria-label="`Выбрать аудио: ${file.name}`"
            :aria-pressed="audio?.id === file.id"
            :disabled="!urls[file.id]"
            @click="selectAudio(file)"
          >
            <span class="attachment-audio-icon"
              ><PhMusicNote :size="24" weight="fill" aria-hidden="true"
            /></span>
            <span class="attachment-audio-copy"
              ><strong>{{ file.name }}</strong
              ><small>{{ urls[file.id] ? audioMetadata(file) : 'Файл недоступен' }}</small></span
            >
          </button>
          <a
            v-if="urls[file.id]"
            class="attachment-audio-download"
            :href="urls[file.id]"
            :download="file.name"
            :aria-label="`Скачать ${file.name}`"
            ><PhDownloadSimple :size="24" aria-hidden="true"
          /></a>
        </li>
      </ul>
    </template>
    <p v-if="mode === 'view' && !attachments.length" class="muted">Вложений пока нет.</p>
  </section>

  <Teleport to="body">
    <section
      v-show="galleryOpen && selectedImage"
      class="gallery-viewer"
      :role="galleryOpen ? 'dialog' : undefined"
      :aria-modal="galleryOpen ? true : undefined"
      aria-label="Полноэкранный просмотр скриншотов"
      @keydown.escape="closeGallery"
    >
      <header class="gallery-viewer__header">
        <button
          type="button"
          class="icon-button"
          aria-label="Закрыть галерею"
          @click="closeGallery"
        >
          <PhX :size="32" weight="bold" /></button
        ><strong>{{ selectedIndex + 1 }} из {{ images.length }}</strong>
        <a
          v-if="mode === 'view' && selectedImage && urls[selectedImage.id]"
          class="icon-button"
          :href="urls[selectedImage.id]"
          :download="selectedImage.name"
          :aria-label="`Скачать ${selectedImage.name}`"
          ><PhDownloadSimple :size="26" aria-hidden="true"
        /></a>
      </header>
      <div
        class="gallery-stage"
        tabindex="0"
        aria-label="Нажмите на левую или правую часть изображения для перехода; также можно свайпнуть"
        @click="imageEdgeClick"
        @touchstart="touchStart = { x: $event.touches[0].clientX, y: $event.touches[0].clientY }"
        @touchend="touchEnd"
      >
        <img
          v-if="selectedImage && urls[selectedImage.id]"
          :src="urls[selectedImage.id]"
          :alt="`Скрин аккордов: ${selectedImage.name}`"
        /><span class="stage-edge stage-edge--previous" aria-hidden="true">Назад</span
        ><span class="stage-edge stage-edge--next" aria-hidden="true">Далее</span>
      </div>
      <p class="viewer-hint">Свайпните или нажмите на край</p>
      <div :id="galleryPlayerId" class="gallery-player-slot" />
    </section>
  </Teleport>
  <!-- Keep the media element in place so moving controls never interrupts playback. -->
  <audio
    v-if="mode === 'view' && audio && urls[audio.id]"
    :key="audio.id"
    ref="audioElement"
    hidden
    :src="urls[audio.id]"
    preload="metadata"
    @loadedmetadata="duration = $event.currentTarget.duration"
    @timeupdate="currentTime = $event.currentTarget.currentTime"
    @play="isPlaying = true"
    @pause="isPlaying = false"
    @ended="isPlaying = false"
  />
  <Teleport :to="`#${galleryPlayerId}`" :disabled="!galleryOpen" defer>
    <section
      v-if="mode === 'view' && audio && urls[audio.id]"
      class="audio-player"
      :class="{ 'gallery-player': galleryOpen }"
      aria-label="Плейбэк"
    >
      <button
        class="player-toggle"
        type="button"
        :aria-label="isPlaying ? 'Поставить на паузу' : 'Воспроизвести плейбэк'"
        @click="togglePlayback"
      >
        <PhPause v-if="isPlaying" :size="31" weight="fill" /><PhPlay
          v-else
          :size="31"
          weight="fill"
        />
      </button>
      <div class="player-content">
        <strong>{{ audio.name }}</strong>
        <div class="player-progress">
          <span>{{ formatTime(currentTime) }}</span
          ><input
            type="range"
            min="0"
            :max="duration || 0"
            step="0.1"
            :value="currentTime"
            aria-label="Позиция воспроизведения"
            :style="{ '--progress': `${playbackPercent}%` }"
            @input="seek"
          /><span>-{{ formatTime(Math.max(duration - currentTime, 0)) }}</span>
        </div>
      </div>
      <button
        class="player-restart"
        type="button"
        aria-label="Начать заново"
        title="Начать заново"
        @click="restartPlayback"
      >
        <PhSkipBack :size="28" weight="fill" aria-hidden="true" />
      </button>
    </section>
  </Teleport>
</template>

<style scoped>
.attachments__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.attachments__title .attachments__heading {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.3;
}
.attachments__title > span {
  color: var(--muted-strong);
  font-size: 0.9rem;
}
.attachments__subheading {
  margin: 0 0 8px;
  color: var(--muted-strong);
  font-size: 0.85rem;
  line-height: 1.4;
  font-weight: 500;
}
.attachments__subheading--audio {
  margin-top: 24px;
}
.attachments--view .attachment-grid {
  gap: 7px;
}
.attachments--view .image-preview,
.attachments--view .attachment-overflow {
  height: clamp(76px, 22vw, 140px);
  min-height: 0;
  border-radius: 10px;
}
.attachments--view .image-preview img {
  object-fit: contain;
}
.attachments--view .attachment-overflow {
  font-size: 1.35rem;
}
.attachment-audio-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.attachment-audio-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border-soft);
}
.attachment-audio-select {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 12px;
  min-width: 0;
  min-height: 56px;
  padding: 8px 0;
  border: 0;
  color: var(--foreground);
  background: transparent;
  text-align: left;
}
.attachment-audio-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--surface-raised);
  color: var(--ring);
}
.attachment-audio-copy {
  display: block;
  min-width: 0;
}
.attachment-audio-copy strong {
  display: block;
  font-size: 0.85rem;
  font-weight: 550;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.attachment-audio-copy small {
  display: block;
  margin-top: 3px;
  color: var(--muted-strong);
  font-size: 0.8rem;
}
.attachment-audio-row--selected strong {
  color: var(--ring);
}
.attachment-audio-download {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: var(--muted-strong);
}
.attachment-audio-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.attachment-audio-select:hover:not(:disabled),
.attachment-audio-download:hover {
  color: var(--ring);
}
.attachment-audio-select:focus-visible,
.attachment-audio-download:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
</style>
