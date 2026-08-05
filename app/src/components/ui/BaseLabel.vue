<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: 'span' | 'p' | 'div'
  }>(),
  {
    as: 'span',
  },
)
</script>

<template>
  <component :is="as" class="c-label">
    <slot />
  </component>
</template>
