<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { PhListBullets, PhMusicNote, PhPause, PhPlay, PhX } from '@phosphor-icons/vue'
import type { Attachment } from '@/domain/song'
import { IndexedDbAttachmentFileRepository } from '@/repositories/attachmentFileRepository'

const props = withDefaults(defineProps<{ attachments: Attachment[]; mode?: 'view' | 'edit' }>(), { mode: 'view' })
const emit = defineEmits<{ remove: [attachment: Attachment] }>()
const urls = ref<Record<string, string>>({})
const selectedIndex = ref(0)
const galleryOpen = ref(false)
const audioElement = ref<HTMLAudioElement>()
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const touchStart = ref<{ x: number; y: number }>()
const files = new IndexedDbAttachmentFileRepository()
let activeUrls: string[] = []

const images = computed(() => props.attachments.filter((attachment) => attachment.kind === 'image'))
const audio = computed(() => props.attachments.find((attachment) => attachment.kind === 'audio'))
const selectedImage = computed(() => images.value[selectedIndex.value])
const playbackPercent = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0)
const visibleImages = computed(() => props.mode === 'view' ? images.value.slice(0, 4) : images.value)

async function load(): Promise<void> {
  activeUrls.forEach((url) => URL.revokeObjectURL(url))
  activeUrls = []
  const nextUrls: Record<string, string> = {}
  await Promise.all(props.attachments.map(async (attachment) => {
    const file = await files.get(attachment.fileKey)
    if (!file) return
    const url = URL.createObjectURL(file)
    activeUrls.push(url)
    nextUrls[attachment.id] = url
  }))
  urls.value = nextUrls
}

function openGallery(index: number): void { selectedIndex.value = index; galleryOpen.value = true }
function closeGallery(): void { galleryOpen.value = false }
function showImage(index: number): void { selectedIndex.value = (index + images.value.length) % images.value.length }
function imageEdgeClick(event: MouseEvent): void {
  if (!images.value.length) return
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  showImage(selectedIndex.value + (event.clientX - bounds.left < bounds.width / 2 ? -1 : 1))
}
function touchEnd(event: TouchEvent): void {
  const start = touchStart.value
  const touch = event.changedTouches[0]
  touchStart.value = undefined
  if (!start || !touch) return
  const horizontalDistance = touch.clientX - start.x
  const verticalDistance = touch.clientY - start.y
  if (Math.abs(horizontalDistance) > 44 && Math.abs(horizontalDistance) > Math.abs(verticalDistance)) showImage(selectedIndex.value + (horizontalDistance > 0 ? -1 : 1))
}
async function togglePlayback(): Promise<void> {
  const player = audioElement.value
  if (!player) return
  if (player.paused) { try { await player.play() } catch { isPlaying.value = false } } else player.pause()
}
function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0:00'
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`
}
function seek(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (audioElement.value) audioElement.value.currentTime = value
  currentTime.value = value
}
function showAttachments(): void { document.querySelector('.attachments--view')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

watch(() => props.attachments, load, { deep: true, immediate: true })
watch(galleryOpen, async (isOpen) => { document.body.classList.toggle('gallery-is-open', isOpen); if (isOpen) await nextTick() })
onBeforeUnmount(() => { activeUrls.forEach((url) => URL.revokeObjectURL(url)); document.body.classList.remove('gallery-is-open') })
</script>

<template>
  <section v-if="mode === 'view' || attachments.length" class="attachments" :class="`attachments--${mode}`" aria-label="Вложения">
    <h2 v-if="mode === 'view'" class="attachments__heading">Вложения</h2>
    <div
      v-if="images.length || (mode === 'edit' && audio)"
      class="attachment-grid"
      :style="mode === 'view' ? { '--preview-count': visibleImages.length + (images.length > visibleImages.length ? 1 : 0) } : undefined"
    >
      <div v-for="(image, index) in visibleImages" :key="image.id" class="image-preview-wrap">
        <button class="image-preview" type="button" :aria-label="`Открыть скриншот ${index + 1}: ${image.name}`" @click="openGallery(index)"><img v-if="urls[image.id]" :src="urls[image.id]" :alt="`Скрин аккордов: ${image.name}`" /></button>
        <button v-if="mode === 'edit'" class="attachment-remove" type="button" :aria-label="`Удалить ${image.name}`" @click="emit('remove', image)"><PhX :size="16" weight="bold" /></button>
      </div>
      <button v-if="mode === 'view' && images.length > 4" class="attachment-overflow" type="button" :aria-label="`Показать ещё ${images.length - 4} скриншотов`" @click="openGallery(4)">+{{ images.length - 4 }}</button>
      <div v-if="mode === 'edit' && audio" class="attachment-audio-card">
        <PhMusicNote :size="30" weight="fill" aria-hidden="true" />
        <span><strong>{{ audio.name }}</strong><small>{{ duration ? formatTime(duration) : 'MP3-плейбэк' }}</small></span>
        <button class="attachment-remove" type="button" :aria-label="`Удалить ${audio.name}`" @click="emit('remove', audio)"><PhX :size="17" weight="bold" /></button>
        <audio v-if="urls[audio.id]" :src="urls[audio.id]" preload="metadata" @loadedmetadata="duration = $event.currentTarget.duration" />
      </div>
    </div>
    <p v-if="mode === 'view' && !attachments.length" class="muted">Вложений пока нет.</p>
  </section>

  <section v-if="mode === 'view' && audio && urls[audio.id]" v-show="!galleryOpen" class="audio-player" aria-label="Плейбэк">
    <audio ref="audioElement" :src="urls[audio.id]" preload="metadata" @loadedmetadata="duration = $event.currentTarget.duration" @timeupdate="currentTime = $event.currentTarget.currentTime" @play="isPlaying = true" @pause="isPlaying = false" @ended="isPlaying = false" />
    <button class="player-toggle" type="button" :aria-label="isPlaying ? 'Поставить на паузу' : 'Воспроизвести плейбэк'" @click="togglePlayback"><PhPause v-if="isPlaying" :size="31" weight="fill" /><PhPlay v-else :size="31" weight="fill" /></button>
    <div class="player-content"><strong>{{ audio.name }}</strong><div class="player-progress"><span>{{ formatTime(currentTime) }}</span><input type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime" aria-label="Позиция воспроизведения" :style="{ '--progress': `${playbackPercent}%` }" @input="seek" /><span>-{{ formatTime(Math.max(duration - currentTime, 0)) }}</span></div></div>
    <button class="player-more" type="button" aria-label="Перейти к вложениям" @click="showAttachments"><PhListBullets :size="28" weight="regular" /></button>
  </section>

  <Teleport to="body">
    <section v-if="galleryOpen && selectedImage" class="gallery-viewer" role="dialog" aria-modal="true" aria-label="Полноэкранный просмотр скриншотов" @keydown.escape="closeGallery">
      <header class="gallery-viewer__header"><button type="button" class="icon-button" aria-label="Закрыть галерею" @click="closeGallery"><PhX :size="32" weight="bold" /></button><strong>{{ selectedIndex + 1 }} из {{ images.length }}</strong></header>
      <div class="gallery-stage" tabindex="0" aria-label="Нажмите на левую или правую часть изображения для перехода; также можно свайпнуть" @click="imageEdgeClick" @touchstart="touchStart = { x: $event.touches[0].clientX, y: $event.touches[0].clientY }" @touchend="touchEnd">
        <img v-if="urls[selectedImage.id]" :src="urls[selectedImage.id]" :alt="`Скрин аккордов: ${selectedImage.name}`" /><span class="stage-edge stage-edge--previous" aria-hidden="true">Назад</span><span class="stage-edge stage-edge--next" aria-hidden="true">Далее</span>
      </div>
      <p class="viewer-hint">Свайпните или нажмите на край</p>
      <section v-if="audio && urls[audio.id]" class="gallery-player" aria-label="Плейбэк">
        <button class="player-toggle" type="button" :aria-label="isPlaying ? 'Поставить на паузу' : 'Воспроизвести плейбэк'" @click="togglePlayback"><PhPause v-if="isPlaying" :size="31" weight="fill" /><PhPlay v-else :size="31" weight="fill" /></button>
        <div class="player-content"><strong>{{ audio.name }}</strong><div class="player-progress"><span>{{ formatTime(currentTime) }}</span><input type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime" aria-label="Позиция воспроизведения" :style="{ '--progress': `${playbackPercent}%` }" @input="seek" /><span>-{{ formatTime(Math.max(duration - currentTime, 0)) }}</span></div></div>
      </section>
    </section>
  </Teleport>
</template>
