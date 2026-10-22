<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhArrowsClockwise,
  PhCaretDown,
  PhCaretRight,
  PhFileText,
  PhMagnifyingGlass,
  PhMusicNote,
  PhPlus,
  PhWaveform,
} from '@phosphor-icons/vue';
import { formatSyncTime } from '@/services/syncTime';
import { searchSongs } from '@/services/songSearch';
import type { Song } from '@/domain/song';
import { useSongsStore } from '@/stores/songs';
import { useSetlistsStore } from '@/stores/setlists';
import AppButton from '@/components/ui/AppButton.vue';
import AppSegment from '@/components/ui/AppSegment.vue';

type SortMode = 'alphabetical' | 'recent';

const songsStore = useSongsStore();
const setlists = useSetlistsStore();
const router = useRouter();
const query = ref('');
const sortMode = ref<SortMode>('alphabetical');
const playbackOnly = ref(false);
const refreshing = ref(false);
const refreshError = ref('');
const lastSyncedAt = computed(
  () =>
    songsStore.meta?.updatedAt ??
    (setlists.selectedId ? songsStore.syncedAt[setlists.selectedId] : undefined),
);
async function refresh(): Promise<void> {
  refreshing.value = true;
  refreshError.value = '';
  try {
    await songsStore.refresh();
  } catch (cause) {
    refreshError.value = cause instanceof Error ? cause.message : 'Не удалось обновить сетлист';
  } finally {
    refreshing.value = false;
  }
}

const visibleSongs = computed(() => {
  const matches = searchSongs(songsStore.songs, query.value).filter(
    (song) => !playbackOnly.value || hasAudio(song),
  );
  return [...matches].sort((left, right) =>
    sortMode.value === 'alphabetical'
      ? left.title.localeCompare(right.title, 'ru')
      : right.updatedAt.localeCompare(left.updatedAt),
  );
});

function hasAudio(song: Song): boolean {
  return song.attachments.some((attachment) => attachment.kind === 'audio');
}
function openSong(song: Song): void {
  void router.push(`/songs/${song.id}`);
}
function openNewSong(): void {
  void router.push('/songs/new');
}

onMounted(() => songsStore.load());
</script>

<template>
  <main class="library-page" aria-label="Библиотека песен">
    <div class="library-page__body">
      <PageHeader title="Библиотека">
        <template #context>
          <div class="library-header-context">
            <div class="library-header-context__copy">
              <RouterLink
                class="library-setlist"
                to="/setlists"
                :aria-label="`Сменить сетлист: ${setlists.current?.title || 'Не выбран'}`"
              >
                <span>Текущий сетлист ·</span>
                <strong>{{ setlists.current?.title || 'Выбрать сетлист' }}</strong>
                <PhCaretDown :size="18" aria-hidden="true" />
              </RouterLink>
              <p class="library-sync-info" role="status">
                <span v-if="refreshing || songsStore.isSyncing">Обновляем… · </span>
                <template v-if="lastSyncedAt"
                  >Обновлён:
                  <time :datetime="lastSyncedAt">{{ formatSyncTime(lastSyncedAt) }}</time></template
                >
                <span v-else-if="!songsStore.isLoading && !songsStore.isSyncing"
                  >Ещё не синхронизирован</span
                >
              </p>
            </div>
            <button
              class="library-header-refresh"
              type="button"
              :disabled="
                refreshing || songsStore.isSyncing || !songsStore.online || !setlists.selectedId
              "
              :aria-label="`Обновить сетлист: ${setlists.current?.title || 'Не выбран'}`"
              :aria-busy="refreshing || songsStore.isSyncing"
              @click="refresh"
            >
              <PhArrowsClockwise
                :size="24"
                :class="{ 'library-sync__icon--spinning': refreshing || songsStore.isSyncing }"
                aria-hidden="true"
              />
            </button>
          </div>
        </template>
      </PageHeader>
      <p
        v-if="refreshError || songsStore.syncError || !songsStore.online"
        class="library-sync__status"
        role="status"
      >
        <span v-if="refreshError || songsStore.syncError">{{
          refreshError || songsStore.syncError
        }}</span>
        <span v-if="!songsStore.online">Для сохранения требуется интернет</span>
      </p>

      <div class="library-search-row">
        <label class="library-search">
          <PhMagnifyingGlass :size="31" weight="regular" aria-hidden="true" />
          <span class="visually-hidden">Поиск в библиотеке</span>
          <input
            v-model="query"
            type="search"
            placeholder="Поиск в библиотеке"
            inputmode="search"
          />
        </label>
        <AppButton
          class="library-add-song"
          variant="icon"
          aria-label="Добавить песню"
          :disabled="!songsStore.canWrite"
          @click="openNewSong"
          ><PhPlus :size="30" aria-hidden="true"
        /></AppButton>
      </div>

      <div class="library-controls">
        <AppSegment v-model="sortMode" class="sort-switcher" />
        <button
          class="library-filter"
          :class="{ 'library-filter--active': playbackOnly }"
          type="button"
          :aria-pressed="playbackOnly"
          @click="playbackOnly = !playbackOnly"
        >
          <PhWaveform :size="19" weight="regular" aria-hidden="true" />
          С плейбеками
        </button>
      </div>

      <p v-if="songsStore.isLoading" class="library-message">Загружаем песни…</p>
      <template v-else-if="songsStore.songs.length">
        <p v-if="!visibleSongs.length" class="library-message">
          {{ playbackOnly && !query ? 'Песен с плейбеками пока нет' : 'Ничего не найдено' }}
        </p>
        <ul v-else class="song-rows" aria-label="Песни">
          <li v-for="song in visibleSongs" :key="song.id">
            <button class="song-row" type="button" @click="openSong(song)">
              <span class="song-row__copy"
                ><strong>{{ song.title }}</strong
                ><span>{{ song.artist || 'Исполнитель не указан' }}</span></span
              >
              <span class="song-row__meta">
                <PhFileText
                  v-if="song.content"
                  :size="23"
                  weight="regular"
                  aria-label="Есть заметки"
                />
                <span
                  v-if="hasAudio(song)"
                  class="song-row__playback song-row__playback--available"
                  aria-label="Есть плейбек"
                >
                  <PhWaveform :size="24" weight="regular" aria-hidden="true" />
                </span>
                <PhCaretRight :size="27" weight="bold" aria-hidden="true" />
              </span>
            </button>
          </li>
        </ul>
      </template>
      <section v-else class="library-empty">
        <PhMusicNote :size="42" weight="light" aria-hidden="true" />
        <h2>Библиотека пока пуста</h2>
        <p>
          {{ songsStore.canWrite ? 'Добавьте первую песню.' : 'В этом сетлисте пока нет песен.' }}
          Загруженная библиотека доступна офлайн.
        </p>
        <AppButton type="button" :disabled="!songsStore.canWrite" @click="openNewSong"
          >Добавить песню</AppButton
        >
      </section>
    </div>
  </main>
</template>
