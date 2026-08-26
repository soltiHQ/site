import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Reveal an existing element once, keeping it visible when motion is disabled. */
export function useIntersectionReveal(options: IntersectionObserverInit) {
  const target = ref<HTMLElement | null>(null)
  const visible = ref(false)
  let observer: IntersectionObserver | undefined

  onMounted(() => {
    const element = target.value
    if (!element) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || !('IntersectionObserver' in window)) {
      visible.value = true
      return
    }

    observer = new IntersectionObserver(
      ([entry], currentObserver) => {
        if (!entry?.isIntersecting) return

        visible.value = true
        currentObserver.disconnect()
        observer = undefined
      },
      options,
    )

    observer.observe(element)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  return { target, visible }
}
