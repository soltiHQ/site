<script setup lang="ts">
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div'
type HeadingSize = 'display' | 'h1' | 'h2' | 'h3'

withDefaults(
  defineProps<{
    as?: HeadingTag
    size?: HeadingSize
  }>(),
  {
    as: 'h2',
    size: 'h2',
  },
)
</script>

<template>
  <component :is="as" :class="['c-heading', `c-heading--${size}`]">
    <slot />
  </component>
</template>
