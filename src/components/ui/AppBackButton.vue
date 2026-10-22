<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue';

withDefaults(defineProps<{ label?: string }>(), { label: 'Назад' });
defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    class="app-header__back"
    type="button"
    :aria-label="label"
    @click="$emit('click', $event)"
  >
    <PhArrowLeft :size="30" weight="regular" aria-hidden="true" />
  </button>
</template>

<style scoped>
.app-header__back:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
</style>
