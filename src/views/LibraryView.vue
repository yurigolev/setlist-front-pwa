<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowsClockwise, PhCaretRight, PhFileText, PhMagnifyingGlass, PhMusicNote, PhPlus, PhWaveform } from '@phosphor-icons/vue'
import { searchSongs } from '@/services/songSearch'
import type { Song } from '@/domain/song'
import { useSongsStore } from '@/stores/songs'
import AppBottomNav from '@/components/AppBottomNav.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSegment from '@/components/ui/AppSegment.vue'

type SortMode = 'alphabetical' | 'recent'

const songsStore = useSongsStore()
const router = useRouter()
const query = ref('')
const sortMode = ref<SortMode>('alphabetical')
const playbackOnly = ref(false)

const visibleSongs = computed(() => {
  const matches = searchSongs(songsStore.songs, query.value)
    .filter((song) => !playbackOnly.value || hasAudio(song))
  return [...matches].sort((left, right) => sortMode.value === 'alphabetical'
    ? left.title.localeCompare(right.title, 'ru')
    : right.updatedAt.localeCompare(left.updatedAt))
})

function hasAudio(song: Song): boolean { return song.attachments.some((attachment) => attachment.kind === 'audio') }
function openSong(song: Song): void { void router.push(`/songs/${song.id}`) }
function openNewSong(): void { void router.push('/songs/new') }

onMounted(() => songsStore.load())
</script>

<template>
  <main class="library-page" aria-label="Библиотека песен">
    <div class="library-page__body">
      <header class="library-page__header">
        <div class="library-page__title"><h1>Песни</h1><p>Моя музыка. Всегда с тобой.</p></div>
        <AppButton class="add-song-button" variant="icon" aria-label="Добавить песню" @click="openNewSong">
          <PhPlus :size="36" weight="regular" aria-hidden="true" />
        </AppButton>
      </header>
      <div class="library-sync">
        <button
          class="library-sync__button"
          type="button"
          :disabled="songsStore.isSyncing"
          @click="songsStore.refresh().catch(() => undefined)"
        >
          <PhArrowsClockwise :size="19" weight="bold" :class="{ 'library-sync__icon--spinning': songsStore.isSyncing }" aria-hidden="true" />
          {{ songsStore.isSyncing ? 'Обновляем библиотеку' : 'Обновить библиотеку' }}
        </button>
        <p class="library-sync__status" role="status">
          <span v-if="songsStore.meta">Обновлено {{ new Date(songsStore.meta.updatedAt).toLocaleString('ru') }}</span>
          <span v-if="songsStore.syncError">{{ songsStore.syncError }}</span>
          <span v-if="!songsStore.online">Для сохранения требуется интернет</span>
        </p>
      </div>

      <label class="library-search">
        <PhMagnifyingGlass :size="31" weight="regular" aria-hidden="true" />
        <span class="visually-hidden">Поиск в библиотеке</span>
        <input v-model="query" type="search" placeholder="Поиск в библиотеке" inputmode="search" />
      </label>

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
          <p v-if="!visibleSongs.length" class="library-message">{{ playbackOnly && !query ? 'Песен с плейбеками пока нет' : 'Ничего не найдено' }}</p>
          <ul v-else class="song-rows" aria-label="Песни">
            <li v-for="song in visibleSongs" :key="song.id">
              <button class="song-row" type="button" @click="openSong(song)">
                <span class="song-row__copy"><strong>{{ song.title }}</strong><span>{{ song.artist || 'Исполнитель не указан' }}</span></span>
                <span class="song-row__meta">
                  <PhFileText v-if="song.content" :size="23" weight="regular" aria-label="Есть заметки" />
                  <span v-if="hasAudio(song)" class="song-row__playback song-row__playback--available" aria-label="Есть плейбек">
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
          <p>Добавьте первую песню — она останется только на этом устройстве.</p>
          <AppButton type="button" @click="openNewSong">Добавить песню</AppButton>
        </section>
      </div>
    <AppBottomNav />
  </main>
</template>
