<script setup lang="ts">
import type { ActionVariant } from '@/types/ui'

type NativeButtonType = 'button' | 'submit' | 'reset'

withDefaults(
  defineProps<{
    variant?: ActionVariant
    type?: NativeButtonType
    disabled?: boolean
    block?: boolean
  }>(),
  {
    variant: 'secondary',
    type: 'button',
    disabled: false,
    block: false,
  },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="['c-button', `c-button--${variant}`, { 'c-button--block': block }]"
  >
    <slot />
  </button>
</template>
