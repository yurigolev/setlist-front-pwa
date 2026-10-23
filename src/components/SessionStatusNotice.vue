<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhArrowsClockwise, PhSignIn, PhWarningCircle } from '@phosphor-icons/vue';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';

const auth = useAuthStore();
const songs = useSongsStore();
const busy = ref(false);
const offline = computed(() => auth.offline || !songs.online);
const visible = computed(
  () =>
    auth.user &&
    (auth.accessDenied || auth.reauthRequired || auth.verificationPending || offline.value),
);
const title = computed(() =>
  auth.accessDenied
    ? 'Нет доступа к библиотеке'
    : auth.reauthRequired
      ? 'Нужен вход'
      : auth.verificationPending
        ? 'Не удалось проверить вход'
        : 'Нет подключения',
);
const description = computed(() =>
  auth.accessDenied
    ? 'Обратитесь к владельцу библиотеки.'
    : 'Сохранённые данные доступны только для просмотра.',
);
const actionLabel = computed(() =>
  auth.reauthRequired
    ? 'Войти через Яндекс'
    : offline.value && !auth.verificationPending
      ? 'Повторить подключение'
      : 'Повторить проверку входа',
);

async function retry(): Promise<void> {
  busy.value = true;
  try {
    await songs.retryConnection();
  } catch (cause) {
    auth.error = cause instanceof Error ? cause.message : 'Не удалось проверить вход';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section v-if="visible" class="session-notice" role="status" aria-live="polite">
    <div class="session-notice__icon" aria-hidden="true">
      <PhWarningCircle :size="38" weight="regular" />
    </div>
    <div class="session-notice__content">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
    <button
      v-if="!auth.accessDenied"
      class="session-notice__action"
      type="button"
      :aria-label="busy ? 'Проверяем вход…' : actionLabel"
      :title="busy ? 'Проверяем вход…' : actionLabel"
      :aria-busy="busy"
      :disabled="busy"
      @click="auth.reauthRequired ? auth.login('/') : retry()"
    >
      <PhSignIn v-if="auth.reauthRequired" :size="17" aria-hidden="true" />
      <PhArrowsClockwise v-else :size="17" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.session-notice {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 10px 12px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  background: var(--surface-soft);
}

.session-notice__icon {
  display: grid;
  place-items: start center;
  color: #82c6a4;
  padding-top: 2px;
}

.session-notice__content {
  min-width: 0;
}

.session-notice h2 {
  margin: 0;
  color: var(--foreground);
  font-size: 0.88rem;
  font-weight: 650;
  line-height: 1.4;
}

.session-notice p {
  margin: 2px 0 0;
  color: var(--muted-strong);
  font-size: 0.78rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.session-notice__action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--primary);
  border-radius: 50%;
  color: var(--accent-ink);
  background: transparent;
}

.session-notice__action:hover:not(:disabled) {
  background: rgba(73, 102, 168, 0.14);
}

.session-notice__action:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}

.session-notice__action:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 480px) {
  .session-notice {
    grid-template-columns: 20px minmax(0, 1fr) 30px;
    align-items: start;
    gap: 8px;
    padding: 10px;
  }

  .session-notice__icon svg {
    width: 20px;
    height: 20px;
  }

  .session-notice__action {
    width: 30px;
    height: 30px;
  }
}
</style>
