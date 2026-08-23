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

const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteContent.brand.name,
  url: siteContent.meta.url,
}

const siteContentPlugin = {
  name: 'site-content',
  transformIndexHtml(html: string) {
    return html
      .replaceAll('%SITE_URL%', escapeHtml(siteContent.meta.url))
      .replaceAll('%SITE_NAME%', escapeHtml(siteContent.brand.name))
      .replaceAll('%SITE_TITLE%', escapeHtml(siteContent.meta.title))
      .replaceAll('%SITE_DESCRIPTION%', escapeHtml(siteContent.meta.description))
      .replaceAll('%SITE_IMAGE_URL%', escapeHtml(siteContent.meta.imageUrl))
      .replaceAll('%SITE_IMAGE_ALT%', escapeHtml(siteContent.meta.imageAlt))
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
