<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()

const product = computed(() => frontmatter.value.productTitle as string | undefined)
const line = computed(() => frontmatter.value.compatibilityLine as string | undefined)
const version = computed(() => frontmatter.value.version as string | undefined)
const sourceUrl = computed(() => frontmatter.value.sourceUrl as string | undefined)
</script>

<template>
  <div v-if="product && line && version" class="docs-version" aria-label="Documentation version">
    <span>{{ product }} {{ line }}</span>
    <a v-if="sourceUrl" :href="sourceUrl">source v{{ version }}</a>
  </div>
</template>
