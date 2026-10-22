<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { PhListBullets, PhMusicNote, PhUserCircle } from '@phosphor-icons/vue';
const route = useRoute();
const router = useRouter();
const isSongs = () => route.path === '/' || route.path.startsWith('/songs/');
</script>
<template>
  <nav class="library-tabs" aria-label="Разделы приложения">
    <button
      :class="{ 'is-active': isSongs() }"
      type="button"
      :aria-current="isSongs() ? 'page' : undefined"
      @click="router.push('/')"
    >
      <PhMusicNote :size="30" :weight="isSongs() ? 'fill' : 'regular'" aria-hidden="true" /><span
        >Песни</span
      >
    </button>
    <button
      :class="{ 'is-active': route.path.startsWith('/setlists') }"
      type="button"
      :aria-current="route.path.startsWith('/setlists') ? 'page' : undefined"
      @click="router.push('/setlists')"
    >
      <PhListBullets :size="30" weight="regular" aria-hidden="true" /><span>Сетлисты</span>
    </button>
    <button
      :class="{ 'is-active': route.name === 'profile' }"
      type="button"
      :aria-current="route.name === 'profile' ? 'page' : undefined"
      @click="router.push('/profile')"
    >
      <PhUserCircle
        :size="30"
        :weight="route.name === 'profile' ? 'fill' : 'regular'"
        aria-hidden="true"
      /><span>Профиль</span>
    </button>
  </nav>
</template>
<style scoped>
.library-tabs {
  grid-template-columns: repeat(3, 1fr);
}
</style>
