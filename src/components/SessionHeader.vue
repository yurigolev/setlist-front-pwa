<script setup lang="ts">
import { computed } from 'vue';
import { PhCaretRight } from '@phosphor-icons/vue';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';
import UserAvatar from './UserAvatar.vue';
const auth = useAuthStore();
const songs = useSongsStore();
const offline = computed(() => auth.offline || !songs.online);
</script>

<template>
  <div v-if="auth.user" class="session-header">
    <RouterLink to="/profile" class="session-profile" aria-label="Открыть профиль">
      <UserAvatar :name="auth.user.displayName" :picture="auth.user.picture" />
      <span class="session-profile__copy"
        ><strong>{{ auth.user.displayName }}</strong
        ><span :class="{ 'is-offline': offline }"
          ><i aria-hidden="true" />{{
            auth.accessDenied
              ? 'Нет доступа'
              : auth.reauthRequired
                ? 'Войдите для синхронизации'
                : auth.verificationPending
                  ? 'Только просмотр'
                  : offline
                    ? 'Офлайн · Только просмотр'
                    : 'Онлайн'
          }}</span
        ></span
      >
      <PhCaretRight :size="18" aria-hidden="true" />
    </RouterLink>
  </div>
</template>

<style scoped>
.session-profile__copy {
  max-width: 160px;
}
.session-profile__copy > span {
  overflow-wrap: anywhere;
}
</style>
