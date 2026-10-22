<script setup lang="ts">
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ title?: string; subtitle?: string; titleTag?: 'h1' | 'h2' | 'p' }>(), {
  titleTag: 'h1',
  title: undefined,
  subtitle: undefined,
});
</script>

<template>
  <div class="page-header" :class="{ 'page-header--with-back': !!$slots.back }">
    <div v-if="$slots.back" class="page-header__back"><slot name="back" /></div>
    <div class="page-header__heading">
      <slot
        ><component :is="titleTag" class="page-header__title">{{ title }}</component>
        <p v-if="subtitle">{{ subtitle }}</p></slot
      >
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
}
.page-header__heading {
  flex: 1;
  min-width: 0;
}
.page-header__title {
  margin: 0;
  font-size: clamp(1.8rem, 8vw, 2.5rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
}
.page-header__heading > p:not(.page-header__title) {
  margin: 8px 0 0;
  color: var(--muted-strong);
  line-height: 1.5;
}

.page-header__back,
.page-header__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}
</style>
