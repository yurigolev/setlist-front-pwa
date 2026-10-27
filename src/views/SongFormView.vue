<script setup lang="ts">
import TagPicker from '@/components/TagPicker.vue';
import PageHeader from '@/components/PageHeader.vue';
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSongsStore } from '@/stores/songs';
import { PhDotsThreeVertical, PhPlus, PhX } from '@phosphor-icons/vue';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import AppButton from '@/components/ui/AppButton.vue';
import AppField from '@/components/ui/AppField.vue';
import AppBackButton from '@/components/ui/AppBackButton.vue';
import AttachmentList from '@/components/AttachmentList.vue';
import type { Attachment, Song } from '@/domain/song';
import { attachmentKind, attachmentValidationMessage } from '@/services/attachments';
import { createUuid } from '@/services/uuid';
import { ApiError, UnknownResultError, checkAttachment } from '@/services/libraryApi';

const props = defineProps<{ id?: string }>();
let alive = true;
const songsStore = useSongsStore();
const router = useRouter();
const song = ref<Song>();
const title = ref('');
const artist = ref('');
const content = ref('');
const tagIds = ref<string[]>([]);
const error = ref('');
const isSaving = ref(false);
const fileInput = ref<HTMLInputElement>();
const attachmentMessages = ref<string[]>([]);
const isEdit = computed(() => Boolean(props.id));
const removedIds = ref<string[]>([]);
const pendingFiles = ref<{ file: File; id: string; revision?: number; url?: string }[]>([]);
const createKey = ref(createUuid());
const partialSuccess = ref(false);
const textSaved = ref(false);
const retryText = ref(false);
const visibleAttachments = computed(
  () => song.value?.attachments.filter((item) => !removedIds.value.includes(item.id)) ?? [],
);

onBeforeUnmount(() => {
  alive = false;
  pendingFiles.value.forEach(({ url }) => {
    if (url) URL.revokeObjectURL(url);
  });
});

async function load(): Promise<void> {
  if (!props.id) {
    await songsStore.load();
    return;
  }
  if (!songsStore.songs.length) await songsStore.load();
  if (!alive) return;
  const loaded = await songsStore.get(props.id);
  if (!alive) return;
  song.value = loaded;
  if (!song.value) {
    await router.replace('/');
    return;
  }
  title.value = song.value.title;
  artist.value = song.value.artist ?? '';
  content.value = song.value.content ?? '';
  tagIds.value = [...(song.value.tagIds ?? [])];
}

async function save(): Promise<void> {
  if (!alive || isSaving.value || !songsStore.canWrite) return;
  error.value = '';
  if (!title.value.trim() || !artist.value.trim()) {
    error.value = 'Укажите название и исполнителя.';
    return;
  }
  if (!songsStore.online) {
    error.value = 'Для сохранения требуется интернет';
    return;
  }
  if (!textSaved.value) {
    for (const { file } of pendingFiles.value) {
      try {
        await checkAttachment(file);
        if (!alive || !songsStore.canWrite) return;
      } catch (cause) {
        if (alive) error.value = cause instanceof Error ? cause.message : 'Файл не прошёл проверку';
        return;
      }
    }
  }
  isSaving.value = true;
  try {
    let savedSong =
      textSaved.value && song.value
        ? song.value
        : isEdit.value && song.value
          ? await songsStore.update({
              ...song.value,
              title: title.value,
              artist: artist.value,
              content: content.value,
              tagIds: tagIds.value,
            })
          : await songsStore.create(
              {
                title: title.value,
                artist: artist.value,
                content: content.value,
                tagIds: tagIds.value,
              },
              createKey.value,
            );
    if (!alive) return;
    partialSuccess.value = true;
    textSaved.value = true;
    retryText.value = false;
    song.value = savedSong;
    while (removedIds.value.length) {
      savedSong = await songsStore.removeAttachment(savedSong, removedIds.value[0]);
      if (!alive) return;
      song.value = savedSong;
      removedIds.value.shift();
    }
    while (pendingFiles.value.length) {
      const item = pendingFiles.value[0];
      item.revision ??= savedSong.revision;
      savedSong = await songsStore.addAttachment(savedSong, item.file, item.id, item.revision);
      if (!alive) return;
      song.value = savedSong;
      if (item.url) URL.revokeObjectURL(item.url);
      pendingFiles.value.shift();
    }
    if (!alive) return;
    await router.replace(`/songs/${savedSong.id}`);
  } catch (cause) {
    if (!alive) return;
    console.error('Не удалось сохранить песню', cause);
    if (cause instanceof ApiError && cause.status === 409) {
      if (props.id) {
        const refreshed = await songsStore.get(props.id);
        if (!alive) return;
        song.value = refreshed;
      }
      error.value = 'Конфликт правок. Библиотека обновлена; проверьте изменения перед повтором.';
    } else if (cause instanceof UnknownResultError && !partialSuccess.value) {
      retryText.value = true;
      error.value =
        'Ответ сервера потерян. Проверьте актуальный снимок; повторите текст с прежним ключом.';
    } else if (cause instanceof UnknownResultError)
      error.value =
        'Ответ сервера потерян. Проверьте актуальный снимок и повторите оставшийся шаг с тем же UUID.';
    else
      error.value = partialSuccess.value
        ? 'Текст сохранён, но изменения файлов завершились с ошибкой. Повторите оставшиеся файлы.'
        : cause instanceof Error
          ? cause.message
          : 'Не удалось сохранить песню.';
    if (partialSuccess.value) {
      try {
        if (!alive) return;
        await songsStore.refresh();
        if (!alive) return;
        if (song.value) {
          const refreshed = await songsStore.get(song.value.id);
          if (!alive) return;
          song.value = refreshed ?? song.value;
        }
      } catch {
        /* сообщение о результате записи остаётся видимым */
      }
    }
  } finally {
    if (alive) isSaving.value = false;
  }
}
async function addFiles(files: File[]): Promise<void> {
  if (!alive || !songsStore.canWrite || isSaving.value) return;
  attachmentMessages.value = [];
  for (const file of files) {
    const validation = attachmentValidationMessage(file);
    if (validation) {
      attachmentMessages.value.push(validation);
      continue;
    }
    if (
      attachmentKind(file) === 'audio' &&
      (visibleAttachments.value.some((item) => item.kind === 'audio') ||
        pendingFiles.value.some((item) => attachmentKind(item.file) === 'audio'))
    ) {
      attachmentMessages.value.push('Для песни можно добавить только один MP3-плейбэк.');
      continue;
    }
    pendingFiles.value.push({
      file,
      id: createUuid(),
      url: attachmentKind(file) === 'image' ? URL.createObjectURL(file) : undefined,
    });
  }
}
async function removeFile(attachment: Attachment): Promise<void> {
  if (!alive || !songsStore.canWrite || isSaving.value) return;
  removedIds.value.push(attachment.id);
}
function removePending(index: number): void {
  if (!alive || !songsStore.canWrite || isSaving.value) return;
  const item = pendingFiles.value[index];
  if (item?.url) URL.revokeObjectURL(item.url);
  pendingFiles.value.splice(index, 1);
}
async function chooseFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  await addFiles(Array.from(input.files ?? []));
  input.value = '';
}
function handlePaste(event: ClipboardEvent): void {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"], [role="textbox"]'))
  )
    return;
  const files = Array.from(event.clipboardData?.files ?? []);
  if (!files.length) return;
  event.preventDefault();
  void addFiles(files);
}
function openFilePicker(): void {
  fileInput.value?.click();
}
function goBack(): void {
  void router.push(isEdit.value && song.value ? `/songs/${song.value.id}` : '/');
}
onMounted(() => {
  window.addEventListener('paste', handlePaste);
  void load();
});
onUnmounted(() => window.removeEventListener('paste', handlePaste));
</script>

<template>
  <main class="app-page" :class="{ 'song-edit-page': isEdit }">
    <PageHeader class="app-header" :title="isEdit ? 'Редактирование' : 'Новая песня'">
      <template #back><AppBackButton @click="goBack" /></template>
      <template #actions>
        <DropdownMenuRoot v-if="isEdit">
          <DropdownMenuTrigger as-child
            ><button class="app-header__more" type="button" aria-label="Дополнительные действия">
              <PhDotsThreeVertical :size="30" weight="bold" /></button
          ></DropdownMenuTrigger>
          <DropdownMenuPortal
            ><DropdownMenuContent class="song-menu" :side-offset="8" align="end"
              ><DropdownMenuItem class="song-menu__item" @select="goBack"
                ><PhX :size="18" /> Отменить</DropdownMenuItem
              ></DropdownMenuContent
            ></DropdownMenuPortal
          >
        </DropdownMenuRoot>
      </template>
    </PageHeader>
    <div class="page-content">
      <p v-if="!song && isEdit" class="muted">Загружаем песню…</p>
      <template v-else>
        <form novalidate @submit.prevent="save">
          <div class="form-list">
            <AppField
              id="song-title"
              v-model="title"
              label="Название"
              :invalid="Boolean(error)"
              required
            />
            <AppField id="song-artist" v-model="artist" label="Исполнитель" required />
            <AppField
              id="song-content"
              v-model="content"
              label="Заметки"
              :multiline="true"
              :rows="14"
            />
          </div>
          <TagPicker v-model="tagIds" :disabled="isSaving || textSaved || !songsStore.canWrite" />
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <section class="edit-attachments" aria-labelledby="edit-attachments-heading">
            <h2 id="edit-attachments-heading">Вложения</h2>
            <div class="edit-attachments__grid">
              <AttachmentList
                v-if="song && visibleAttachments.length"
                :user-id="songsStore.cacheUserId"
                :setlist-id="songsStore.cacheSetlistId"
                mode="edit"
                :attachments="visibleAttachments"
                @remove="removeFile"
              />
              <div
                v-if="pendingFiles.length"
                class="pending-attachments"
                aria-label="Новые вложения"
              >
                <div
                  v-for="(item, index) in pendingFiles"
                  :key="item.file.name + index"
                  class="pending-attachment"
                >
                  <img v-if="item.url" :src="item.url" :alt="item.file.name" />
                  <span v-else class="pending-attachment__audio">{{ item.file.name }}</span>
                  <button
                    class="attachment-remove"
                    type="button"
                    :aria-label="`Убрать ${item.file.name}`"
                    @click="removePending(index)"
                  >
                    <PhX :size="16" weight="bold" />
                  </button>
                </div>
              </div>
              <button
                class="attachment-add"
                type="button"
                :disabled="isSaving || !songsStore.canWrite"
                @click="openFilePicker"
              >
                <span class="attachment-add__icon"><PhPlus :size="28" /></span
                ><span><strong>Добавить</strong><small>Фото или MP3 с устройства</small></span>
              </button>
            </div>
            <input
              ref="fileInput"
              class="file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,audio/mpeg,.mp3"
              multiple
              @change="chooseFiles"
            />
            <p v-for="message in attachmentMessages" :key="message" class="form-error" role="alert">
              {{ message }}
            </p>
          </section>
          <AppButton type="submit" :disabled="isSaving || !songsStore.canWrite">{{
            isSaving
              ? 'Сохраняем…'
              : retryText
                ? 'Повторить текст'
                : isEdit
                  ? 'Сохранить изменения'
                  : 'Сохранить песню'
          }}</AppButton>
          <p v-if="!songsStore.online" class="form-error">Для сохранения требуется интернет</p>
        </form>
      </template>
    </div>
  </main>
</template>
