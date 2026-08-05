<script setup lang="ts">
import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseFullBleed from '@/components/layout/BaseFullBleed.vue'
import BaseStack from '@/components/layout/BaseStack.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseText from '@/components/ui/BaseText.vue'
import BaseView from '@/components/view/BaseView.vue'
</script>

<template>
  <BaseView class="content-view">
    <section class="o-section content-view__hero" aria-labelledby="preview-title">
      <BaseContainer class="content-view__hero-inner">
        <BaseStack :space="6">
          <BaseLabel>ContentView / transparency preview</BaseLabel>
          <BaseHeading id="preview-title" as="h1" size="display">
            Structure before content.
          </BaseHeading>
          <BaseText tone="muted">
            This temporary copy exists only to make the header surface, blur, transparency, and
            scroll behavior visible while the real site content is still being designed.
          </BaseText>
        </BaseStack>
      </BaseContainer>
    </section>

    <BaseContainer>
      <BaseFullBleed
        as="section"
        class="content-view__full-bleed-preview"
        aria-labelledby="full-bleed-preview-title"
      >
        <BaseStack :space="4" class="content-view__full-bleed-preview-copy">
          <BaseLabel>BaseFullBleed / viewport width</BaseLabel>
          <BaseHeading id="full-bleed-preview-title" as="h2" size="h1">
            Edge-to-edge content.
          </BaseHeading>
        </BaseStack>
      </BaseFullBleed>
    </BaseContainer>

    <section class="o-section content-view__copy" aria-labelledby="scroll-preview-title">
      <BaseContainer class="content-view__columns">
        <BaseLabel>Scroll / behavior preview</BaseLabel>
        <BaseStack :space="5">
          <BaseHeading id="scroll-preview-title" as="h2" size="h1">
            Content moves behind the glass.
          </BaseHeading>
          <BaseText tone="muted">
            The header remains fixed to the viewport. Text passing underneath it provides a clear
            reference for the current opacity and backdrop blur.
          </BaseText>
          <BaseText tone="muted">
            These paragraphs are placeholders, not final product messaging. They can be replaced
            by composed sections without changing the shared View, layout, or style layers.
          </BaseText>
        </BaseStack>
      </BaseContainer>
    </section>
  </BaseView>
</template>
