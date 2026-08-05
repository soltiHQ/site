<script setup lang="ts">
import { computed } from 'vue'

import type { SpaceStep } from '@/types/ui'

type ColumnCount = 1 | 2 | 3 | 4

const props = withDefaults(
  defineProps<{
    as?: string
    columns?: ColumnCount
    space?: SpaceStep
  }>(),
  {
    as: 'div',
    columns: 2,
    space: 5,
  },
)

const gridStyle = computed(() => ({
  '--grid-columns': props.columns,
  '--grid-space': `var(--sp-${props.space})`,
}))
</script>

<template>
  <component :is="as" class="o-grid" :style="gridStyle">
    <slot />
  </component>
</template>
