<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhCircle,
  PhSignOut,
  PhUser,
  PhWifiHigh,
  PhWifiSlash,
  PhWarningCircle,
} from '@phosphor-icons/vue';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';
import UserAvatar from '@/components/UserAvatar.vue';

const auth = useAuthStore();
const songs = useSongsStore();
const router = useRouter();
const busy = ref(false);
const offline = computed(() => auth.offline || !songs.online);
const username = computed(() =>
  auth.user?.username ? `@${auth.user.username.replace(/^@/, '')}` : '',
);
const connectionTitle = computed(() =>
  auth.accessDenied
    ? 'Нет доступа к библиотеке'
    : auth.reauthRequired
      ? 'Войдите для синхронизации'
      : auth.verificationPending
        ? 'Не удалось проверить вход · Только просмотр'
        : offline.value
          ? 'Нет подключения'
          : 'Соединение активно',
);
const connectionDescription = computed(() =>
  auth.accessDenied
    ? 'Войдите с другим аккаунтом или обратитесь к владельцу.'
    : auth.reauthRequired
      ? 'Срок входа истёк. Сохранённые песни доступны для просмотра. Войдите через Яндекс для обновления и изменений.'
      : auth.verificationPending
        ? 'Сервер временно недоступен. Сохранённые песни доступны для просмотра. Повторите проверку входа для синхронизации и изменений.'
        : offline.value
          ? 'Сохранённые песни доступны для просмотра. Для обновления нужен интернет.'
          : 'Изменения доступны при подключении к интернету.',
);

async function logout(): Promise<void> {
  busy.value = true;
  try {
    await auth.logout();
  } catch (cause) {
    auth.error = cause instanceof Error ? cause.message : 'Не удалось завершить выход';
  } finally {
    busy.value = false;
    await router.replace('/login');
  }
}
</script>

<template>
  <main class="profile-page" aria-label="Профиль">
    <PageHeader v-if="auth.user">
      <section class="profile-identity" aria-label="Аккаунт">
        <UserAvatar :name="auth.user.displayName" :picture="auth.user.picture" />
        <div class="profile-identity__copy">
          <h1>{{ auth.user.displayName }}</h1>
          <p v-if="username" class="profile-username">{{ username }}</p>
          <span
            class="profile-status"
            :class="{ 'is-offline': offline, 'is-denied': auth.accessDenied }"
            role="status"
          >
            <PhCircle :size="10" weight="fill" aria-hidden="true" />
            {{
              auth.accessDenied
                ? 'Нет доступа'
                : auth.reauthRequired
                  ? 'Только просмотр · Нужен вход'
                  : auth.verificationPending
                    ? 'Не удалось проверить вход · Только просмотр'
                    : offline
                      ? 'Офлайн · Только просмотр'
                      : 'Онлайн'
            }}
          </span>
        </div>
      </section>
    </PageHeader>
    <section
      v-if="!auth.localOnly && !offline && !auth.accessDenied"
      class="profile-connection"
      :class="{ 'is-offline': offline, 'is-denied': auth.accessDenied }"
      aria-label="Подключение"
    >
      <component
        :is="
          auth.accessDenied || auth.reauthRequired || auth.verificationPending
            ? PhWarningCircle
            : offline
              ? PhWifiSlash
              : PhWifiHigh
        "
        :size="34"
        aria-hidden="true"
      />
      <div>
        <h2>{{ connectionTitle }}</h2>
        <p>{{ connectionDescription }}</p>
      </div>
    </section>
    <p v-if="auth.error && !auth.localOnly" class="form-error" role="alert">{{ auth.error }}</p>
    <section v-if="username" class="profile-account" aria-labelledby="profile-account-title">
      <h2 id="profile-account-title">Аккаунт</h2>
      <dl class="profile-account__details">
        <dt><PhUser :size="24" aria-hidden="true" /><span>Имя пользователя</span></dt>
        <dd>{{ username }}</dd>
      </dl>
    </section>
    <button
      class="profile-logout"
      type="button"
      :disabled="busy || songs.isSyncing"
      :aria-busy="busy"
      @click="logout"
    >
      <PhSignOut :size="23" aria-hidden="true" />{{ busy ? 'Выходим…' : 'Выйти из аккаунта' }}
    </button>
  </main>
</template>
