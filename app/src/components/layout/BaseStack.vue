<script setup lang="ts">
import { computed } from 'vue'

import type { SpaceStep } from '@/types/ui'

const props = withDefaults(
  defineProps<{
    as?: string
    space?: SpaceStep
  }>(),
  {
    as: 'div',
    space: 4,
  },
)

const stackStyle = computed(() => ({
  '--stack-space': `var(--sp-${props.space})`,
}))
</script>

<template>
  <component :is="as" class="o-stack" :style="stackStyle">
    <slot />
  </component>
</template>
