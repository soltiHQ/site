import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'

import { isInside, resolveRepositoryEntry } from './filesystem.mjs'
import { renderMarkdownPage, splitTarget } from './markdown.mjs'
import { fail } from './validation.mjs'

function extractRustExample(sourceFile) {
  const lines = readFileSync(sourceFile, 'utf8').split(/\r?\n/)
  const docs = []
  let index = 0

  while (index < lines.length && lines[index].startsWith('//!')) {
    docs.push(lines[index].replace(/^\/\/! ?/, ''))
    index += 1
  }

  if (docs.length === 0) fail(`${sourceFile}: example must start with //! documentation`)
  while (index < lines.length && lines[index].trim() === '') index += 1

  const code = lines.slice(index).join('\n').trimEnd()
  if (code === '') fail(`${sourceFile}: example program must not be empty`)

  const heading = docs.find((line) => /^#\s+\S/.test(line))
  if (!heading) fail(`${sourceFile}: leading documentation must contain an H1`)
  const title = heading.replace(/^#\s+/, '').trim()

  const headingIndex = docs.indexOf(heading)
  const descriptionLines = []
  for (const line of docs.slice(headingIndex + 1)) {
    if (line.trim() === '') {
      if (descriptionLines.length > 0) break
      continue
    }
    if (/^#/.test(line)) break
    descriptionLines.push(line.trim())
  }
  const description = descriptionLines.join(' ')
  if (description === '') fail(`${sourceFile}: leading documentation must start with a descriptive paragraph`)

  return { title, description, documentation: docs.join('\n').trim(), code }
}

export function renderExamples(manifest, product, context) {
  if (!manifest.examples) return

  const catalogFile = resolveRepositoryEntry(
    context.sourceRoot,
    manifest.examples.catalog,
    'docs/site.yml: examples.catalog',
    'file',
  )
  const examplesRoot = resolveRepositoryEntry(
    context.sourceRoot,
    manifest.examples.directory,
    'docs/site.yml: examples.directory',
    'directory',
  )
  if (!isInside(examplesRoot, catalogFile)) {
    fail('docs/site.yml: examples.catalog must be inside examples.directory')
  }

  const entries = readdirSync(examplesRoot, { withFileTypes: true })
  const exampleFiles = entries
    .filter((entry) => entry.name.endsWith('.rs'))
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        fail(`docs/site.yml: example must be a regular file: ${entry.name}`)
      }
      const slug = basename(entry.name, '.rs')
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) fail(`docs/site.yml: invalid example slug: ${slug}`)
      return { slug, sourceFile: join(examplesRoot, entry.name) }
    })
    .sort((left, right) => left.slug.localeCompare(right.slug))
  if (exampleFiles.length === 0) fail('docs/site.yml: examples.directory contains no Rust examples')

  const catalog = readFileSync(catalogFile, 'utf8')
  const linkedExamples = new Set()
  for (const match of catalog.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
    const { path: targetPath } = splitTarget(match[1])
    if (extname(targetPath) !== '.rs') continue
    const resolved = resolve(dirname(catalogFile), targetPath)
    if (!isInside(examplesRoot, resolved) || dirname(resolved) !== examplesRoot) {
      fail(`${catalogFile}: example link must target a direct child of examples.directory: ${match[1]}`)
    }
    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
      fail(`${catalogFile}: linked example does not exist: ${match[1]}`)
    }
    linkedExamples.add(basename(resolved, '.rs'))
  }
  const missingExamples = exampleFiles.map((example) => example.slug).filter((slug) => !linkedExamples.has(slug))
  if (missingExamples.length > 0) {
    fail(`${catalogFile}: examples missing from catalog: ${missingExamples.join(', ')}`)
  }

  const catalogPath = relative(context.sourceRoot, catalogFile).split(sep).join('/')
  writeFileSync(join(context.output, 'examples.md'), renderMarkdownPage({
    title: manifest.examples.title,
    description: manifest.examples.description,
  }, catalog, {
    ...context,
    slug: 'examples',
    sourceFile: catalogFile,
    sourceUrl: `${product.repository}/blob/${product.ref}/${catalogPath}`,
    examplesRoot,
    examplesSlug: 'examples',
  }))

  const examplesOutput = join(context.output, 'examples')
  mkdirSync(examplesOutput, { recursive: true })
  for (const example of exampleFiles) {
    const extracted = extractRustExample(example.sourceFile)
    const fence = extracted.code.includes('```') ? '````' : '```'
    const body = `${extracted.documentation}\n\n## Complete program\n\n${fence}rust\n${extracted.code}\n${fence}\n`
    const sourcePath = relative(context.sourceRoot, example.sourceFile).split(sep).join('/')
    writeFileSync(join(examplesOutput, `${example.slug}.md`), renderMarkdownPage({
      title: extracted.title,
      description: extracted.description,
    }, body, {
      ...context,
      slug: `examples/${example.slug}`,
      sourceFile: example.sourceFile,
      sourceUrl: `${product.repository}/blob/${product.ref}/${sourcePath}`,
      examplesRoot,
      examplesSlug: 'examples',
    }))
  }
}
