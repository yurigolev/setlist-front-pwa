<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue';
import { PhCheck, PhPalette, PhProhibit } from '@phosphor-icons/vue';
import 'vue-color/style.css';
import { isTagColor, TAG_COLORS } from '@/domain/tagColor';

const ChromePicker = defineAsyncComponent(() =>
  import('vue-color').then((module) => module.ChromePicker),
);

defineProps<{ disabled?: boolean }>();
const color = defineModel<string | null>({ default: null });
const custom = ref(false);
const hex = ref(color.value ?? '');
watch(color, (value) => {
  hex.value = value ?? '';
});

function choose(value: string | null): void {
  color.value = value?.toUpperCase() ?? null;
  hex.value = color.value ?? '';
}
function toggleCustom(): void {
  custom.value = !custom.value;
  if (custom.value && !color.value) choose(TAG_COLORS[0].value);
}
function editHex(event: Event): void {
  hex.value = (event.target as HTMLInputElement).value;
  if (isTagColor(hex.value)) color.value = hex.value.toUpperCase();
}
</script>

<template>
  <fieldset class="tag-color" :disabled="disabled">
    <legend>Цвет</legend>
    <div class="tag-color__palette" aria-label="Готовые цвета">
      <button
        v-for="option in TAG_COLORS"
        :key="option.value"
        type="button"
        class="tag-color__swatch"
        :style="{ '--swatch': option.value }"
        :aria-label="option.name"
        :aria-pressed="color === option.value"
        @click="choose(option.value)"
      >
        <PhCheck v-if="color === option.value" :size="18" weight="bold" aria-hidden="true" />
      </button>
    </div>
    <div class="tag-color__actions">
      <button
        type="button"
        :aria-pressed="color === null"
        @click="
          choose(null);
          custom = false;
        "
      >
        <PhProhibit :size="18" aria-hidden="true" />Без цвета
      </button>
      <button type="button" :aria-expanded="custom" @click="toggleCustom">
        <PhPalette :size="18" aria-hidden="true" />Свой цвет
      </button>
    </div>
    <div v-if="custom" class="tag-color__custom" :inert="disabled || undefined">
      <ChromePicker
        :model-value="color ?? TAG_COLORS[0].value"
        :disable-alpha="true"
        :disable-fields="true"
        aria-label="Выбор цвета тега"
        @update:model-value="choose"
      />
      <label class="tag-color__hex">
        <span>HEX</span>
        <input
          :value="hex"
          class="field__control"
          name="tag-color"
          aria-label="Цвет HEX"
          :aria-invalid="!isTagColor(hex)"
          placeholder="#82A5ED"
          pattern="#[0-9a-fA-F]{6}"
          maxlength="7"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          required
          @input="editHex"
          @keydown.enter.prevent
        />
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.tag-color {
  min-width: 0;
  padding: 0;
  margin: 24px 0 0;
  border: 0;
}
.tag-color legend {
  margin-bottom: 12px;
  padding: 0;
  color: var(--muted-strong);
  font-size: 16px;
}
.tag-color__palette {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}
.tag-color__swatch {
  display: grid;
  place-items: center;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: color-mix(in srgb, var(--swatch) 24%, var(--surface));
  color: var(--swatch);
  cursor: pointer;
}
.tag-color__swatch::before {
  content: '';
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--swatch);
  grid-area: 1 / 1;
}
.tag-color__swatch svg {
  grid-area: 1 / 1;
  z-index: 1;
  color: #171d26;
}
.tag-color__swatch[aria-pressed='true'] {
  border-color: var(--swatch);
  box-shadow: 0 0 0 1px var(--swatch);
}
.tag-color__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.tag-color__actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--muted-strong);
  font-size: 14px;
  cursor: pointer;
}
.tag-color__actions button[aria-pressed='true'],
.tag-color__actions button[aria-expanded='true'] {
  background: var(--surface-raised);
  border-color: var(--border);
  color: var(--foreground);
}
.tag-color__custom {
  --vc-picker-bg: var(--foreground);
  --vc-body-bg: var(--surface-raised);
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-raised);
}
.tag-color__custom :deep(.vc-chrome-picker) {
  width: 100%;
  border-radius: 10px;
  box-shadow: none;
  font-family: inherit;
  overflow: hidden;
}
.tag-color__custom :deep(.saturation) {
  padding-bottom: 46%;
  border-radius: 8px;
}
.tag-color__custom :deep(.body) {
  padding: 16px 6px;
}
.tag-color__custom :deep(.hue-wrap) {
  height: 18px;
}
.tag-color__custom :deep(.hue-wrap .picker) {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transform: translate(-10px, -2px);
}
.tag-color__hex {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--muted-strong);
  font-size: 13px;
}
.tag-color__hex input {
  min-width: 0;
  min-height: 44px;
  font-family: ui-monospace, monospace;
  text-transform: uppercase;
}
.tag-color__hex input[aria-invalid='true'] {
  border-color: #ed9b9f;
}
.tag-color button:focus-visible,
.tag-color__custom :deep([tabindex='0']:focus-visible) {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.tag-color:disabled {
  opacity: 0.5;
}
</style>
