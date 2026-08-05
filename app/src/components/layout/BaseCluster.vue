<script setup lang="ts">
import { computed } from 'vue'

import type { SpaceStep } from '@/types/ui'

type Alignment = 'start' | 'center' | 'end' | 'baseline' | 'stretch'

const props = withDefaults(
  defineProps<{
    as?: string
    space?: SpaceStep
    align?: Alignment
  }>(),
  {
    as: 'div',
    space: 3,
    align: 'center',
  },
)

const clusterStyle = computed(() => ({
  '--cluster-space': `var(--sp-${props.space})`,
  '--cluster-align': props.align,
}))
</script>

<template>
  <component :is="as" class="o-cluster" :style="clusterStyle">
    <slot />
  </component>
</template>
