<script setup lang="ts">
import { computed } from 'vue'

import type { SpaceStep } from '@/types/ui'

type SurfaceTag = 'div' | 'section' | 'article' | 'aside'
type SurfaceTone = 'canvas' | 'subtle' | 'inverse'

const props = withDefaults(
  defineProps<{
    as?: SurfaceTag
    tone?: SurfaceTone
    bordered?: boolean
    padding?: SpaceStep
  }>(),
  {
    as: 'div',
    tone: 'canvas',
    bordered: false,
    padding: 5,
  },
)

const surfaceStyle = computed(() => ({
  '--surface-padding': `var(--sp-${props.padding})`,
}))
</script>

<template>
  <component
    :is="as"
    :class="['c-surface', `c-surface--${tone}`, { 'c-surface--bordered': bordered }]"
    :style="surfaceStyle"
  >
    <slot />
  </component>
</template>
