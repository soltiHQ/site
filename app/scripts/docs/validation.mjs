import { parse as parseYaml } from 'yaml'

export function fail(message) {
  throw new Error(message)
}

export function validateCatalog(catalog, file) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) fail(`${file}: root must be a mapping`)
  if (catalog.schema !== 1) fail(`${file}: unsupported schema; expected 1`)

  for (const key of ['title', 'description']) {
    if (typeof catalog[key] !== 'string' || catalog[key].trim() === '') {
      fail(`${file}: ${key} must be a non-empty string`)
    }
  }
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    fail(`${file}: products must be a non-empty list`)
  }

  const seen = new Set()
  for (const [index, product] of catalog.products.entries()) {
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
      fail(`${file}: products[${index}] must be a mapping`)
    }
    if (typeof product.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(product.id)) {
      fail(`${file}: products[${index}].id is invalid`)
    }
    if (seen.has(product.id)) fail(`${file}: duplicate product id: ${product.id}`)
    seen.add(product.id)

    for (const key of ['title', 'description', 'repository', 'default_branch']) {
      if (typeof product[key] !== 'string' || product[key].trim() === '') {
        fail(`${file}: products[${index}].${key} must be a non-empty string`)
      }
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(product.repository)) {
      fail(`${file}: products[${index}].repository must use owner/name form`)
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(product.default_branch)
      || product.default_branch.includes('..')
      || product.default_branch.endsWith('/')) {
      fail(`${file}: products[${index}].default_branch is invalid`)
    }
  }

  return catalog
}

export function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) fail(`${file}: missing YAML frontmatter`)

  const frontmatter = parseYaml(match[1])
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    fail(`${file}: frontmatter must be a mapping`)
  }
  if (typeof frontmatter.title !== 'string' || frontmatter.title.trim() === '') {
    fail(`${file}: frontmatter.title must be a non-empty string`)
  }
  if (typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
    fail(`${file}: frontmatter.description must be a non-empty string`)
  }

  return { frontmatter, body: markdown.slice(match[0].length) }
}

export function validateManifest(manifest, file) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail(`${file}: root must be a mapping`)
  if (manifest.schema !== 1) fail(`${file}: unsupported schema; expected 1`)

  for (const key of ['product', 'title', 'compatibility_line', 'repository']) {
    if (typeof manifest[key] !== 'string' || manifest[key].trim() === '') {
      fail(`${file}: ${key} must be a non-empty string`)
    }
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.product)) fail(`${file}: invalid product id`)
  if (!/^\d+\.\d+$/.test(manifest.compatibility_line)) fail(`${file}: compatibility_line must be major.minor`)
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(manifest.repository)) {
    fail(`${file}: repository must be an https://github.com repository URL`)
  }
  if (!manifest.version || typeof manifest.version !== 'object' || Array.isArray(manifest.version)) {
    fail(`${file}: version must be a mapping`)
  }
  if (!['cargo', 'input'].includes(manifest.version.provider)) {
    fail(`${file}: version.provider must be cargo or input`)
  }
  if (manifest.version.provider === 'cargo'
    && (typeof manifest.version.package !== 'string' || manifest.version.package.trim() === '')) {
    fail(`${file}: version.package must be a non-empty string for the cargo provider`)
  }
  if (manifest.version.provider === 'input' && manifest.version.package !== undefined) {
    fail(`${file}: version.package is not allowed for the input provider`)
  }
  if (manifest.reference !== undefined) {
    if (!manifest.reference || typeof manifest.reference !== 'object' || Array.isArray(manifest.reference)) {
      fail(`${file}: reference must be a mapping`)
    }
    if (typeof manifest.reference.label !== 'string' || manifest.reference.label.trim() === '') {
      fail(`${file}: reference.label must be a non-empty string`)
    }
    if (typeof manifest.reference.url !== 'string'
      || !/^https:\/\/[^\s]+$/.test(manifest.reference.url)) {
      fail(`${file}: reference.url must be an HTTPS URL`)
    }
  }
  if (manifest.api !== undefined) {
    if (!manifest.api || typeof manifest.api !== 'object' || Array.isArray(manifest.api)) {
      fail(`${file}: api must be a mapping`)
    }
    const unknown = Object.keys(manifest.api).filter((key) => !['provider', 'source', 'title', 'description'].includes(key))
    if (unknown.length > 0) fail(`${file}: unknown api keys: ${unknown.sort().join(', ')}`)
    if (manifest.api.provider !== 'rustdoc') fail(`${file}: api.provider must equal rustdoc`)
    for (const key of ['source', 'title', 'description']) {
      if (typeof manifest.api[key] !== 'string' || manifest.api[key].trim() === '') {
        fail(`${file}: api.${key} must be a non-empty string`)
      }
    }
  }
  if (manifest.examples !== undefined) {
    if (!manifest.examples || typeof manifest.examples !== 'object' || Array.isArray(manifest.examples)) {
      fail(`${file}: examples must be a mapping`)
    }
    const unknown = Object.keys(manifest.examples)
      .filter((key) => !['provider', 'catalog', 'directory', 'title', 'description'].includes(key))
    if (unknown.length > 0) fail(`${file}: unknown examples keys: ${unknown.sort().join(', ')}`)
    if (manifest.examples.provider !== 'rust') fail(`${file}: examples.provider must equal rust`)
    for (const key of ['catalog', 'directory', 'title', 'description']) {
      if (typeof manifest.examples[key] !== 'string' || manifest.examples[key].trim() === '') {
        fail(`${file}: examples.${key} must be a non-empty string`)
      }
    }
  }
  if (!Array.isArray(manifest.navigation) || manifest.navigation.length === 0) {
    fail(`${file}: navigation must be a non-empty list`)
  }

  return manifest
}
