<script setup lang="ts">
type BadgeTone = 'neutral' | 'live' | 'danger'

withDefaults(
  defineProps<{
    tone?: BadgeTone
  }>(),
  {
    tone: 'neutral',
  },
)
</script>

<template>
  <span :class="['c-badge', `c-badge--${tone}`]">
    <slot />
  </span>
</template>
