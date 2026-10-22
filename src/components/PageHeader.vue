<script setup lang="ts">
import { defineComponent, h, inject, onUnmounted, useSlots } from 'vue';
import PageHeaderContent from './PageHeaderContent.vue';
import { pageHeaderKey } from '@/layouts/pageHeader';

defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{ title?: string; subtitle?: string; titleTag?: 'h1' | 'h2' | 'p' }>(),
  { titleTag: 'h1', title: undefined, subtitle: undefined },
);
const slots = useSlots();
const pageHeader = inject(pageHeaderKey);
if (!pageHeader) throw new Error('PageHeader requires AppPageFrame');

// Render ordinary DOM inside the frame: Teleports disappear on unmount
// before the outgoing page finishes its transition.
const registration = {
  withBack: !!slots.back,
  heading: defineComponent({ render: () => h(PageHeaderContent, props, slots) }),
  context: defineComponent({ render: () => slots.context?.() ?? null }),
};
pageHeader.value = registration;
onUnmounted(() => {
  if (pageHeader.value === registration) pageHeader.value = undefined;
});
</script>

<template />
