<script setup lang="ts">
withDefaults(
  defineProps<{
    inverse?: boolean
  }>(),
  {
    inverse: false,
  },
)
</script>

<template>
  <span :class="['wordmark', { 'wordmark--inverse': inverse }]" aria-label="Solti">
    <span aria-hidden="true">solti</span>
    <span class="wordmark__beat" aria-hidden="true"></span>
  </span>
</template>
