<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { PhPlus, PhTrash, PhX } from '@phosphor-icons/vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui';
import { useSongsStore } from '@/stores/songs';
import { isTagName, normalizeTagName } from '@/domain/tagName';
import type { SongTag } from '@/domain/song';
import AppButton from '@/components/ui/AppButton.vue';
import AppTag from '@/components/ui/AppTag.vue';
import TagColorEditor from '@/components/TagColorEditor.vue';
import { suggestTagColor } from '@/domain/tagColor';
const store = useSongsStore();
const open = ref(false);
const editing = ref<SongTag>();
const name = ref('');
const color = ref<string | null>(null);
const deleting = ref(false);
const busy = ref(false);
const error = ref('');
const nameInput = ref<HTMLInputElement>();
const addButton = ref<HTMLButtonElement>();
let trigger: HTMLElement | undefined;
const count = computed(
  () => store.songs.filter((song) => song.tagIds?.includes(editing.value?.id ?? '')).length,
);
const changed = computed(
  () =>
    normalizeTagName(name.value) !== editing.value?.name ||
    color.value !== (editing.value?.color ?? null),
);
const validName = computed(() => isTagName(name.value));
function show(tag: SongTag | undefined, event: MouseEvent): void {
  if (!store.canWrite) return;
  trigger = event.currentTarget as HTMLElement;
  editing.value = tag;
  name.value = tag?.name ?? '';
  color.value = tag ? (tag.color ?? null) : suggestTagColor(store.tags);
  deleting.value = false;
  error.value = '';
  open.value = true;
}
function focusName(event: Event): void {
  event.preventDefault();
  void nextTick(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
  });
}
function restoreFocus(event: Event): void {
  event.preventDefault();
  if (trigger?.isConnected) trigger.focus();
  else addButton.value?.focus();
}
async function submit(): Promise<void> {
  if (busy.value || !store.canWrite || (!deleting.value && (!validName.value || !changed.value)))
    return;
  busy.value = true;
  error.value = '';
  try {
    if (deleting.value && editing.value) await store.deleteTag(editing.value.id);
    else if (editing.value) await store.updateTag(editing.value.id, name.value, color.value);
    else await store.createTag(name.value, color.value);
    open.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось изменить тег';
  } finally {
    busy.value = false;
  }
}
watch(
  () => store.cacheSetlistId,
  () => {
    open.value = false;
    error.value = '';
  },
);
watch(
  () => store.canWrite,
  (allowed) => {
    if (!allowed) open.value = false;
  },
);
</script>
<template>
  <div v-if="store.canWrite" class="tag-manager">
    <div class="tag-manager__cloud" aria-label="Теги сетлиста">
      <AppTag
        v-for="tag in store.tags"
        :key="tag.id"
        :label="tag.name"
        :color="tag.color"
        size="lg"
        action="edit"
        :selected="open && editing?.id === tag.id"
        @click="show(tag, $event)"
      />
      <button
        ref="addButton"
        type="button"
        class="tag-manager__add"
        @click="show(undefined, $event)"
      >
        <PhPlus :size="25" aria-hidden="true" />Добавить тег
      </button>
    </div>
    <p v-if="!store.tags.length" class="tag-manager__empty">
      Добавьте первый тег — например, «Лаунж» или «Драйвовое».
    </p>
    <DialogRoot v-model:open="open">
      <DialogPortal>
        <DialogOverlay class="tag-dialog-overlay" />
        <DialogContent
          class="tag-dialog"
          :aria-busy="busy"
          @open-auto-focus="focusName"
          @close-auto-focus="restoreFocus"
          @escape-key-down="busy && $event.preventDefault()"
          @interact-outside="busy && $event.preventDefault()"
        >
          <DialogTitle class="tag-dialog__title">{{
            deleting ? 'Удалить тег?' : editing ? 'Редактировать тег' : 'Новый тег'
          }}</DialogTitle>
          <DialogDescription class="tag-dialog__description">{{
            deleting
              ? `Тег «${editing?.name}» будет убран из песен: ${count}. Песни сохранятся.`
              : editing
                ? 'Изменения применятся ко всем песням с этим тегом.'
                : 'Тег будет доступен для всех песен этого сетлиста.'
          }}</DialogDescription>
          <DialogClose class="tag-dialog__close" aria-label="Закрыть" :disabled="busy"
            ><PhX :size="24" aria-hidden="true"
          /></DialogClose>
          <form @submit.prevent="submit">
            <label v-if="!deleting" class="tag-dialog__field" for="tag-name">
              <span>Название тега</span>
              <input
                id="tag-name"
                ref="nameInput"
                v-model="name"
                class="field__control"
                autocomplete="off"
                maxlength="80"
                :disabled="busy"
                required
                :aria-invalid="Boolean(name.trim()) && !validName"
                aria-describedby="tag-name-hint"
              />
              <span id="tag-name-hint" class="visually-hidden">До 40 символов</span>
            </label>
            <template v-if="!deleting">
              <div class="tag-dialog__preview" aria-label="Предпросмотр тега">
                <AppTag :label="normalizeTagName(name) || 'Новый тег'" :color="color" size="lg" />
              </div>
              <TagColorEditor v-model="color" :disabled="busy" />
            </template>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <div class="tag-dialog__footer">
              <button
                v-if="editing && !deleting"
                type="button"
                class="tag-dialog__delete"
                :disabled="busy"
                @click="
                  deleting = true;
                  error = '';
                "
              >
                <PhTrash :size="21" aria-hidden="true" />Удалить тег
              </button>
              <AppButton
                class="tag-dialog__submit"
                :class="{ 'tag-dialog__submit--danger': deleting }"
                type="submit"
                :disabled="busy || (!deleting && (!validName || !changed))"
                >{{
                  busy
                    ? 'Сохраняем…'
                    : deleting
                      ? 'Удалить тег'
                      : editing
                        ? 'Сохранить'
                        : 'Создать тег'
                }}</AppButton
              >
              <AppButton
                variant="ghost"
                type="button"
                :disabled="busy"
                @click="deleting ? (deleting = false) : (open = false)"
                >Отмена</AppButton
              >
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
<style scoped>
.tag-manager {
  margin-top: 28px;
}
.tag-manager__cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  max-width: 560px;
}
.tag-manager__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 56px;
  padding: 12px 20px;
  border: 1px dashed var(--primary);
  border-radius: 999px;
  background: transparent;
  color: var(--ring);
  font-size: 16px;
  font-weight: 500;
}
.tag-manager__add:hover {
  border-color: var(--ring);
  background: rgba(73, 102, 168, 0.08);
}
.tag-manager__add:focus-visible,
.tag-dialog button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.tag-manager__empty {
  max-width: 400px;
  margin-top: 16px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}
.tag-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(10, 12, 20, 0.45);
}
.tag-dialog {
  position: fixed;
  z-index: 91;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(584px, calc(100vw - 40px));
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  color: var(--foreground);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
}
.tag-dialog__title {
  margin: 0;
  padding-right: 28px;
  font-size: 30px;
  line-height: 1.25;
  font-weight: 650;
  letter-spacing: -0.025em;
}
.tag-dialog__description {
  margin: 16px 0 28px;
  color: var(--muted-strong);
  font-size: 16px;
  line-height: 1.6;
}
.tag-dialog__close {
  position: absolute;
  top: 24px;
  right: 22px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted-strong);
}
.tag-dialog__field {
  display: grid;
  gap: 10px;
  color: var(--muted-strong);
  font-size: 16px;
}
.tag-dialog__field .field__control {
  min-height: 54px;
}
.tag-dialog__preview {
  display: flex;
  align-items: center;
  min-height: 80px;
  margin-top: 16px;
  padding: 14px;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  background: var(--background);
}
.tag-dialog__footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 12px;
  margin-top: 30px;
}
.tag-dialog__footer .app-button {
  width: 100%;
  min-width: 0;
  min-height: 56px;
  padding: 14px 20px;
  font-size: 16px;
}
.tag-dialog__submit {
  margin: 0;
}
.tag-dialog__footer .app-button--ghost {
  border: 1px solid var(--border);
}
.tag-dialog__delete {
  grid-column: 1 / -1;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  min-height: 44px;
  padding: 8px 0;
  background: transparent;
  color: #ed9b9f;
  font-size: 14px;
}
.tag-dialog__submit--danger {
  background: #a53c4b;
}
.tag-dialog button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 480px) {
  .tag-manager__cloud {
    gap: 12px;
  }
  .tag-manager__add {
    min-width: 0;
    min-height: 48px;
    padding: 10px 16px;
    gap: 10px;
    font-size: 15px;
  }
  .tag-dialog {
    top: 50%;
    padding: 24px;
    width: calc(100vw - 32px);
    border-radius: 20px;
  }
  .tag-dialog__title {
    font-size: 23px;
  }
  .tag-dialog__description {
    margin: 14px 0 24px;
    font-size: 14px;
  }
  .tag-dialog__close {
    top: 17px;
    right: 16px;
  }
  .tag-dialog__footer {
    gap: 10px;
    margin-top: 24px;
  }
  .tag-dialog__footer .app-button {
    padding-inline: 12px;
  }
}
</style>
