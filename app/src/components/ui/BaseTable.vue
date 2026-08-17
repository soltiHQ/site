<script setup lang="ts">
defineProps<{
  caption?: string
}>()
</script>

<template>
  <div class="c-table">
    <table>
      <caption v-if="caption">{{ caption }}</caption>
      <slot />
    </table>
  </div>
</template>
