<script setup lang="ts">
import type { ActionVariant } from '@/types/ui'

withDefaults(
  defineProps<{
    href: string
    variant?: ActionVariant
    external?: boolean
    block?: boolean
  }>(),
  {
    variant: 'secondary',
    external: false,
    block: false,
  },
)
</script>

<template>
  <a
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noreferrer' : undefined"
    :class="['c-button', `c-button--${variant}`, { 'c-button--block': block }]"
  >
    <slot />
  </a>
</template>
