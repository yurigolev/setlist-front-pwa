<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useSetlistsStore } from '@/stores/setlists';
import AppLayout from '@/layouts/AppLayout.vue';
import AppPageFrame from '@/layouts/AppPageFrame.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
const setlists = useSetlistsStore();
const route = useRoute();
const router = useRouter();
const error = ref('');
watch(
  () => auth.user?.id,
  (id) => {
    if (auth.ready && !id && route.name !== 'login')
      void router.replace({ name: 'login', query: { returnTo: route.fullPath } });
  },
);
watch(
  () => setlists.selectedId,
  (id) => {
    if (
      auth.user &&
      setlists.ready &&
      !id &&
      !['login', 'invite', 'setlists', 'profile'].includes(String(route.name))
    )
      void router.replace('/setlists');
  },
);
async function logout(): Promise<void> {
  error.value = '';
  try {
    await auth.logout();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось завершить выход';
  }
  await router.replace('/login');
}
</script>
<template>
  <AppLayout>
    <div v-if="auth.logoutPending" class="session-bar">
      <span>Серверная сессия ещё не завершена</span
      ><button type="button" @click="logout">Повторить выход</button>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <RouterView v-slot="{ Component, route: pageRoute }">
      <Transition :name="String(pageRoute.meta.transition || 'page-fade')" mode="out-in">
        <AppPageFrame
          :key="`${auth.user?.id ?? 'guest'}:${setlists.selectedId ?? 'none'}:${pageRoute.fullPath}`"
          :route-name="pageRoute.name"
          :public-page="pageRoute.meta.layout === 'public'"
        >
          <main v-if="auth.accessDenied && pageRoute.name !== 'profile'" class="login-page">
            <PageHeader title="Библиотека" />
          </main>
          <component :is="Component" v-else />
        </AppPageFrame>
      </Transition>
    </RouterView>
  </AppLayout>
</template>
