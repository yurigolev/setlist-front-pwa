<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { safeReturnTo } from '@/services/sessionTransport';
import { readSnapshotMeta } from '@/repositories/serverSnapshotRepository';
import AppButton from '@/components/ui/AppButton.vue';
import YandexLoginButton from '@/components/YandexLoginButton.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const savedLibrary = ref(false);
const errorMessage = computed(() => {
  if (route.query.authError)
    return route.query.authError === 'unavailable'
      ? 'Яндекс ID временно недоступен. Попробуйте позже.'
      : 'Вход не завершён. Попробуйте ещё раз.';
  if (auth.reauthRequired && auth.error.startsWith('Срок входа истёк.')) return '';
  return auth.error;
});

watch(
  () => [auth.user?.id, auth.logoutPending, auth.accessDenied] as const,
  async ([userId, logoutPending, accessDenied], _previous, onCleanup) => {
    savedLibrary.value = false;
    let current = true;
    onCleanup(() => {
      current = false;
    });
    if (!userId || logoutPending || accessDenied) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`setlist-selection:${userId}`) ?? 'null');
      if (typeof saved?.id !== 'string' || saved.setlist?.id !== saved.id) return;
      const snapshot = await readSnapshotMeta(userId, saved.id);
      if (current)
        savedLibrary.value = snapshot?.complete === true && snapshot.libraryId === saved.id;
    } catch {
      // A missing or unavailable local snapshot must not promise offline access.
    }
  },
  { immediate: true },
);

function continueSession(): void {
  void router.replace(safeReturnTo(route.query.returnTo));
}
</script>

<template>
  <main class="setlivo-login" aria-labelledby="setlivo-login-title">
    <div class="setlivo-login__content">
      <h1 id="setlivo-login-title">Setlivo</h1>
      <p class="setlivo-login__description">Песни и сетлисты под рукой</p>
      <div class="setlivo-login__actions">
        <AppButton
          v-if="auth.logoutPending"
          type="button"
          @click="auth.logout().catch((cause) => (auth.error = cause.message))"
        >
          Завершить выход
        </AppButton>
        <AppButton
          v-else-if="auth.user && !auth.reauthRequired"
          type="button"
          @click="continueSession"
        >
          Продолжить
        </AppButton>
        <YandexLoginButton v-else @click="auth.login(route.query.returnTo)" />
        <p v-if="errorMessage" class="setlivo-login__error" role="alert">{{ errorMessage }}</p>
      </div>
      <div v-if="savedLibrary" class="setlivo-login__saved">
        <RouterLink to="/">Открыть сохранённую библиотеку</RouterLink>
        <p>Данные на устройстве сохранены</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.setlivo-login {
  display: grid;
  place-items: center;
  min-height: calc(100dvh - var(--safe-area-top));
  padding: 48px 24px max(48px, env(safe-area-inset-bottom));
  background: var(--background);
}

.setlivo-login__content {
  width: min(100%, 340px);
  text-align: center;
  transform: translateY(6px);
}

.setlivo-login h1 {
  margin: 0;
  color: var(--foreground);
  font-size: 46px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -1.8px;
}

.setlivo-login__description {
  margin: 8px 0 0;
  color: var(--muted-strong);
  font-size: 16px;
  line-height: 1.5;
}

.setlivo-login__actions {
  display: grid;
  gap: 16px;
  margin-top: 32px;
}

.setlivo-login__error {
  margin: 0;
  color: #ffaaa2;
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.setlivo-login__saved {
  margin-top: 24px;
}

.setlivo-login__saved a {
  display: inline-block;
  padding-block: 4px;
  color: #82c6a4;
  font-size: 13px;
  line-height: 1.5;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.setlivo-login__saved a:hover {
  color: #a6dfc1;
}

.setlivo-login__saved a:focus-visible {
  border-radius: 3px;
  outline: 2px solid var(--ring);
  outline-offset: 4px;
}

.setlivo-login__saved p {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

@media (max-width: 380px) {
  .setlivo-login {
    padding-inline: 20px;
  }
  .setlivo-login h1 {
    font-size: 42px;
  }
  .setlivo-login__description {
    font-size: 15px;
  }
}
</style>
