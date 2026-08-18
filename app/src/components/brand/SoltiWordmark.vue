<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    wordmark: string
    inverse?: boolean
    decorative?: boolean
  }>(),
  {
    inverse: false,
    decorative: false,
  },
)
</script>

<template>
  <span
    :class="['wordmark', { 'wordmark--inverse': inverse }]"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <span aria-hidden="true">{{ wordmark }}</span>
    <span class="wordmark__beat" aria-hidden="true"></span>
  </span>
</template>
