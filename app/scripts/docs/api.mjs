import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { resolveRepositoryEntry } from './filesystem.mjs'
import { renderMarkdownPage } from './markdown.mjs'
import { fail } from './validation.mjs'

function readApiIndex(manifest, product, context) {
  if (!manifest.api) return undefined
  if (!product.reference) fail('docs/site.yml: api requires reference')

  const sourceFile = resolveRepositoryEntry(
    context.sourceRoot,
    manifest.api.source,
    'docs/site.yml: api.source',
    'file',
  )
  let index
  try {
    index = JSON.parse(readFileSync(sourceFile, 'utf8'))
  } catch (error) {
    fail(`${sourceFile}: invalid api JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!index || typeof index !== 'object' || Array.isArray(index)) fail(`${sourceFile}: root must be an object`)
  const unknown = Object.keys(index)
    .filter((key) => !['schema', 'product', 'package', 'version', 'reference', 'features', 'items'].includes(key))
  if (unknown.length > 0) fail(`${sourceFile}: unknown keys: ${unknown.sort().join(', ')}`)
  if (index.schema !== 1) fail(`${sourceFile}: schema must equal 1`)
  if (index.product !== product.product) fail(`${sourceFile}: product must equal ${product.product}`)
  if (typeof index.package !== 'string' || index.package.trim() === '') fail(`${sourceFile}: package must be non-empty`)
  if (manifest.version.provider === 'cargo' && index.package !== manifest.version.package) {
    fail(`${sourceFile}: package must equal ${manifest.version.package}`)
  }
  if (index.version !== product.version) fail(`${sourceFile}: version must equal ${product.version}`)
  if (index.reference !== product.reference.url) fail(`${sourceFile}: reference must equal ${product.reference.url}`)
  if (index.features !== 'all') fail(`${sourceFile}: features must equal all`)
  if (!Array.isArray(index.items) || index.items.length === 0) fail(`${sourceFile}: items must be a non-empty array`)

  const seen = new Set()
  for (const [itemIndex, item] of index.items.entries()) {
    const location = `${sourceFile}: items[${itemIndex}]`
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${location} must be an object`)
    const itemUnknown = Object.keys(item).filter((key) => !['path', 'kind', 'url'].includes(key))
    if (itemUnknown.length > 0) fail(`${location}: unknown keys: ${itemUnknown.sort().join(', ')}`)
    for (const key of ['path', 'kind', 'url']) {
      if (typeof item[key] !== 'string' || item[key].trim() === '') fail(`${location}: ${key} must be non-empty`)
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*$/.test(item.path)) {
      fail(`${location}: path must be a Rust item path`)
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(item.kind)) fail(`${location}: kind is invalid`)
    let itemUrl
    try {
      itemUrl = new URL(item.url)
    } catch {
      fail(`${location}: url must be a valid URL`)
    }
    if (itemUrl.protocol !== 'https:'
      || item.url !== itemUrl.href
      || !item.url.startsWith(product.reference.url)
      || item.url.includes('/latest/')) {
      fail(`${location}: url must use the exact versioned API reference`)
    }
    const identity = `${item.kind}\u0000${item.path}`
    if (seen.has(identity)) fail(`${location}: duplicate API item ${item.path}`)
    seen.add(identity)
  }

  return { sourceFile, index }
}

export function renderApi(manifest, product, context) {
  const api = readApiIndex(manifest, product, context)
  if (!api) return

  const items = [...api.index.items].sort((left, right) => (
    left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind)
  ))
  const groups = new Map()
  for (const item of items) {
    const parts = item.path.split('::')
    const group = parts.length > 2 ? parts[1] : 'Crate root'
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(item)
  }

  const sections = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, groupItems]) => {
      const rows = groupItems
        .map((item) => `- [\`${item.path}\`](${item.url}) — ${item.kind.replaceAll('_', ' ')}`)
        .join('\n')
      return `## ${group}\n\n${rows}`
    })
    .join('\n\n')
  const apiJsonUrl = `${context.siteUrl}/docs/${product.product}/${product.line}/api.json`
  const body = `# ${manifest.api.title}\n\n${manifest.api.description}\n\nThis inventory is generated from the all-features public API for version ${product.version}. Open an item on docs.rs for methods, fields, variants, feature requirements, and exact contracts.\n\n[Download api.json](${apiJsonUrl})\n\n${sections}\n`

  copyFileSync(api.sourceFile, join(context.publicOutput, 'api.json'))
  writeFileSync(join(context.output, 'api.md'), renderMarkdownPage({
    title: manifest.api.title,
    description: manifest.api.description,
  }, body, {
    ...context,
    slug: 'api',
    sourceFile: api.sourceFile,
    sourceUrl: product.reference.url,
  }))
}
