<script setup lang="ts">
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/lib/variants'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  variant?: 'primary' | 'ghost' | 'icon'
}>(), { variant: 'primary' })
</script>

<template>
  <button v-bind="$attrs" :class="cn(buttonVariants({ variant }), $attrs.class)">
    <slot />
  </button>
</template>
