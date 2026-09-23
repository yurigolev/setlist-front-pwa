<script setup lang="ts">
import { Label } from 'reka-ui'

const props = withDefaults(defineProps<{
  id: string
  label: string
  modelValue?: string
  multiline?: boolean
  rows?: number
  required?: boolean
  invalid?: boolean
}>(), { modelValue: '', multiline: false, rows: 4, required: false, invalid: false })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="field">
    <Label :for="props.id" class="field__label">{{ props.label }}<span v-if="props.required"> *</span></Label>
    <textarea
      v-if="props.multiline"
      :id="props.id"
      :value="props.modelValue"
      :rows="props.rows"
      class="field__control field__control--textarea"
      :aria-invalid="props.invalid"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      :id="props.id"
      :value="props.modelValue"
      class="field__control"
      :aria-invalid="props.invalid"
      autocomplete="off"
      :required="props.required"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
