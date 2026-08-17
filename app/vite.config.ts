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

const siteContentPlugin = {
  name: 'site-content',
  transformIndexHtml(html: string) {
    return html
      .replaceAll('%SITE_TITLE%', escapeHtml(siteContent.meta.title))
      .replaceAll('%SITE_DESCRIPTION%', escapeHtml(siteContent.meta.description))
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
