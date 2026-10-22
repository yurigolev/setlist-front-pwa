<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhCaretDown,
  PhCopy,
  PhDotsThreeVertical,
  PhPencilSimple,
  PhTrash,
} from '@phosphor-icons/vue';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import type { Song } from '@/domain/song';
import { useSongsStore } from '@/stores/songs';
import { useSetlistsStore } from '@/stores/setlists';
import AppButton from '@/components/ui/AppButton.vue';
import AttachmentList from '@/components/AttachmentList.vue';
import AppBackButton from '@/components/ui/AppBackButton.vue';

const props = defineProps<{ id: string }>();
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
const songsStore = useSongsStore();
const setlists = useSetlistsStore();
const router = useRouter();
const song = ref<Song>();
const error = ref('');
const copyTarget = ref('');
const copying = ref(false);
const copyStatus = ref('');
const copyTargets = computed(() =>
  setlists.setlists.filter(
    (item) => item.id !== setlists.selectedId && (item.role === 'owner' || item.role === 'editor'),
  ),
);
async function copySong(): Promise<void> {
  if (!alive || !song.value || !copyTarget.value || copying.value) return;
  error.value = '';
  copyStatus.value = '';
  copying.value = true;
  try {
    await songsStore.copy(song.value, copyTarget.value);
    if (!alive) return;
    copyStatus.value = 'Песня скопирована в выбранный сетлист';
  } catch (cause) {
    if (alive)
      error.value = cause instanceof Error ? cause.message : 'Не удалось скопировать песню';
  } finally {
    if (alive) copying.value = false;
  }
}

async function load(): Promise<void> {
  if (!songsStore.songs.length) await songsStore.load();
  if (!alive) return;
  const loaded = await songsStore.get(props.id);
  if (!alive) return;
  song.value = loaded;
}
function openEditor(): void {
  if (song.value) void router.push(`/songs/${song.value.id}/edit`);
}
async function removeSong(): Promise<void> {
  if (!alive || !songsStore.canWrite || !song.value || !confirm(`Удалить «${song.value.title}»?`))
    return;
  try {
    await songsStore.remove(song.value);
    if (!alive) return;
    await router.replace('/');
  } catch (cause) {
    if (alive) error.value = cause instanceof Error ? cause.message : 'Не удалось удалить песню';
  }
}
onMounted(load);
</script>

<template>
  <main class="app-page song-page">
    <PageHeader class="song-toolbar" :title="song?.title ?? 'Песня'" :subtitle="song?.artist">
      <template #back><AppBackButton @click="router.push('/')" /></template>
      <template #actions>
        <div class="song-toolbar__actions">
          <button
            v-if="songsStore.canWrite"
            class="song-toolbar__edit"
            type="button"
            aria-label="Редактировать песню"
            :disabled="!song"
            @click="openEditor"
          >
            <PhPencilSimple :size="24" />
          </button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <button class="app-header__more" type="button" aria-label="Дополнительные действия">
                <PhDotsThreeVertical :size="30" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent class="song-menu" :side-offset="8" align="end">
                <DropdownMenuItem
                  class="song-menu__item"
                  :disabled="!songsStore.canWrite"
                  @select="openEditor"
                  ><PhPencilSimple :size="18" /> Редактировать</DropdownMenuItem
                >
                <DropdownMenuItem
                  class="song-menu__item"
                  :disabled="!songsStore.canWrite"
                  @select="removeSong"
                  ><PhTrash :size="18" /> Удалить</DropdownMenuItem
                >
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </template>
    </PageHeader>
    <div
      class="page-content song-detail"
      :class="{
        'song-detail--with-audio': song?.attachments.some(
          (attachment) => attachment.kind === 'audio',
        ),
      }"
    >
      <p v-if="setlists.current" class="song-setlist-context">
        Сетлист · {{ setlists.current.title }}
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="!song" class="muted">Загружаем песню…</p>
      <template v-else>
        <section v-if="song.content.trim()" class="song-notes" aria-labelledby="notes-heading">
          <h2 id="notes-heading">Заметки</h2>
          <p>{{ song.content }}</p>
        </section>
        <AttachmentList
          v-if="song.attachments.length"
          :user-id="songsStore.cacheUserId"
          :setlist-id="songsStore.cacheSetlistId"
          :attachments="song.attachments"
        />
        <details v-if="copyTargets.length" class="copy-song">
          <summary>
            <PhCopy :size="22" aria-hidden="true" /><span>Копировать в сетлист</span
            ><PhCaretDown class="copy-song__chevron" :size="20" aria-hidden="true" />
          </summary>
          <form @submit.prevent="copySong">
            <label for="copy-target">Сетлист назначения</label>
            <select
              id="copy-target"
              v-model="copyTarget"
              class="field__control"
              :disabled="copying"
            >
              <option disabled value="">Выберите сетлист</option>
              <option v-for="target in copyTargets" :key="target.id" :value="target.id">
                {{ target.title }}
              </option>
            </select>
            <AppButton type="submit" :disabled="copying || !copyTarget || !songsStore.online">{{
              copying ? 'Копируем…' : 'Копировать песню'
            }}</AppButton>
          </form>
          <p v-if="copyStatus" role="status">{{ copyStatus }}</p>
        </details>
      </template>
    </div>
  </main>
</template>

<style scoped>
.song-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(100% - 40px, 760px);
  min-height: 72px;
  margin: 0 auto;
}
.song-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.song-toolbar__actions > button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  color: var(--muted-strong);
  background: transparent;
  box-shadow: none;
}
.song-toolbar__actions > button:hover {
  color: var(--foreground);
  background: var(--surface);
}
.song-toolbar__actions > button:focus-visible,
.copy-song summary:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.song-toolbar__actions > button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.song-page .song-detail {
  width: min(100% - 40px, 760px);
  padding-top: 4px;
  padding-bottom: calc(124px + env(safe-area-inset-bottom));
}
.song-page .song-detail--with-audio {
  padding-bottom: calc(224px + env(safe-area-inset-bottom));
}
.song-identity h1 {
  margin: 0;
  color: var(--foreground);
  font-size: clamp(1.8rem, 7.7vw, 2.2rem);
  line-height: 1.1;
  font-weight: 750;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}
.song-identity__artist {
  margin: 5px 0 0;
  color: var(--muted-strong);
  font-size: 1rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.song-setlist-context {
  margin: 16px 0 24px;
  font-size: 0.85rem;
  color: var(--muted-strong);
}
.song-notes {
  margin-top: 0;
  padding-bottom: 20px;
}
.song-notes h2 {
  margin-bottom: 8px;
  font-size: 1.05rem;
  line-height: 1.3;
  font-weight: 700;
}
.song-notes p {
  color: var(--foreground);
  font-size: 1rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.copy-song {
  margin-top: 24px;
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
}
.copy-song summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 12px 14px;
  color: var(--ring);
  background: var(--surface);
  cursor: pointer;
  list-style: none;
  font-weight: 550;
}
.copy-song summary::-webkit-details-marker {
  display: none;
}
.copy-song summary span {
  flex: 1;
}
.copy-song__chevron {
  flex: 0 0 auto;
  transition: transform 0.18s ease;
}
.copy-song[open] .copy-song__chevron {
  transform: rotate(180deg);
}
.copy-song form {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-top: 1px solid var(--border-soft);
}
.copy-song label {
  color: var(--muted-strong);
  font-size: 0.9rem;
}
.copy-song [role='status'] {
  color: var(--muted-strong);
  font-size: 0.9rem;
}
@media (max-width: 380px) {
  .song-toolbar,
  .song-page .song-detail {
    width: calc(100% - 32px);
  }
}
</style>
