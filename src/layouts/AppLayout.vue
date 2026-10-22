<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AppBottomNav from '@/components/AppBottomNav.vue';

const route = useRoute();
const auth = useAuthStore();
const publicPage = computed(() => route.meta.layout === 'public' || !auth.user);
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--public': publicPage }">
    <div class="app-layout__content"><slot /></div>
    <AppBottomNav v-if="!publicPage" />
  </div>
</template>
