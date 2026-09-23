<template>
  <section v-bind="$attrs" class="app-card">
    <header v-if="$slots.header" class="app-card__header"><slot name="header" /></header>
    <div class="app-card__content"><slot /></div>
  </section>
</template>
