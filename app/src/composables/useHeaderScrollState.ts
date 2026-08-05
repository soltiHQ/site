import { onBeforeUnmount, onMounted, ref } from 'vue'

const TOP_THRESHOLD = 8

export function useHeaderScrollState() {
  const isScrolled = ref(false)

  function updateScrollState() {
    isScrolled.value = window.scrollY > TOP_THRESHOLD
  }

  onMounted(() => {
    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', updateScrollState)
  })

  return { isScrolled }
}
