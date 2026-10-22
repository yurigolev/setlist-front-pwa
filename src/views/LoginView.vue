<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { safeReturnTo } from '@/services/sessionTransport';
import AppButton from '@/components/ui/AppButton.vue';
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
function continueSession(): void {
  void router.replace(safeReturnTo(route.query.returnTo));
}
</script>
<template>
  <main class="login-page">
    <PageHeader title="Setlist" />
    <p>Войдите через Telegram, чтобы открыть свои песни и сеты.</p>
    <p v-if="auth.error" role="alert" class="form-error">{{ auth.error }}</p>
    <p v-if="route.query.authError" role="alert" class="form-error">
      {{
        route.query.authError === 'unavailable'
          ? 'Вход через Telegram пока не настроен. Попробуйте позже.'
          : 'Вход не завершён. Попробуйте ещё раз.'
      }}
    </p>
    <AppButton v-if="auth.user && !auth.reauthRequired" type="button" @click="continueSession"
      >Продолжить</AppButton
    >
    <AppButton
      v-else-if="!auth.logoutPending"
      type="button"
      @click="auth.login(route.query.returnTo)"
      >Войти через Telegram</AppButton
    >
    <AppButton
      v-if="auth.logoutPending"
      type="button"
      @click="auth.logout().catch((cause) => (auth.error = cause.message))"
      >Завершить выход</AppButton
    >
  </main>
</template>
