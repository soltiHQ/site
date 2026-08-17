<script setup lang="ts">
withDefaults(
  defineProps<{
    id?: string
  }>(),
  {
    id: 'main-content',
  },
)
</script>

<template>
  <main :id="id" class="c-base-view">
    <slot />
  </main>
</template>
