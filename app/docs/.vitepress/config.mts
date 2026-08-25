import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { defineConfig, type DefaultTheme } from 'vitepress'

interface DocsPage {
  slug: string
  title: string
  description: string
}

interface DocsGroup {
  title: string
  pages: DocsPage[]
}

interface DocsManifest {
  product: string
  title: string
  version: string
  line: string
  repository: string
  reference?: {
    label: string
    url: string
  }
  ref: string
  siteUrl: string
  navigation: DocsGroup[]
}

const generatedRoot = resolve(
  process.env.DOCS_OUTPUT ?? resolve(import.meta.dirname, '..', '.generated'),
)
const renderedRoot = resolve(
  process.env.DOCS_RENDER_OUTPUT
    ?? resolve(import.meta.dirname, '..', '..', 'dist', 'docs'),
)
const manifest = JSON.parse(readFileSync(resolve(generatedRoot, 'site.json'), 'utf8')) as DocsManifest
const productBase = `/docs/${manifest.product}/${manifest.line}/`
const vitepressRequire = createRequire(import.meta.resolve('vitepress'))
const vueEntry = vitepressRequire.resolve('vue/dist/vue.runtime.esm-bundler.js')
const vueServerRenderer = vitepressRequire.resolve(
  '@vue/server-renderer/dist/server-renderer.esm-bundler.js',
)

const sidebar: DefaultTheme.Sidebar = {
  '/': manifest.navigation.map((group) => ({
    text: group.title,
    collapsed: false,
    items: group.pages.map((page) => ({
      text: page.title,
      link: page.slug === 'index' ? '/' : `/${page.slug}`,
    })),
  })),
}

const nav: DefaultTheme.NavItem[] = [
  { text: manifest.title, link: '/' },
  { text: manifest.line, items: [{ text: `${manifest.title} ${manifest.line}`, link: '/' }] },
  { text: 'All docs', link: `${manifest.siteUrl}/docs/` },
]

if (manifest.reference) nav.push({ text: manifest.reference.label, link: manifest.reference.url })
nav.push({ text: 'Source', link: manifest.repository })

export default defineConfig({
  title: 'Solti docs',
  description: 'Versioned user guides for the Solti task execution stack.',
  lang: 'en-US',
  base: productBase,
  srcDir: generatedRoot,
  outDir: resolve(renderedRoot, manifest.product, manifest.line),
  cleanUrls: true,
  appearance: false,
  lastUpdated: false,
  sitemap: {
    hostname: `${manifest.siteUrl}${productBase}`,
  },
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${productBase}solti-logo-dark.svg` }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@500;600&family=Space+Grotesk:wght@500;600;700&display=swap',
    }],
  ],
  markdown: {
    lineNumbers: true,
  },
  vite: {
    resolve: {
      alias: {
        'vue/server-renderer': vueServerRenderer,
        vue: vueEntry,
      },
      dedupe: ['vue'],
    },
  },
  themeConfig: {
    logo: '/solti-logo-dark.svg',
    siteTitle: 'Solti docs',
    nav,
    sidebar,
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/soltiHQ' },
    ],
    footer: {
      message: 'Open-source task execution components.',
      copyright: 'Solti',
    },
  },
})
