<script setup lang="ts">
type InputType = 'text' | 'email' | 'url' | 'search' | 'password'

withDefaults(
  defineProps<{
    id: string
    type?: InputType
    placeholder?: string
    autocomplete?: string
    describedBy?: string
    invalid?: boolean
    required?: boolean
    disabled?: boolean
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    autocomplete: undefined,
    describedBy: undefined,
    invalid: false,
    required: false,
    disabled: false,
  },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    :id="id"
    v-model="model"
    class="c-control"
    :type="type"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :aria-describedby="describedBy"
    :aria-invalid="invalid"
    :required="required"
    :disabled="disabled"
  />
</template>
