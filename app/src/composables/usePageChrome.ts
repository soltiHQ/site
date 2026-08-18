import {
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  readonly,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'

export type ChromeTheme = 'light' | 'dark'

type PageChromeState = {
  activeTheme: Readonly<Ref<ChromeTheme>>
  isScrolled: Readonly<Ref<boolean>>
}

const DEFAULT_THEME: ChromeTheme = 'light'
const PROBE_HEIGHT = 2
const SURFACE_SELECTOR = '[data-chrome-theme]'
const PROBE_SELECTOR = '[data-chrome-probe]'
const TOP_SENTINEL_SELECTOR = '[data-chrome-top-sentinel]'
const pageChromeKey: InjectionKey<PageChromeState> = Symbol('page-chrome')

function readTheme(element: HTMLElement): ChromeTheme | null {
  const theme = element.dataset.chromeTheme

  return theme === 'light' || theme === 'dark' ? theme : null
}

export function providePageChrome(): PageChromeState {
  const activeTheme = ref<ChromeTheme>(DEFAULT_THEME)
  const isScrolled = ref(false)

  let chromeSurfaces: HTMLElement[] = []
  let probeY = 0
  let refreshFrame: number | null = null
  let surfaceObserver: IntersectionObserver | null = null
  let topObserver: IntersectionObserver | null = null
  let mutationObserver: MutationObserver | null = null
  let resizeObserver: ResizeObserver | null = null

  function resolveActiveTheme() {
    let activeSurface: HTMLElement | null = null

    for (const surface of chromeSurfaces) {
      const bounds = surface.getBoundingClientRect()

      if (bounds.top <= probeY && bounds.bottom > probeY) {
        activeSurface = surface
      }
    }

    if (!activeSurface) {
      return
    }

    const nextTheme = readTheme(activeSurface)

    if (nextTheme) {
      activeTheme.value = nextTheme
    }
  }

  function refreshSurfaceObserver() {
    refreshFrame = null
    surfaceObserver?.disconnect()

    const chromeProbe = document.querySelector<HTMLElement>(PROBE_SELECTOR)
    const viewportHeight = document.documentElement.clientHeight

    chromeSurfaces = Array.from(
      document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR),
    )

    const hasPageSurface = chromeSurfaces.some((surface) => surface.closest('main'))

    if (!hasPageSurface) {
      activeTheme.value = DEFAULT_THEME
      return
    }

    if (!chromeProbe || viewportHeight <= 0) {
      return
    }

    const probeHeight = Math.min(PROBE_HEIGHT, viewportHeight)
    const headerBounds = chromeProbe.getBoundingClientRect()
    const headerCenter = headerBounds.top + headerBounds.height / 2
    const probeTop = Math.max(
      0,
      Math.min(
        viewportHeight - probeHeight,
        Math.round(headerCenter - probeHeight / 2),
      ),
    )
    const bottomInset = viewportHeight - probeTop - probeHeight

    probeY = probeTop + probeHeight / 2
    resolveActiveTheme()

    surfaceObserver = new IntersectionObserver(resolveActiveTheme, {
      root: null,
      rootMargin: `-${probeTop}px 0px -${bottomInset}px 0px`,
      threshold: 0,
    })

    for (const surface of chromeSurfaces) {
      surfaceObserver.observe(surface)
    }
  }

  function scheduleSurfaceRefresh() {
    if (refreshFrame !== null) {
      return
    }

    refreshFrame = window.requestAnimationFrame(refreshSurfaceObserver)
  }

  function observeDocumentTop() {
    const sentinel = document.querySelector<HTMLElement>(TOP_SENTINEL_SELECTOR)

    if (!sentinel) {
      return
    }

    isScrolled.value = sentinel.getBoundingClientRect().bottom <= 0
    topObserver = new IntersectionObserver(([entry]) => {
      isScrolled.value = !entry?.isIntersecting
    })
    topObserver.observe(sentinel)
  }

  onMounted(() => {
    refreshSurfaceObserver()
    observeDocumentTop()

    mutationObserver = new MutationObserver(scheduleSurfaceRefresh)
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-chrome-theme'],
    })

    resizeObserver = new ResizeObserver(scheduleSurfaceRefresh)

    const chromeProbe = document.querySelector<HTMLElement>(PROBE_SELECTOR)

    if (chromeProbe) {
      resizeObserver.observe(chromeProbe)
    }

    window.addEventListener('resize', scheduleSurfaceRefresh, { passive: true })
    window.visualViewport?.addEventListener('resize', scheduleSurfaceRefresh, {
      passive: true,
    })

    scheduleSurfaceRefresh()
  })

  onBeforeUnmount(() => {
    surfaceObserver?.disconnect()
    topObserver?.disconnect()
    mutationObserver?.disconnect()
    resizeObserver?.disconnect()
    window.removeEventListener('resize', scheduleSurfaceRefresh)
    window.visualViewport?.removeEventListener('resize', scheduleSurfaceRefresh)

    if (refreshFrame !== null) {
      window.cancelAnimationFrame(refreshFrame)
    }
  })

  const state: PageChromeState = {
    activeTheme: readonly(activeTheme),
    isScrolled: readonly(isScrolled),
  }

  provide(pageChromeKey, state)

  return state
}

export function usePageChrome(): PageChromeState {
  const state = inject(pageChromeKey)

  if (!state) {
    throw new Error('Page chrome state is not available')
  }

  return state
}
