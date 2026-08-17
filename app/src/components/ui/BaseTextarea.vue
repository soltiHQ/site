<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    placeholder?: string
    rows?: number
    describedBy?: string
    invalid?: boolean
    required?: boolean
    disabled?: boolean
  }>(),
  {
    placeholder: undefined,
    rows: 5,
    describedBy: undefined,
    invalid: false,
    required: false,
    disabled: false,
  },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <textarea
    :id="id"
    v-model="model"
    class="c-control"
    :placeholder="placeholder"
    :rows="rows"
    :aria-describedby="describedBy"
    :aria-invalid="invalid"
    :required="required"
    :disabled="disabled"
  ></textarea>
</template>
