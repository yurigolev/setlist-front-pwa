<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import {
  PhCheck,
  PhCrown,
  PhUserPlus,
  PhEye,
  PhPencilSimple,
  PhDotsThreeVertical,
  PhTrash,
  PhCopy,
  PhX,
} from '@phosphor-icons/vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItemIndicator,
} from 'reka-ui';
import UserAvatar from '@/components/UserAvatar.vue';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSetlistsStore, type Invitation, type Member } from '@/stores/setlists';
import AppButton from '@/components/ui/AppButton.vue';
import AppField from '@/components/ui/AppField.vue';
import AppBackButton from '@/components/ui/AppBackButton.vue';

const setlists = useSetlistsStore();
const router = useRouter();
const title = ref(setlists.current?.title ?? '');
const members = ref<Member[]>([]);
const invitations = ref<Invitation[]>([]);
const tab = ref<'general' | 'members' | 'invitations'>('invitations');
const inviteOpen = ref(false);
function openInvite(): void {
  inviteOpen.value = true;
  inviteUrl.value = '';
  copied.value = false;
  error.value = '';
}
const role = ref<'editor' | 'viewer'>('viewer');
const inviteUrl = ref('');
const copied = ref(false);
const busy = ref(false);
const error = ref('');
const roleLabels = { owner: 'Владелец', editor: 'Редактор', viewer: 'Просмотр' };
const memberRoles = [
  { value: 'owner', label: 'Владелец', description: 'Полный доступ и управление', icon: PhCrown },
  {
    value: 'editor',
    label: 'Редактор',
    description: 'Добавление и изменение песен',
    icon: PhPencilSimple,
  },
  { value: 'viewer', label: 'Просмотр', description: 'Только просмотр и плейбэк', icon: PhEye },
] as const;
async function loadAccess(): Promise<void> {
  members.value = [];
  invitations.value = [];
  if (!setlists.canManage) return;
  const id = setlists.selectedId;
  try {
    const [users, links] = await Promise.all([setlists.members(), setlists.invitations()]);
    if (id !== setlists.selectedId) return;
    members.value = users;
    invitations.value = links;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить доступ';
  }
}
watch(
  () => setlists.current?.title,
  (value) => {
    title.value = value ?? '';
  },
);
watch(
  () => [setlists.selectedId, setlists.canManage],
  () => {
    inviteUrl.value = '';
    void loadAccess();
  },
);
onMounted(loadAccess);
async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await action();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось выполнить действие';
  } finally {
    busy.value = false;
  }
}
function rename(): void {
  if (!title.value.trim()) {
    error.value = 'Укажите название сетлиста';
    return;
  }
  void run(() => setlists.rename(title.value.trim()));
}
function remove(): void {
  if (
    !confirm(
      `Удалить сетлист «${setlists.current?.title}» со всеми песнями и вложениями? Это действие нельзя отменить.`,
    )
  )
    return;
  void run(async () => {
    await setlists.remove();
    await router.replace('/setlists');
  });
}
function changeRole(member: Member, value: string): void {
  if (value === member.role || busy.value || !setlists.canManage) return;
  if (value !== 'owner' && value !== 'editor' && value !== 'viewer') return;
  void run(async () => {
    await setlists.changeRole(member.user.id, value);
    await loadAccess();
  });
}
function removeMember(member: Member): void {
  if (!confirm(`Удалить доступ для ${member.user.displayName}?`)) return;
  void run(async () => {
    await setlists.removeMember(member.user.id);
    await loadAccess();
  });
}
function createInvite(): void {
  void run(async () => {
    const result = await setlists.invite(role.value);
    inviteUrl.value = `${window.location.origin}/invite#token=${encodeURIComponent(result.token)}`;
    copied.value = false;
    invitations.value = await setlists.invitations();
  });
}
function revoke(id: string): void {
  void run(async () => {
    await setlists.revoke(id);
    inviteUrl.value = '';
    invitations.value = await setlists.invitations();
  });
}
function copyLink(): void {
  void run(async () => {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
  });
}
function status(item: Invitation): string {
  if (item.revokedAt) return 'Отозвано';
  if (item.usedAt) return 'Использовано';
  if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) return 'Истекло';
  return 'Действует';
}
</script>
<template>
  <main class="app-page setlist-settings-page">
    <div class="settings-shell">
      <PageHeader :title="setlists.current?.title || 'Сетлист'" subtitle="Настройки сетлиста">
        <template #back
          ><AppBackButton label="Назад к сетлистам" @click="router.push('/setlists')"
        /></template>
      </PageHeader>
      <template v-if="setlists.current?.role === 'owner'">
        <nav class="settings-segments" aria-label="Разделы настроек">
          <button
            v-for="entry in [
              ['general', 'Общее'],
              ['members', 'Участники'],
              ['invitations', 'Приглашения'],
            ] as const"
            :key="entry[0]"
            type="button"
            :class="{ active: tab === entry[0] }"
            :aria-pressed="tab === entry[0]"
            @click="tab = entry[0]"
          >
            {{ entry[1] }}
          </button>
        </nav>
        <p v-if="error || setlists.error" class="form-error" role="alert">
          {{ error || setlists.error }}
        </p>
        <p v-if="!setlists.canManage" class="muted">Для управления требуется интернет.</p>
        <section v-if="tab === 'general'" class="settings-panel">
          <h2>Название сетлиста</h2>
          <form @submit.prevent="rename">
            <AppField id="setlist-title" v-model="title" label="Название" required />
            <AppButton
              type="submit"
              :disabled="busy || !setlists.canManage || title.trim() === setlists.current?.title"
              >Сохранить название</AppButton
            >
          </form>
        </section>
        <section v-else-if="tab === 'members'" class="settings-panel">
          <div class="settings-section-title">
            <h2>
              Участники <small>{{ members.length }}</small>
            </h2>
            <button
              class="settings-invite-small"
              :disabled="busy || !setlists.canManage"
              @click="openInvite"
            >
              <PhUserPlus :size="20" />Пригласить
            </button>
          </div>
          <ul class="settings-rows" aria-label="Участники сетлиста">
            <li v-for="member in members" :key="member.user.id">
              <UserAvatar :name="member.user.displayName" :picture="member.user.picture" />
              <div class="settings-row-copy">
                <strong>{{ member.user.displayName }}</strong
                ><span>{{ roleLabels[member.role] }}</span>
              </div>
              <DropdownMenuRoot>
                <DropdownMenuTrigger
                  class="settings-more member-menu-trigger"
                  :disabled="busy || !setlists.canManage"
                  :aria-label="`Действия: ${member.user.displayName}`"
                  ><PhDotsThreeVertical :size="22" aria-hidden="true"
                /></DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    class="member-menu"
                    align="end"
                    :side-offset="8"
                    :collision-padding="16"
                    :aria-label="`Доступ: ${member.user.displayName}`"
                  >
                    <DropdownMenuLabel class="member-menu-label">Роль участника</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      :model-value="member.role"
                      @update:model-value="changeRole(member, $event)"
                    >
                      <DropdownMenuRadioItem
                        v-for="entry in memberRoles"
                        :key="entry.value"
                        class="member-menu-role"
                        :value="entry.value"
                        :text-value="entry.label"
                        :disabled="busy || !setlists.canManage"
                      >
                        <component :is="entry.icon" :size="20" aria-hidden="true" />
                        <span class="member-menu-copy"
                          ><strong>{{ entry.label }}</strong
                          ><small>{{ entry.description }}</small></span
                        >
                        <DropdownMenuItemIndicator class="member-menu-check"
                          ><PhCheck :size="18" weight="bold" aria-hidden="true"
                        /></DropdownMenuItemIndicator>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator class="member-menu-separator" />
                    <DropdownMenuItem
                      class="member-menu-remove"
                      :disabled="busy || !setlists.canManage"
                      @select="removeMember(member)"
                      ><PhTrash :size="20" aria-hidden="true" />Удалить участника</DropdownMenuItem
                    >
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </li>
          </ul>
        </section>
        <section v-else class="settings-panel">
          <h2>Приглашения</h2>
          <p class="settings-description">Доступ к этому сетлисту.</p>
          <AppButton
            class="settings-invite"
            :disabled="busy || !setlists.canManage"
            @click="openInvite"
            ><PhUserPlus :size="22" />Создать приглашение</AppButton
          >
          <p v-if="!invitations.length" class="settings-empty">Приглашений пока нет.</p>
          <ul v-else class="settings-rows" aria-label="Созданные приглашения">
            <li v-for="item in invitations" :key="item.id">
              <span class="settings-role-icon"
                ><PhEye v-if="item.role === 'viewer'" :size="23" /><PhPencilSimple
                  v-else
                  :size="23"
              /></span>
              <div class="settings-row-copy">
                <strong>{{ roleLabels[item.role] }}</strong
                ><span>{{
                  item.expiresAt
                    ? `До ${new Date(item.expiresAt).toLocaleDateString('ru')}`
                    : 'Одноразовое · Бессрочно'
                }}</span>
              </div>
              <span class="invitation-status" :class="{ active: status(item) === 'Действует' }">{{
                status(item)
              }}</span>
              <DropdownMenuRoot v-if="status(item) === 'Действует'"
                ><DropdownMenuTrigger
                  class="settings-more"
                  :disabled="busy || !setlists.canManage"
                  :aria-label="`Действия приглашения: ${roleLabels[item.role]}`"
                  ><PhDotsThreeVertical :size="22" /></DropdownMenuTrigger
                ><DropdownMenuPortal
                  ><DropdownMenuContent class="settings-menu" :side-offset="6"
                    ><DropdownMenuItem class="settings-menu-item" @select="revoke(item.id)"
                      ><PhX :size="18" />Отозвать приглашение</DropdownMenuItem
                    ></DropdownMenuContent
                  ></DropdownMenuPortal
                ></DropdownMenuRoot
              >
            </li>
          </ul>
        </section>
        <button class="settings-delete" :disabled="busy || !setlists.canManage" @click="remove">
          <PhTrash :size="21" />Удалить сетлист
        </button>
      </template>
      <p v-else class="muted">Настройки доступны владельцу сетлиста.</p>
    </div>
    <DialogRoot v-model:open="inviteOpen"
      ><DialogPortal
        ><DialogOverlay class="settings-dialog-overlay" /><DialogContent class="settings-dialog">
          <DialogTitle class="settings-dialog-title">{{
            inviteUrl ? 'Ссылка готова' : 'Пригласить в сетлист'
          }}</DialogTitle>
          <DialogDescription class="settings-description"
            >{{ setlists.current?.title }} · Одноразовая ссылка без срока
            действия</DialogDescription
          >
          <DialogClose class="settings-dialog-close" aria-label="Закрыть"
            ><PhX :size="22"
          /></DialogClose>
          <form v-if="!inviteUrl" @submit.prevent="createInvite">
            <label class="field" for="invite-role"
              ><span class="field__label">Роль</span
              ><select id="invite-role" v-model="role" class="field__control">
                <option value="viewer">Просмотр</option>
                <option value="editor">Редактор</option>
              </select></label
            ><AppButton type="submit" :disabled="busy || !setlists.canManage"
              ><PhUserPlus :size="20" />Создать приглашение</AppButton
            >
          </form>
          <div v-else class="invite-result">
            <label for="invite-url">Ссылка приглашения</label
            ><input
              id="invite-url"
              class="field__control"
              :value="inviteUrl"
              readonly
              @focus="($event.target as HTMLInputElement).select()"
            /><AppButton :disabled="busy" @click="copyLink"
              ><PhCopy :size="20" />{{ copied ? 'Скопировано' : 'Копировать ссылку' }}</AppButton
            >
            <p class="settings-description">
              Сохраните ссылку сейчас: повторно показать её нельзя.
            </p>
          </div>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        </DialogContent></DialogPortal
      ></DialogRoot
    >
  </main>
</template>
<style>
.settings-shell {
  display: flex;
  flex-direction: column;
  width: min(100% - 40px, 680px);
  min-height: calc(100dvh - 80px);
  margin: auto;
  padding: 24px 0 130px;
}
.settings-shell h1 {
  margin: 0;
  font-size: clamp(1.65rem, 5vw, 2.3rem);
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
}
.settings-segments {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 16px;
  gap: 3px;
}
.settings-segments button {
  min-height: 44px;
  padding: 8px 4px;
  border: 0;
  border-radius: 12px;
  color: var(--muted-strong);
  background: transparent;
  font-size: 0.82rem;
}
.settings-segments button.active {
  background: var(--primary);
  color: var(--primary-foreground);
}
.settings-panel {
  margin-top: 28px;
}
.settings-panel h2 {
  margin: 0;
  font-size: 1.2rem;
}
.settings-panel h2 small {
  font-size: 0.85rem;
  color: var(--muted);
  margin-left: 6px;
}
.settings-description {
  color: var(--muted-strong);
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 8px 0 22px;
}
.settings-panel form,
.settings-dialog form,
.invite-result {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}
.settings-invite {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  min-height: 48px;
}
.settings-rows {
  list-style: none;
  padding: 0;
  margin: 22px 0;
  border-top: 1px solid var(--border-soft);
}
.settings-rows > li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 90px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-soft);
}
.settings-row-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 5px;
}
.settings-row-copy strong {
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}
.settings-row-copy > span {
  color: var(--muted-strong);
  font-size: 0.72rem;
  line-height: 1.4;
}
.settings-role-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--muted-strong);
  background: var(--surface-raised);
}
.invitation-status {
  font-size: 0.7rem;
  border-radius: 999px;
  padding: 7px 9px;
  color: var(--muted-strong);
  background: var(--surface-raised);
}
.invitation-status.active {
  background: rgba(100, 190, 145, 0.12);
  color: #9cd6b5;
}
.settings-more {
  display: grid;
  place-items: center;
  width: 32px;
  min-height: 44px;
  padding: 0;
  flex-shrink: 0;
  border: 0;
  color: var(--muted-strong);
  background: transparent;
}
.settings-delete {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 22px 0 0;
  border: 0;
  border-top: 1px solid var(--border-soft);
  color: #efa5a7;
  background: transparent;
  min-height: 64px;
  text-align: left;
  font-size: 0.9rem;
}
.settings-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.settings-invite-small {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--primary);
  color: white;
  font-size: 0.8rem;
}
.settings-empty {
  color: var(--muted-strong);
  padding: 22px 0;
  font-size: 0.9rem;
}
.member-menu-trigger {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}
.member-menu-trigger:hover,
.member-menu-trigger[data-state='open'] {
  color: var(--foreground);
  background: var(--surface-raised);
}
.member-menu-trigger:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.member-menu {
  z-index: 85;
  width: min(288px, calc(100vw - 32px));
  max-height: var(--reka-dropdown-menu-content-available-height);
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--foreground);
  background: var(--surface);
  box-shadow: var(--glass-shadow);
}
.member-menu-label {
  padding: 10px 12px 8px;
  color: var(--muted-strong);
  font-size: 0.72rem;
  font-weight: 600;
}
.member-menu-role,
.member-menu-remove {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 12px;
  border-radius: 10px;
  outline: none;
  cursor: pointer;
  user-select: none;
}
.member-menu-role > svg {
  flex-shrink: 0;
  color: var(--muted-strong);
}
.member-menu-copy {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}
.member-menu-copy strong {
  font-size: 0.88rem;
  font-weight: 550;
  line-height: 1.3;
}
.member-menu-copy small {
  color: var(--muted-strong);
  font-size: 0.7rem;
  line-height: 1.4;
}
.member-menu-role[data-state='checked'] {
  background: var(--surface-raised);
}
.member-menu-check {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--ring);
}
.member-menu-role[data-highlighted],
.member-menu-remove[data-highlighted] {
  background: var(--surface-raised);
  box-shadow: inset 0 0 0 1px var(--border);
}
.member-menu-separator {
  height: 1px;
  margin: 6px;
  background: var(--border-soft);
}
.member-menu-remove {
  min-height: 44px;
  color: #efa5a7;
  font-size: 0.82rem;
}
.member-menu-remove > svg {
  flex-shrink: 0;
}
.member-menu [data-disabled] {
  opacity: 0.5;
  cursor: default;
}

.settings-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.65);
}
.settings-dialog {
  position: fixed;
  z-index: 81;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(440px, calc(100% - 32px));
  max-height: 85dvh;
  overflow-y: auto;
  padding: 28px 24px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--background);
}
.settings-dialog-title {
  margin: 0;
  padding-right: 30px;
  font-size: 1.3rem;
}
.settings-dialog-close {
  position: absolute;
  top: 14px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--foreground);
}
.settings-dialog .app-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.invite-result input {
  font-size: 0.8rem;
}
.settings-menu {
  z-index: 85;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--glass-shadow);
}
.settings-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  color: #efa5a7;
  outline: none;
  font-size: 0.85rem;
  cursor: pointer;
}
.settings-menu-item[data-highlighted] {
  background: var(--surface-raised);
}
.settings-shell button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 380px) {
  .settings-shell {
    width: calc(100% - 32px);
  }
  .settings-rows > li {
    gap: 8px;
  }
  .invitation-status {
    padding-inline: 6px;
    font-size: 0.65rem;
  }
}
</style>
