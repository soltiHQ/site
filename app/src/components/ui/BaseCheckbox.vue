<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    label: string
    description?: string
    disabled?: boolean
  }>(),
  {
    description: undefined,
    disabled: false,
  },
)

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="c-check" :for="id">
    <input :id="id" v-model="model" type="checkbox" :disabled="disabled" />
    <span class="c-check__copy">
      <span class="c-check__label">{{ label }}</span>
      <span v-if="description" class="c-check__description">{{ description }}</span>
    </span>
  </label>
</template>
