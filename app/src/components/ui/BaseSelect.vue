<script setup lang="ts">
export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

withDefaults(
  defineProps<{
    id: string
    options: SelectOption[]
    placeholder?: string
    describedBy?: string
    invalid?: boolean
    required?: boolean
    disabled?: boolean
  }>(),
  {
    placeholder: undefined,
    describedBy: undefined,
    invalid: false,
    required: false,
    disabled: false,
  },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <select
    :id="id"
    v-model="model"
    class="c-control"
    :aria-describedby="describedBy"
    :aria-invalid="invalid"
    :required="required"
    :disabled="disabled"
  >
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>
