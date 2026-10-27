<script setup lang="ts">
import AppTag from '@/components/ui/AppTag.vue';
import { computed } from 'vue';
import { useSongsStore } from '@/stores/songs';

const props = withDefaults(
  defineProps<{ disabled?: boolean; label?: string; filter?: boolean }>(),
  { label: 'Теги песни', filter: false },
);
const selected = defineModel<string[]>({ default: () => [] });
const store = useSongsStore();
const selectedTags = computed(() => store.tags.filter((tag) => selected.value.includes(tag.id)));
function toggle(id: string): void {
  if (props.disabled) return;
  selected.value = selected.value.includes(id)
    ? selected.value.filter((value) => value !== id)
    : [...selected.value, id];
}
</script>

<template>
  <div class="tag-picker" :class="{ 'tag-picker--filter': filter }">
    <section>
      <div v-if="!filter" class="tag-picker__header">
        <h2 class="tag-picker__heading">
          {{ label }}
          <span v-if="selectedTags.length" class="tag-picker__count">{{
            selectedTags.length
          }}</span>
        </h2>
      </div>
      <div class="tag-picker__body">
        <div class="tag-picker__options" :aria-label="label">
          <AppTag
            v-for="tag in store.tags"
            :key="tag.id"
            :label="tag.name"
            :color="tag.color"
            :size="filter ? 'md' : 'lg'"
            action="toggle"
            :selected="selected.includes(tag.id)"
            :disabled="disabled"
            @click="toggle(tag.id)"
          />
          <AppTag
            v-if="filter && selectedTags.length"
            class="tag-picker__reset"
            label="Сбросить"
            action="reset"
            :disabled="disabled"
            @click="selected = []"
          />
        </div>
        <p v-if="!store.tags.length" class="muted">Добавьте теги в настройках сетлиста.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tag-picker {
  margin-block: 1rem;
  min-width: 0;
}
.tag-picker__body {
  display: grid;
  gap: 0.75rem;
  padding-block: 0.6rem;
}
.tag-picker__heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 20px;
  line-height: 1.4;
  font-weight: 600;
}
.tag-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.tag-picker__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding-inline: 7px;
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--muted-strong);
  font-size: 14px;
  font-weight: 500;
}
.tag-picker--filter {
  margin-block: 16px 0;
  padding-bottom: 12px;
}
.tag-picker--filter :deep(.app-tag) {
  min-height: 40px;
  padding: 8px 14px;
}
.tag-picker__options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.tag-picker__options :deep(.app-tag.tag-picker__reset) {
  border: 1px dashed rgba(237, 155, 159, 0.55);
  background: rgba(165, 60, 75, 0.12);
  color: #ed9b9f;
}
.tag-picker__options :deep(.app-tag.tag-picker__reset:hover:not(:disabled)) {
  border-color: #ed9b9f;
  background: rgba(165, 60, 75, 0.22);
}
.tag-picker__options :deep(.tag-picker__reset .app-tag__icon) {
  color: inherit;
}
@media (max-width: 480px) {
  .tag-picker__options {
    gap: 10px;
  }
}
</style>
