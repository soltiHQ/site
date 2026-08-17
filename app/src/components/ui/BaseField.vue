<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    hint?: string
    error?: string
    required?: boolean
  }>(),
  {
    hint: undefined,
    error: undefined,
    required: false,
  },
)

const hintId = computed(() => `${props.id}-hint`)
const errorId = computed(() => `${props.id}-error`)
const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint) ids.push(hintId.value)
  if (props.error) ids.push(errorId.value)
  return ids.length > 0 ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="c-field">
    <label class="c-field__label" :for="id">
      {{ label }}
      <span v-if="required" class="c-field__required" aria-hidden="true">*</span>
      <span v-if="required" class="u-visually-hidden"> (required)</span>
    </label>
    <slot :described-by="describedBy" :invalid="Boolean(error)" :required="required" />
    <p v-if="hint" :id="hintId" class="c-field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="c-field__error" aria-live="polite">{{ error }}</p>
  </div>
</template>
