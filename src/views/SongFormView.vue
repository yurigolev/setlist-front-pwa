<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSongsStore } from '@/stores/songs'
import { PhArrowLeft, PhDotsThreeVertical, PhPlus, PhX } from '@phosphor-icons/vue'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import AppBottomNav from '@/components/AppBottomNav.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppField from '@/components/ui/AppField.vue'
import AttachmentList from '@/components/AttachmentList.vue'
import type { Attachment, Song } from '@/domain/song'
import { IndexedDbAttachmentFileRepository } from '@/repositories/attachmentFileRepository'
import { attachmentKind, attachmentValidationMessage } from '@/services/attachments'

const props = defineProps<{ id?: string }>()
const songsStore = useSongsStore()
const router = useRouter()
const song = ref<Song>()
const title = ref('')
const artist = ref('')
const content = ref('')
const error = ref('')
const isSaving = ref(false)
const fileInput = ref<HTMLInputElement>()
const attachmentMessages = ref<string[]>([])
const isEdit = computed(() => Boolean(props.id))
const removedIds = ref<string[]>([])
const pendingFiles = ref<{ file: File; url?: string }[]>([])
const visibleAttachments = computed(() => song.value?.attachments.filter((item) => !removedIds.value.includes(item.id)) ?? [])

onBeforeUnmount(() => pendingFiles.value.forEach(({ url }) => { if (url) URL.revokeObjectURL(url) }))

async function load(): Promise<void> {
  if (!props.id) return
  song.value = await songsStore.get(props.id)
  if (!song.value) { await router.replace('/'); return }
  title.value = song.value.title
  artist.value = song.value.artist ?? ''
  content.value = song.value.content ?? ''
}

async function save(): Promise<void> {
  error.value = ''
  if (!title.value.trim()) { error.value = 'Укажите название песни.'; return }
  isSaving.value = true
  try {
    let savedSong = isEdit.value && song.value
      ? await songsStore.update({ ...song.value, title: title.value, artist: artist.value, content: content.value, attachments: visibleAttachments.value })
      : await songsStore.create({ title: title.value, artist: artist.value, content: content.value })
    if (song.value && removedIds.value.length) {
      const files = new IndexedDbAttachmentFileRepository()
      await Promise.all(song.value.attachments.filter((item) => removedIds.value.includes(item.id)).map((item) => files.remove(item.fileKey).catch((cause) => {
        console.warn('Не удалось очистить файл удалённого вложения', cause)
      })))
    }
    song.value = savedSong
    removedIds.value = []
    while (pendingFiles.value.length) {
      const item = pendingFiles.value[0]
      savedSong = await songsStore.addAttachment(savedSong, item.file)
      song.value = savedSong
      if (item.url) URL.revokeObjectURL(item.url)
      pendingFiles.value.shift()
    }
    await router.replace(`/songs/${savedSong.id}`)
  } catch (cause) {
    console.error('Не удалось сохранить песню', cause)
    error.value = 'Не удалось сохранить песню. Повторите попытку.'
  } finally { isSaving.value = false }
}
async function addFiles(files: File[]): Promise<void> {
  if (!song.value) return
  attachmentMessages.value = []
  for (const file of files) {
    const validation = attachmentValidationMessage(file)
    if (validation) { attachmentMessages.value.push(validation); continue }
    if (attachmentKind(file) === 'audio' && (visibleAttachments.value.some((item) => item.kind === 'audio') || pendingFiles.value.some((item) => attachmentKind(item.file) === 'audio'))) {
      attachmentMessages.value.push('Для песни можно добавить только один MP3-плейбэк.')
      continue
    }
    pendingFiles.value.push({ file, url: attachmentKind(file) === 'image' ? URL.createObjectURL(file) : undefined })
  }
}
async function removeFile(attachment: Attachment): Promise<void> {
  removedIds.value.push(attachment.id)
}
function removePending(index: number): void {
  const item = pendingFiles.value[index]
  if (item?.url) URL.revokeObjectURL(item.url)
  pendingFiles.value.splice(index, 1)
}
async function chooseFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  await addFiles(Array.from(input.files ?? [])); input.value = ''
}
function openFilePicker(): void { fileInput.value?.click() }
function handlePaste(event: ClipboardEvent): void {
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, [contenteditable="true"], [role="textbox"]'))) return
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  void addFiles(files)
}
function goBack(): void { void router.push(isEdit.value && song.value ? `/songs/${song.value.id}` : '/') }
onMounted(() => {
  window.addEventListener('paste', handlePaste)
  void load()
})
onUnmounted(() => window.removeEventListener('paste', handlePaste))
</script>

<template>
  <main class="app-page" :class="{ 'song-edit-page': isEdit }">
    <header class="app-header">
      <button class="app-header__back" type="button" aria-label="Назад" @click="goBack"><PhArrowLeft :size="30" weight="regular" /></button>
      <h1>{{ isEdit ? 'Редактирование' : 'Новая песня' }}</h1>
      <DropdownMenuRoot v-if="isEdit">
        <DropdownMenuTrigger as-child><button class="app-header__more" type="button" aria-label="Дополнительные действия"><PhDotsThreeVertical :size="30" weight="bold" /></button></DropdownMenuTrigger>
        <DropdownMenuPortal><DropdownMenuContent class="song-menu" :side-offset="8" align="end"><DropdownMenuItem class="song-menu__item" @select="goBack"><PhX :size="18" /> Отменить</DropdownMenuItem></DropdownMenuContent></DropdownMenuPortal>
      </DropdownMenuRoot>
      <span v-else class="app-header__spacer" />
    </header>
    <div class="page-content">
      <p v-if="!song && isEdit" class="muted">Загружаем песню…</p>
      <template v-else>
      <form novalidate @submit.prevent="save">
        <div class="form-list">
          <AppField id="song-title" v-model="title" label="Название" :invalid="Boolean(error)" required />
          <AppField id="song-artist" v-model="artist" label="Исполнитель" />
          <AppField id="song-content" v-model="content" label="Заметки" :multiline="true" :rows="14" />
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <section v-if="isEdit" class="edit-attachments" aria-labelledby="edit-attachments-heading">
          <h2 id="edit-attachments-heading">Вложения</h2>
          <div class="edit-attachments__grid">
            <AttachmentList v-if="song && visibleAttachments.length" mode="edit" :attachments="visibleAttachments" @remove="removeFile" />
            <div v-if="pendingFiles.length" class="pending-attachments" aria-label="Новые вложения">
              <div v-for="(item, index) in pendingFiles" :key="item.file.name + index" class="pending-attachment">
                <img v-if="item.url" :src="item.url" :alt="item.file.name" />
                <span v-else class="pending-attachment__audio">{{ item.file.name }}</span>
                <button class="attachment-remove" type="button" :aria-label="`Убрать ${item.file.name}`" @click="removePending(index)"><PhX :size="16" weight="bold" /></button>
              </div>
            </div>
            <button class="attachment-add" type="button" @click="openFilePicker"><span class="attachment-add__icon"><PhPlus :size="28" /></span><span><strong>Добавить</strong><small>Фото или MP3 с устройства</small></span></button>
          </div>
          <input ref="fileInput" class="file-input" type="file" accept="image/png,image/jpeg,image/webp,audio/mpeg,.mp3" multiple @change="chooseFiles" />
          <p v-for="message in attachmentMessages" :key="message" class="form-error" role="alert">{{ message }}</p>
        </section>
        <AppButton type="submit" :disabled="isSaving">{{ isSaving ? 'Сохраняем…' : (isEdit ? 'Сохранить изменения' : 'Сохранить песню') }}</AppButton>
      </form>
      </template>
    </div>
    <AppBottomNav />
  </main>
</template>
