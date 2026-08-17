<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    wordmark: string
    inverse?: boolean
  }>(),
  {
    inverse: false,
  },
)
</script>

<template>
  <span :class="['wordmark', { 'wordmark--inverse': inverse }]" :aria-label="label">
    <span aria-hidden="true">{{ wordmark }}</span>
    <span class="wordmark__beat" aria-hidden="true"></span>
  </span>
</template>
