<script setup lang="ts">
defineProps<{
  labelledBy?: string
}>()
</script>

<template>
  <section class="c-panel" :aria-labelledby="labelledBy">
    <header v-if="$slots.header" class="c-panel__header">
      <slot name="header" />
    </header>
    <div class="c-panel__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="c-panel__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>
