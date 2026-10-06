<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowLeft, PhDotsThreeVertical, PhPencilSimple, PhTrash } from '@phosphor-icons/vue'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import type { Song } from '@/domain/song'
import { useSongsStore } from '@/stores/songs'
import AttachmentList from '@/components/AttachmentList.vue'
import AppBottomNav from '@/components/AppBottomNav.vue'

const props = defineProps<{ id: string }>()
const songsStore = useSongsStore()
const router = useRouter()
const song = ref<Song>()
const error = ref('')

async function load(): Promise<void> {
  if (!songsStore.songs.length) await songsStore.load()
  song.value = await songsStore.get(props.id)
}
function openEditor(): void { if (song.value) void router.push(`/songs/${song.value.id}/edit`) }
async function removeSong(): Promise<void> {
  if (!song.value || !confirm(`Удалить «${song.value.title}»?`)) return
  try { await songsStore.remove(song.value); await router.replace('/') }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось удалить песню' }
}
onMounted(load)
</script>

<template>
  <main class="app-page song-page">
    <header class="app-header">
      <button class="app-header__back" type="button" aria-label="Назад" @click="router.push('/')"><PhArrowLeft :size="30" weight="regular" /></button>
      <div class="app-header__title"><h1>{{ song?.title ?? 'Песня' }}</h1><p v-if="song?.artist">{{ song.artist }}</p></div>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button class="app-header__more" type="button" aria-label="Дополнительные действия"><PhDotsThreeVertical :size="30" weight="bold" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="song-menu" :side-offset="8" align="end">
            <DropdownMenuItem class="song-menu__item" :disabled="!songsStore.online" @select="openEditor"><PhPencilSimple :size="18" /> Редактировать</DropdownMenuItem>
            <DropdownMenuItem class="song-menu__item" :disabled="!songsStore.online" @select="removeSong"><PhTrash :size="18" /> Удалить</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </header>
    <div class="page-content">
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="!song" class="muted">Загружаем песню…</p>
      <template v-else>
        <section class="song-notes" aria-labelledby="notes-heading">
          <h2 id="notes-heading">Заметки</h2>
          <p>{{ song.content || 'Для этой песни пока нет заметок.' }}</p>
        </section>
        <AttachmentList :attachments="song.attachments" />
      </template>
    </div>
    <AppBottomNav />
  </main>
</template>
