<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { computed, onScopeDispose, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSetlistsStore } from '@/stores/setlists';
import AppButton from '@/components/ui/AppButton.vue';

const pendingKey = 'setlist-pending-invitation';
const auth = useAuthStore();
const setlists = useSetlistsStore();
const route = useRoute();
const router = useRouter();
const busy = ref(false);
const error = ref('');
const online = ref(navigator.onLine);
const updateOnline = () => {
  online.value = navigator.onLine;
};
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
onScopeDispose(() => {
  window.removeEventListener('online', updateOnline);
  window.removeEventListener('offline', updateOnline);
});
const acceptDisabled = computed(
  () => busy.value || auth.localOnly || auth.accessDenied || !online.value,
);
const fragmentToken = new URLSearchParams(route.hash.slice(1)).get('token') ?? '';
const token = ref(fragmentToken || sessionStorage.getItem(pendingKey) || '');
if (fragmentToken) {
  sessionStorage.setItem(pendingKey, fragmentToken);
  void router.replace({ path: '/invite', query: route.query, hash: '' });
}
function login(): void {
  if (token.value) sessionStorage.setItem(pendingKey, token.value);
  auth.login('/invite');
}
async function retry(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    await auth.initialize(true);
  } finally {
    busy.value = false;
  }
}
async function accept(): Promise<void> {
  if (!token.value || acceptDisabled.value) return;
  busy.value = true;
  error.value = '';
  try {
    await setlists.accept(token.value);
    sessionStorage.removeItem(pendingKey);
    token.value = '';
    await router.replace('/');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось принять приглашение';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="app-page">
    <PageHeader title="Приглашение в сетлист" />
    <div class="page-content">
      <p v-if="!token">В ссылке нет приглашения. Попросите владельца прислать новую ссылку.</p>
      <template v-else>
        <p>Примите приглашение, чтобы открыть общий сетлист.</p>
        <AppButton v-if="!auth.user || auth.reauthRequired" type="button" @click="login"
          >Войти через Telegram</AppButton
        >
        <AppButton v-else type="button" :disabled="acceptDisabled" @click="accept">{{
          busy ? 'Принимаем…' : 'Принять приглашение'
        }}</AppButton>
        <p v-if="auth.verificationPending" role="status">
          Не удалось проверить вход. Повторите проверку, чтобы принять приглашение.
        </p>
        <AppButton v-if="auth.verificationPending" type="button" :disabled="busy" @click="retry">{{
          busy ? 'Проверяем…' : 'Повторить проверку входа'
        }}</AppButton>
        <p v-else-if="auth.offline" role="status">
          Для принятия приглашения подключитесь к интернету.
        </p>
      </template>
      <p v-if="error || auth.error" class="form-error" role="alert">{{ error || auth.error }}</p>
      <p><RouterLink to="/setlists">К сетлистам</RouterLink></p>
    </div>
  </main>
</template>
