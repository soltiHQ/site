<script setup lang="ts">
type TextTag = 'p' | 'span' | 'div' | 'small'
type TextSize = 'body' | 'small' | 'caption'
type TextTone = 'default' | 'muted' | 'subtle'

withDefaults(
  defineProps<{
    as?: TextTag
    size?: TextSize
    tone?: TextTone
  }>(),
  {
    as: 'p',
    size: 'body',
    tone: 'default',
  },
)
</script>

<template>
  <component :is="as" :class="['c-text', `c-text--${size}`, `c-text--${tone}`]">
    <slot />
  </component>
</template>
