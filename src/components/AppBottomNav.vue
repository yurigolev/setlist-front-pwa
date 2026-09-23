<script setup lang="ts">
import { PhGearSix, PhListBullets, PhMusicNote } from '@phosphor-icons/vue'
</script>

<template>
  <nav class="library-tabs" aria-label="Разделы приложения">
    <button class="is-active" type="button" aria-current="page">
      <PhMusicNote :size="30" weight="fill" aria-hidden="true" /><span>Песни</span>
    </button>
    <button type="button">
      <PhListBullets :size="30" weight="regular" aria-hidden="true" /><span>Сеты</span>
    </button>
    <button type="button">
      <PhGearSix :size="30" weight="regular" aria-hidden="true" /><span>Настройки</span>
    </button>
  </nav>
</template>
