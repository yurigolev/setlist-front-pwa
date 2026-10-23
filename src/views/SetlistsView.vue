<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { computed, ref, watch } from 'vue';
import {
  PhArrowsClockwise,
  PhCheck,
  PhGearSix,
  PhPlaylist,
  PhPlus,
  PhX,
} from '@phosphor-icons/vue';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui';
import { formatSyncTime } from '@/services/syncTime';
import { useRouter } from 'vue-router';
import { useSetlistsStore } from '@/stores/setlists';
import { useAuthStore } from '@/stores/auth';
import { useSongsStore } from '@/stores/songs';
import AppButton from '@/components/ui/AppButton.vue';
import AppField from '@/components/ui/AppField.vue';

const setlists = useSetlistsStore();
const auth = useAuthStore();
const songsStore = useSongsStore();
const router = useRouter();
const title = ref('');
const busy = ref(false);
const error = ref('');
const createOpen = ref(false);
const syncingId = ref<string>();
const syncingAll = ref(false);
const syncMessage = ref('');
const syncErrors = ref<Record<string, string>>({});
const allSyncedAt = ref('');
const allSyncKey = () => `setlist-all-synced:${auth.user?.id}`;
watch(
  () => [auth.user?.id, setlists.setlists.map((item) => item.id).join(',')],
  () => {
    allSyncedAt.value = auth.user ? (localStorage.getItem(allSyncKey()) ?? '') : '';
    void songsStore.loadSyncTimes().catch(() => undefined);
  },
  { immediate: true },
);

const syncBusy = computed(
  () => Boolean(syncingId.value) || syncingAll.value || songsStore.isSyncing,
);
const syncDisabled = computed(
  () =>
    syncBusy.value ||
    busy.value ||
    setlists.loading ||
    auth.localOnly ||
    auth.accessDenied ||
    !songsStore.online,
);
async function syncOne(id: string): Promise<void> {
  if (syncDisabled.value) return;
  syncingId.value = id;
  syncMessage.value = '';
  syncErrors.value = {};
  try {
    await songsStore.syncSetlist(id);
    syncMessage.value = 'Сетлист синхронизирован';
  } catch (cause) {
    syncErrors.value[id] =
      cause instanceof Error ? cause.message : 'Не удалось синхронизировать сетлист';
  } finally {
    syncingId.value = undefined;
  }
}
async function syncAll(): Promise<void> {
  if (syncDisabled.value) return;
  syncingAll.value = true;
  syncMessage.value = '';
  syncErrors.value = {};
  const userId = auth.user?.id;
  let completed = 0;
  try {
    await setlists.initialize(true);
    const items = [...setlists.setlists];
    for (const [index, item] of items.entries()) {
      if (auth.user?.id !== userId || auth.localOnly || !songsStore.online)
        throw new Error('Синхронизация прервана: проверьте вход и подключение');
      syncingId.value = item.id;
      syncMessage.value = `Синхронизация ${index + 1} из ${items.length}`;
      try {
        await songsStore.syncSetlist(item.id);
        completed++;
      } catch (cause) {
        syncErrors.value[item.id] =
          cause instanceof Error ? cause.message : 'Не удалось синхронизировать сетлист';
      }
    }
    if (!Object.keys(syncErrors.value).length && auth.user?.id === userId) {
      allSyncedAt.value = new Date().toISOString();
      localStorage.setItem(allSyncKey(), allSyncedAt.value);
    }
    syncMessage.value = Object.keys(syncErrors.value).length
      ? `Синхронизировано ${completed} из ${items.length}. Неудачные можно повторить отдельно.`
      : `Все сетлисты синхронизированы: ${completed}`;
  } catch (cause) {
    syncMessage.value =
      cause instanceof Error ? cause.message : 'Не удалось синхронизировать сетлисты';
  } finally {
    syncingId.value = undefined;
    syncingAll.value = false;
  }
}
const createDisabled = computed(
  () =>
    busy.value ||
    syncBusy.value ||
    setlists.loading ||
    auth.localOnly ||
    auth.accessDenied ||
    !songsStore.online,
);
function focusTitle(event: Event): void {
  event.preventDefault();
  document.getElementById('setlist-create-title')?.focus();
}
const roleLabels = { owner: 'Владелец', editor: 'Редактор', viewer: 'Просмотр' };
async function open(id: string): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    await setlists.select(id);
    await router.push('/');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось открыть сетлист';
  } finally {
    busy.value = false;
  }
}
async function openSettings(id: string): Promise<void> {
  try {
    setlists.select(id);
    await router.push({ name: 'setlist-settings', params: { id } });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось открыть настройки сетлиста';
  }
}
async function create(): Promise<void> {
  if (createDisabled.value) return;
  if (!title.value.trim()) {
    error.value = 'Укажите название сетлиста';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    await setlists.create(title.value.trim());
    await router.push('/');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось создать сетлист';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="app-page setlists-page" aria-label="Сетлисты">
    <div class="setlists-content">
      <PageHeader title="Сетлисты" />

      <DialogRoot v-model:open="createOpen">
        <DialogTrigger as-child>
          <AppButton class="setlists-create" :disabled="createDisabled" @click="error = ''">
            <PhPlus :size="24" aria-hidden="true" />Новый сетлист
          </AppButton>
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay class="setlist-dialog-overlay" />
          <DialogContent
            class="setlist-dialog"
            @open-auto-focus="focusTitle"
            @escape-key-down="busy && $event.preventDefault()"
            @interact-outside="busy && $event.preventDefault()"
          >
            <div class="setlist-dialog__heading">
              <DialogTitle class="setlist-dialog__title">Новый сетлист</DialogTitle>
              <DialogClose
                class="setlist-icon-button"
                aria-label="Закрыть создание сетлиста"
                :disabled="busy"
              >
                <PhX :size="22" aria-hidden="true" />
              </DialogClose>
            </div>
            <DialogDescription class="setlist-dialog__description"
              >Дайте название сетлисту. Песни можно добавить после создания.</DialogDescription
            >
            <form class="create-setlist" :aria-busy="busy" @submit.prevent="create">
              <AppField id="setlist-create-title" v-model="title" label="Название" required />
              <p v-if="error || setlists.error" class="form-error" role="alert">
                {{ error || setlists.error }}
              </p>
              <p
                v-if="auth.localOnly || !songsStore.online"
                class="setlist-dialog__description"
                role="status"
              >
                {{
                  auth.reauthRequired
                    ? 'Для создания сетлиста войдите через Яндекс.'
                    : auth.verificationPending
                      ? 'Для создания сетлиста повторите проверку входа.'
                      : 'Для создания сетлиста подключитесь к интернету.'
                }}
              </p>
              <AppButton type="submit" :disabled="createDisabled || !title.trim()">{{
                busy ? 'Создаём…' : 'Создать сетлист'
              }}</AppButton>
            </form>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      <p v-if="setlists.loading && !setlists.setlists.length" class="setlists-notice" role="status">
        Загружаем сетлисты…
      </p>
      <section v-else-if="!setlists.setlists.length" class="setlists-empty">
        <PhPlaylist :size="40" aria-hidden="true" />
        <h2>Первый сетлист — ваше начало</h2>
        <p>
          Создайте сетлист для репетиции или выступления. Или откройте ссылку приглашения от
          владельца.
        </p>
      </section>
      <ul v-else class="setlists-list" aria-label="Доступные сетлисты">
        <li
          v-for="item in setlists.setlists"
          :key="item.id"
          class="setlist-row"
          :class="{ 'setlist-row--selected': item.id === setlists.selectedId }"
        >
          <button
            class="setlist-open"
            type="button"
            :disabled="busy || syncBusy"
            :aria-current="item.id === setlists.selectedId ? 'true' : undefined"
            @click="open(item.id)"
          >
            <span class="setlist-art" aria-hidden="true">
              <PhPlaylist :size="30" />
              <span v-if="item.id === setlists.selectedId" class="setlist-check"
                ><PhCheck :size="14" weight="bold"
              /></span>
            </span>
            <span class="setlist-copy">
              <strong>{{ item.title }}</strong>
              <span class="setlist-meta"
                >{{ roleLabels[item.role]
                }}<span v-if="item.id === setlists.selectedId" class="setlist-selected">
                  · Выбран</span
                ></span
              >
              <span class="setlist-sync-time">{{
                songsStore.syncedAt[item.id]
                  ? `Обновлён: ${formatSyncTime(songsStore.syncedAt[item.id]!)}`
                  : 'Ещё не синхронизирован'
              }}</span>
            </span>
          </button>
          <button
            class="setlist-icon-button setlist-sync"
            type="button"
            :disabled="syncDisabled"
            :aria-label="`Синхронизировать сетлист ${item.title}`"
            :aria-busy="syncingId === item.id"
            :title="syncErrors[item.id] || 'Синхронизировать сетлист'"
            @click="syncOne(item.id)"
          >
            <PhArrowsClockwise
              :size="22"
              :class="{ 'setlist-sync--spinning': syncingId === item.id }"
              aria-hidden="true"
            />
          </button>
          <p v-if="syncErrors[item.id]" class="setlist-sync-error" role="alert">
            {{ item.title }}: {{ syncErrors[item.id] }}
          </p>
          <button
            class="setlist-icon-button setlist-settings"
            type="button"
            :disabled="busy || syncBusy"
            :aria-label="`Настройки сетлиста ${item.title}`"
            @click="openSettings(item.id)"
          >
            <PhGearSix :size="23" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div v-if="setlists.setlists.length" class="setlists-sync-all">
        <AppButton
          variant="ghost"
          :disabled="syncDisabled"
          :aria-busy="syncingAll"
          @click="syncAll"
        >
          <PhArrowsClockwise
            :size="20"
            :class="{ 'setlist-sync--spinning': syncingAll }"
            aria-hidden="true"
          />
          {{ syncingAll ? 'Синхронизируем все…' : 'Синхронизировать все' }}
        </AppButton>
        <p class="setlists-sync-caption">Песни и вложения для доступа офлайн</p>
        <p class="setlists-sync-caption">
          {{
            allSyncedAt
              ? `Последняя общая: ${formatSyncTime(allSyncedAt)}`
              : 'Общая синхронизация ещё не выполнялась'
          }}
        </p>
        <p v-if="syncMessage" class="setlists-notice" role="status">{{ syncMessage }}</p>
      </div>
      <p v-if="!createOpen && (error || setlists.error)" class="form-error" role="alert">
        {{ error || setlists.error }}
      </p>
    </div>
  </main>
</template>
<style scoped>
.setlists-page {
  min-height: calc(100dvh - 70px);
}
.setlists-content {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 32px 20px 124px;
}
.setlists-create {
  width: 100%;
  min-height: 48px;
  margin-top: 24px;
  border-radius: 16px;
  box-shadow: none;
  font-size: 1rem;
  font-weight: 650;
  gap: 10px;
}
.setlists-list {
  display: grid;
  gap: 4px;
  margin: 20px -10px 0;
  padding: 0;
  list-style: none;
}
.setlist-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  min-height: 78px;
  padding: 10px;
  border-radius: 14px;
}
.setlist-row--selected {
  background: rgba(73, 102, 168, 0.18);
}
.setlist-open {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 14px;
  align-self: stretch;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  color: var(--foreground);
  background: transparent;
  text-align: left;
}
.setlist-art {
  position: relative;
  display: grid;
  flex: 0 0 54px;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 12px;
  color: var(--muted-strong);
  background: var(--surface-raised);
}
.setlist-row--selected .setlist-art {
  background: rgba(73, 102, 168, 0.2);
}
.setlist-check {
  position: absolute;
  bottom: -3px;
  left: -3px;
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  color: var(--primary-foreground);
  background: var(--primary);
}
.setlist-copy {
  min-width: 0;
}
.setlist-sync-time {
  display: block;
  margin-top: 5px;
  color: var(--muted-strong);
  font-size: 0.7rem;
  line-height: 1.45;
}
.setlist-sync-error {
  order: 1;
  flex-basis: 100%;
  margin: 8px 0 0;
  color: #ffaaa5;
  font-size: 0.82rem;
  line-height: 1.4;
}
.setlists-sync-all {
  display: grid;
  justify-items: center;
  margin-top: 30px;
  text-align: center;
}
.setlists-sync-all .app-button {
  min-height: 46px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 0.92rem;
  font-weight: 600;
}
.setlists-sync-caption {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 0.8rem;
}
.setlist-sync--spinning {
  animation: setlist-sync-spin 1s linear infinite;
}
@keyframes setlist-sync-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .setlist-sync--spinning {
    animation: none;
  }
}
.setlist-copy strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 1.04rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.025em;
}
.setlist-meta {
  display: block;
  margin-top: 6px;
  color: var(--muted-strong);
  font-size: 0.85rem;
  line-height: 1.4;
}
.setlist-selected {
  color: #91b2fa;
  font-weight: 600;
  white-space: nowrap;
}
.setlist-icon-button {
  display: grid;
  flex: 0 0 44px;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  color: var(--muted-strong);
  background: transparent;
}
.setlist-settings {
  margin-left: 4px;
}
.setlist-chevron {
  flex-shrink: 0;
  margin-left: 2px;
  color: var(--muted-strong);
}
.setlist-icon-button:hover {
  color: var(--foreground);
  background: rgba(174, 181, 207, 0.1);
}
.setlist-open:hover .setlist-copy strong {
  color: #fff;
}
.setlist-open:focus-visible,
.setlist-icon-button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.setlist-open:disabled,
.setlist-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}
.setlists-notice {
  margin: 18px 0 0;
  color: var(--muted-strong);
  font-size: 0.88rem;
  line-height: 1.5;
}
.setlists-empty {
  margin: 46px 0 0;
  color: var(--muted-strong);
  text-align: center;
}
.setlists-empty > svg {
  margin: 0 auto;
  color: var(--ring);
}
.setlists-empty h2 {
  margin: 16px 0 10px;
  color: var(--foreground);
  font-size: 1.2rem;
  font-weight: 650;
}
.setlists-empty p {
  max-width: 340px;
  margin: 0 auto;
  font-size: 0.94rem;
  line-height: 1.55;
}
.setlist-dialog-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  background: rgba(6, 8, 18, 0.7);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.setlist-dialog {
  position: fixed;
  z-index: 61;
  top: 50%;
  left: 50%;
  width: min(440px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 22px;
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  outline: none;
  color: var(--foreground);
  background: var(--surface);
  box-shadow: var(--glass-shadow);
  transform: translate(-50%, -50%);
}
.setlist-dialog__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -6px -8px 0 0;
}
.setlist-dialog__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.035em;
}
.setlist-dialog__description {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 0.92rem;
  line-height: 1.5;
}
.create-setlist {
  margin-top: 24px;
}
@media (min-width: 601px) {
  .setlists-content {
    padding: 40px 28px 128px;
  }
}
@media (max-width: 380px) {
  .setlists-content {
    padding-inline: 16px;
  }
  .setlist-open {
    gap: 10px;
  }
  .setlist-art {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
  }
  .setlist-copy strong {
    font-size: 0.98rem;
  }
  .setlist-meta {
    font-size: 0.8rem;
  }
}
</style>
