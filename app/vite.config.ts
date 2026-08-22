import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import siteContent from './src/contents/site.json'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function serializeJsonForHtml(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function versionedMediaUrl(path: string, version: string) {
  return `${path}?v=${version}`
}

const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteContent.brand.name,
  url: siteContent.meta.url,
  description: siteContent.meta.description,
  inLanguage: 'en',
}

const siteContentPlugin = {
  name: 'site-content',
  transformIndexHtml(html: string) {
    return html
      .replaceAll('%SITE_URL%', escapeHtml(siteContent.meta.url))
      .replaceAll('%SITE_NAME%', escapeHtml(siteContent.brand.name))
      .replaceAll('%SITE_TITLE%', escapeHtml(siteContent.meta.title))
      .replaceAll('%SITE_DESCRIPTION%', escapeHtml(siteContent.meta.description))
      .replaceAll('%SITE_IMAGE%', escapeHtml(siteContent.meta.image))
      .replaceAll('%SITE_IMAGE_ALT%', escapeHtml(siteContent.meta.imageAlt))
      .replaceAll(
        '%SITE_HERO_POSTER%',
        escapeHtml(
          versionedMediaUrl(siteContent.media.hero.poster, siteContent.media.hero.version),
        ),
      )
      .replaceAll(
        '%SITE_HERO_CONDUCTOR%',
        escapeHtml(
          versionedMediaUrl(siteContent.media.hero.conductor, siteContent.media.hero.version),
        ),
      )
      .replaceAll(
        '%SITE_STRUCTURED_DATA%',
        serializeJsonForHtml(websiteStructuredData),
      )
  },
}

export default defineConfig({
  plugins: [siteContentPlugin, vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
