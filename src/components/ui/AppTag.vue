<script setup lang="ts">
import { computed } from 'vue';
import { PhCheck, PhTag, PhX } from '@phosphor-icons/vue';
import { isTagColor } from '@/domain/tagColor';
const props = withDefaults(
  defineProps<{
    label: string;
    color?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    action?: 'edit' | 'remove' | 'toggle' | 'reset';
    selected?: boolean;
    disabled?: boolean;
    icon?: boolean;
  }>(),
  { size: 'md', icon: true, action: undefined, color: undefined },
);
const tagColor = computed(() => (isTagColor(props.color) ? props.color : undefined));
defineEmits<{ click: [event: MouseEvent] }>();
</script>
<template>
  <component
    :is="action ? 'button' : 'span'"
    class="app-tag"
    :class="[
      `app-tag--${size}`,
      {
        'app-tag--interactive': action,
        'app-tag--selected': selected,
        'app-tag--colored': tagColor,
      },
    ]"
    :style="tagColor ? { '--tag-color': tagColor } : undefined"
    :type="action ? 'button' : undefined"
    :disabled="action ? disabled : undefined"
    :aria-label="
      action === 'edit'
        ? `Редактировать тег ${label}`
        : action === 'remove'
          ? `Убрать тег ${label}`
          : undefined
    "
    :aria-haspopup="action === 'edit' ? 'dialog' : undefined"
    :aria-pressed="action === 'toggle' ? Boolean(selected) : undefined"
    @click="action && $emit('click', $event)"
  >
    <PhX v-if="action === 'reset'" class="app-tag__icon" aria-hidden="true" />
    <PhCheck
      v-else-if="action === 'toggle' && selected"
      class="app-tag__icon"
      weight="bold"
      aria-hidden="true"
    />
    <PhTag v-else-if="icon" class="app-tag__icon" aria-hidden="true" />
    <span class="app-tag__label">{{ label }}</span>
    <PhX v-if="action === 'remove'" class="app-tag__action" aria-hidden="true" />
  </component>
</template>
<style scoped>
.app-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
  padding: 6px 11px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--foreground);
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  vertical-align: middle;
}
.app-tag__label {
  min-width: 0;
  overflow-wrap: anywhere;
}
.app-tag__icon,
.app-tag__action {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: var(--muted-strong);
}
.app-tag--interactive {
  cursor: pointer;
  transition:
    border-color 150ms,
    background 150ms;
}
.app-tag--interactive:hover:not(:disabled) {
  background: var(--surface-raised);
  border-color: var(--muted);
}
.app-tag--interactive:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.app-tag.app-tag--selected,
.app-tag--selected.app-tag--interactive:hover:not(:disabled) {
  border-color: rgba(73, 102, 168, 0.76);
  background: rgba(73, 102, 168, 0.24);
  color: #d5def5;
}
.app-tag--selected .app-tag__icon {
  color: inherit;
}
.app-tag:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.app-tag--xs {
  padding: 2px 6px;
  gap: 4px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--muted-strong);
}
.app-tag--xs .app-tag__icon,
.app-tag--xs .app-tag__action {
  width: 12px;
  height: 12px;
}
.app-tag--sm {
  padding: 3px 8px;
  gap: 5px;
  font-size: 12px;
}
.app-tag--sm .app-tag__icon,
.app-tag--sm .app-tag__action {
  width: 14px;
  height: 14px;
}
.app-tag--lg {
  padding: 12px 22px;
  gap: 12px;
  min-height: 56px;
  font-size: 16px;
  font-weight: 500;
}
.app-tag--lg .app-tag__icon {
  width: 22px;
  height: 22px;
}
.app-tag--lg .app-tag__action {
  margin-left: 14px;
  width: 23px;
  height: 23px;
}
.app-tag--colored {
  background: color-mix(in srgb, var(--tag-color) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--tag-color) 40%, var(--surface));
  color: var(--foreground);
}
.app-tag--colored .app-tag__icon {
  color: color-mix(in srgb, var(--tag-color) 65%, var(--foreground));
}
.app-tag--colored.app-tag--interactive:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tag-color) 23%, var(--surface));
  border-color: color-mix(in srgb, var(--tag-color) 65%, var(--surface));
}
.app-tag--colored.app-tag--selected,
.app-tag--colored.app-tag--selected.app-tag--interactive:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tag-color) 28%, var(--surface));
  border-color: var(--tag-color);
  box-shadow: 0 0 0 1px var(--tag-color);
  color: var(--foreground);
}
@media (max-width: 480px) {
  .app-tag--lg {
    padding: 10px 18px;
    gap: 10px;
    min-height: 48px;
    font-size: 15px;
  }
  .app-tag--lg .app-tag__action {
    margin-left: 6px;
  }
}
</style>
