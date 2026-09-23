<script setup lang="ts">
import { computed } from 'vue'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const model = computed({
  get: () => props.modelValue,
  set: (value: string | undefined) => {
    if (value) emit('update:modelValue', value)
  },
})
</script>

<template>
  <ToggleGroupRoot
    v-model="model"
    v-bind="$attrs"
    type="single"
    :roving-focus="false"
    as="div"
    class="app-segment"
    aria-label="Порядок песен"
  >
    <ToggleGroupItem value="alphabetical" class="app-segment__item">А – Я</ToggleGroupItem>
    <ToggleGroupItem value="recent" class="app-segment__item">Недавние</ToggleGroupItem>
  </ToggleGroupRoot>
</template>
