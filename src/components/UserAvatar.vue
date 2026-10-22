<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ name: string; picture?: string }>();
const failed = ref(false);
watch(
  () => props.picture,
  () => {
    failed.value = false;
  },
);
const initials = computed(
  () =>
    props.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?',
);
</script>

<template>
  <span class="user-avatar" aria-hidden="true">
    <img
      v-if="picture && !failed"
      :src="picture"
      alt=""
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else>{{ initials }}</span>
  </span>
</template>
