import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const scriptFile = fileURLToPath(import.meta.url)
const appRoot = resolve(dirname(scriptFile), '..')
const defaultOutput = join(appRoot, 'docs', '.generated')
const defaultStaticOutput = join(appRoot, 'dist', 'docs')
const defaultSource = resolve(appRoot, '..', '..', 'taskvisor')
const outputMarkerName = '.solti-docs-renderer-output'
const outputMarkerContents = 'solti-docs-renderer-output:v1\n'
const localImageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const localImageOutputDirectory = 'docs-assets'
const siteMeta = JSON.parse(readFileSync(join(appRoot, 'src', 'contents', 'site.json'), 'utf8')).meta
const socialImagePath = new URL(siteMeta.image).pathname
const socialImageAlt = siteMeta.imageAlt

function fail(message) {
  throw new Error(message)
}

function parseArgs(argv) {
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (!argument.startsWith('--')) fail(`Unexpected argument: ${argument}`)

    const key = argument.slice(2)
    const value = argv[index + 1]

    if (!value || value.startsWith('--')) fail(`Missing value for --${key}`)

    options[key] = value
    index += 1
  }

  return options
}

function git(source, ...args) {
  return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim()
}

function readCargoPackage(source, packageName) {
  let metadata
  try {
    metadata = JSON.parse(execFileSync(
      'cargo',
      ['metadata', '--no-deps', '--format-version', '1'],
      { cwd: source, encoding: 'utf8' },
    ))
  } catch (error) {
    fail(`Cannot read Cargo metadata from ${source}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const matches = metadata.packages?.filter((pkg) => pkg.name === packageName) ?? []
  if (matches.length !== 1) {
    fail(`Cargo package ${packageName} must resolve to exactly one workspace package; found ${matches.length}`)
  }
  return { name: matches[0].name, version: matches[0].version }
}

function normalizeGitHubRepository(value) {
  return value
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function validateCatalog(catalog, file) {
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

function parseFrontmatter(markdown, file) {
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

function assertInside(root, path, label) {
  const fromRoot = relative(root, path)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    fail(`${label}: path escapes the product repository`)
  }
}

function isInside(root, path) {
  const fromRoot = relative(root, path)
  return fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot)
}

function canonicalizeForSafety(path) {
  const missingSegments = []
  let cursor = resolve(path)

  while (!existsSync(cursor)) {
    const parent = dirname(cursor)
    if (parent === cursor) break
    missingSegments.unshift(basename(cursor))
    cursor = parent
  }

  const existingRoot = existsSync(cursor) ? realpathSync(cursor) : cursor
  return resolve(existingRoot, ...missingSegments)
}

function pathsOverlap(first, second) {
  return isInside(first, second) || isInside(second, first)
}

function assertDirectoryTarget(path, label) {
  if (!existsSync(path)) return

  const entry = lstatSync(path)
  if (entry.isSymbolicLink()) fail(`${label} must not be a symbolic link: ${path}`)
  if (!entry.isDirectory()) fail(`${label} must be a directory: ${path}`)
}

function hasValidOutputMarker(output) {
  const marker = join(output, outputMarkerName)
  if (!existsSync(marker)) return false

  const entry = lstatSync(marker)
  return !entry.isSymbolicLink()
    && entry.isFile()
    && readFileSync(marker, 'utf8') === outputMarkerContents
}

function assertOwnedOutputDirectory(output, managedOutput) {
  if (!existsSync(output)) return
  assertDirectoryTarget(output, 'Docs output')

  if (managedOutput || readdirSync(output).length === 0 || hasValidOutputMarker(output)) return
  fail(`Refusing to remove unowned docs output directory: ${output}`)
}

function assertSafeOutputPaths(output, source, staticOutput) {
  const repositoryPath = resolve(appRoot, '..')
  const repositoryRoot = canonicalizeForSafety(repositoryPath)
  const generatedRoot = canonicalizeForSafety(defaultOutput)
  const staticRoot = canonicalizeForSafety(defaultStaticOutput)
  const safeOutput = canonicalizeForSafety(output)
  const safeSource = canonicalizeForSafety(source)
  const safeStaticOutput = canonicalizeForSafety(staticOutput)
  const outputIsInsideRepository = isInside(repositoryPath, resolve(output))
  const staticOutputIsInsideRepository = isInside(repositoryPath, resolve(staticOutput))
  const managedOutput = isInside(repositoryRoot, generatedRoot) && isInside(generatedRoot, safeOutput)

  if (dirname(safeOutput) === safeOutput) {
    fail(`Refusing to remove unsafe docs output path: ${output}`)
  }
  if (isInside(safeOutput, repositoryRoot)) {
    fail(`Refusing to remove the site repository or one of its ancestors: ${output}`)
  }
  if (pathsOverlap(safeOutput, safeSource)) {
    fail(`Docs output must not overlap the product source: ${output}`)
  }
  if (pathsOverlap(safeOutput, safeStaticOutput)) {
    fail(`Docs output must not overlap static output: ${output}`)
  }
  if (outputIsInsideRepository && !isInside(repositoryRoot, safeOutput)) {
    fail(`Docs output inside the site repository must not resolve outside it: ${output}`)
  }
  if (isInside(repositoryRoot, safeOutput) && !isInside(generatedRoot, safeOutput)) {
    fail(`Docs output inside the site repository must stay under ${defaultOutput}: ${output}`)
  }

  if (dirname(safeStaticOutput) === safeStaticOutput) {
    fail(`Refusing to write docs static output to an unsafe path: ${staticOutput}`)
  }
  if (isInside(safeStaticOutput, repositoryRoot)) {
    fail(`Refusing to write docs static output to the site repository or one of its ancestors: ${staticOutput}`)
  }
  if (pathsOverlap(safeStaticOutput, safeSource)) {
    fail(`Docs static output must not overlap the product source: ${staticOutput}`)
  }
  if (staticOutputIsInsideRepository && !isInside(repositoryRoot, safeStaticOutput)) {
    fail(`Docs static output inside the site repository must not resolve outside it: ${staticOutput}`)
  }
  if (isInside(repositoryRoot, safeStaticOutput) && !isInside(staticRoot, safeStaticOutput)) {
    fail(`Docs static output inside the site repository must stay under ${defaultStaticOutput}: ${staticOutput}`)
  }

  assertDirectoryTarget(staticOutput, 'Docs static output')
  assertOwnedOutputDirectory(output, managedOutput)
  return { managedOutput }
}

function resetDocsOutput(output, managedOutput) {
  assertOwnedOutputDirectory(output, managedOutput)
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, outputMarkerName), outputMarkerContents)
}

function resolveRepositoryEntry(sourceRoot, input, label, type) {
  if (typeof input !== 'string' || input.trim() === '' || isAbsolute(input)) {
    fail(`${label}: path must be a non-empty repository-relative string`)
  }

  const entry = resolve(sourceRoot, input)
  assertInside(sourceRoot, entry, label)
  if (!existsSync(entry)) fail(`${label}: path does not exist: ${input}`)
  if (lstatSync(entry).isSymbolicLink()) fail(`${label}: symbolic links are not allowed: ${input}`)

  const resolvedRoot = realpathSync(sourceRoot)
  const resolvedEntry = realpathSync(entry)
  assertInside(resolvedRoot, resolvedEntry, label)

  if (type === 'file' && !statSync(entry).isFile()) fail(`${label}: expected a file: ${input}`)
  if (type === 'directory' && !statSync(entry).isDirectory()) fail(`${label}: expected a directory: ${input}`)
  return entry
}

function splitTarget(target) {
  const hashIndex = target.indexOf('#')
  if (hashIndex === -1) return { path: target, hash: '' }
  return { path: target.slice(0, hashIndex), hash: target.slice(hashIndex) }
}

function splitLocalImageTarget(target) {
  const queryIndex = target.indexOf('?')
  const hashIndex = target.indexOf('#')
  const suffixIndexes = [queryIndex, hashIndex].filter((index) => index !== -1)
  const suffixIndex = suffixIndexes.length === 0 ? -1 : Math.min(...suffixIndexes)
  if (suffixIndex === -1) return { path: target, suffix: '' }
  return { path: target.slice(0, suffixIndex), suffix: target.slice(suffixIndex) }
}

function localImageSourceRoot(context) {
  if (isInside(context.docsRoot, context.sourceFile)) return context.docsRoot
  if (context.examplesRoot && isInside(context.examplesRoot, context.sourceFile)) return context.examplesRoot
  fail(`${context.sourceFile}: local images are only allowed inside product documentation sources`)
}

function copyLocalImage(target, context) {
  const { path: encodedPath, suffix } = splitLocalImageTarget(target)
  let targetPath
  try {
    targetPath = decodeURIComponent(encodedPath)
  } catch {
    fail(`${context.sourceFile}: local image path must use valid URL encoding: ${target}`)
  }
  if (targetPath === '' || targetPath.includes('\0') || targetPath.includes('\\')) {
    fail(`${context.sourceFile}: invalid local image path: ${target}`)
  }
  if (targetPath.includes('?') || targetPath.includes('#')) {
    fail(`${context.sourceFile}: local image filename must not contain URL delimiters: ${target}`)
  }

  const sourceRoot = localImageSourceRoot(context)
  const sourceImage = resolve(dirname(context.sourceFile), targetPath)
  assertInside(sourceRoot, sourceImage, `${context.sourceFile}: local image ${target}`)
  if (!existsSync(sourceImage)) fail(`${context.sourceFile}: local image does not exist: ${target}`)

  const entry = lstatSync(sourceImage)
  if (entry.isSymbolicLink() || !entry.isFile()) {
    fail(`${context.sourceFile}: local image must be a regular file: ${target}`)
  }
  const resolvedRoot = realpathSync(sourceRoot)
  const resolvedImage = realpathSync(sourceImage)
  const resolvedSourceRoot = realpathSync(context.sourceRoot)
  assertInside(resolvedSourceRoot, resolvedRoot, `${context.sourceFile}: local image root`)
  assertInside(resolvedSourceRoot, resolvedImage, `${context.sourceFile}: local image ${target}`)
  assertInside(resolvedRoot, resolvedImage, `${context.sourceFile}: local image ${target}`)

  const extension = extname(sourceImage).toLowerCase()
  if (!localImageExtensions.has(extension)) {
    fail(`${context.sourceFile}: unsupported local image extension: ${target}`)
  }

  const contents = readFileSync(sourceImage)
  const assetName = `${createHash('sha256').update(contents).digest('hex')}${extension}`
  const assetDirectory = join(context.publicOutput, localImageOutputDirectory)
  const outputImage = join(assetDirectory, assetName)
  mkdirSync(assetDirectory, { recursive: true })
  if (existsSync(outputImage)) {
    const outputEntry = lstatSync(outputImage)
    if (outputEntry.isSymbolicLink() || !outputEntry.isFile()) {
      fail(`Generated local image must be a regular file: ${outputImage}`)
    }
    if (!readFileSync(outputImage).equals(contents)) {
      fail(`Generated local image content does not match its digest: ${outputImage}`)
    }
  } else {
    writeFileSync(outputImage, contents)
  }

  return `/${localImageOutputDirectory}/${assetName}${suffix}`
}

function rewriteLinks(markdown, context) {
  let inFence = false

  return markdown
    .split(/(\r?\n)/)
    .map((line) => {
      if (!line.includes('\n') && /^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence || line === '\n' || line === '\r\n') return line

      return line.replace(/(!?\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (_whole, open, rawTarget, close) => {
        const target = rawTarget.replaceAll('&amp;', '&')
        const isImage = open.startsWith('![')

        if (target.startsWith('#') || target.startsWith('/') || target.startsWith('mailto:')) {
          return `${open}${rawTarget}${close}`
        }

        if (isImage) {
          if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return `${open}${rawTarget}${close}`
          return `${open}${copyLocalImage(target, context)}${close}`
        }

        if (target.startsWith('https://docs.rs/')) {
          const packageRoot = context.versionPackage
            ? `https://docs.rs/${context.versionPackage}`
            : undefined
          if (packageRoot && context.referenceUrl && (target === packageRoot || target === `${packageRoot}/`)) {
            return `${open}${context.referenceUrl}${close}`
          }

          const latestPrefix = packageRoot ? `${packageRoot}/latest/` : undefined
          if (latestPrefix && target.startsWith(latestPrefix)) {
            return `${open}${packageRoot}/${context.version}/${target.slice(latestPrefix.length)}${close}`
          }

          return `${open}${rawTarget}${close}`
        }

        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return `${open}${rawTarget}${close}`

        const { path: targetPath, hash } = splitTarget(target)
        const resolved = resolve(dirname(context.sourceFile), targetPath)
        assertInside(context.sourceRoot, resolved, `${context.sourceFile}: ${target}`)

        if (!existsSync(resolved)) fail(`${context.sourceFile}: linked file does not exist: ${target}`)

        if (isInside(context.docsRoot, resolved)) {
          const docsPath = relative(context.docsRoot, resolved).split(sep).join('/').replace(/\.md$/, '')
          const guideTarget = docsPath === 'index' ? '/' : `/${docsPath}`
          return `${open}${guideTarget}${hash}${close}`
        }

        if (context.examplesRoot && isInside(context.examplesRoot, resolved)) {
          const examplesPath = relative(context.examplesRoot, resolved).split(sep).join('/')
          if (examplesPath === 'README.md') {
            return `${open}/${context.examplesSlug}${hash}${close}`
          }
          if (extname(examplesPath) === '.rs' && !examplesPath.includes('/')) {
            return `${open}/${context.examplesSlug}/${basename(examplesPath, '.rs')}${hash}${close}`
          }
        }

        const repositoryPath = relative(context.sourceRoot, resolved).split(sep).join('/')
        return `${open}${context.repository}/blob/${context.ref}/${repositoryPath}${hash}${close}`
      })
    })
    .join('')
}

function validateManifest(manifest, file) {
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

function renderReference(reference, version) {
  if (!reference) return undefined
  return {
    label: reference.label,
    url: reference.url.replaceAll('{version}', version),
  }
}

function canonicalPageUrl(siteUrl, product, line, slug) {
  const suffix = slug === 'index' ? '' : slug
  return `${siteUrl}/docs/${product}/${line}/${suffix}`
}

function renderMarkdownPage(frontmatter, body, context) {
  const canonical = canonicalPageUrl(context.siteUrl, context.product, context.line, context.slug)
  const title = `${frontmatter.title} | ${context.productTitle} docs`
  const socialImage = new URL(socialImagePath, `${context.siteUrl}/`).href

  const generatedFrontmatter = {
    ...frontmatter,
    product: context.product,
    productTitle: context.productTitle,
    version: context.version,
    compatibilityLine: context.line,
    sourceUrl: context.sourceUrl,
    head: [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:type', content: 'article' }],
      ['meta', { property: 'og:site_name', content: 'Solti' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: frontmatter.description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:image', content: socialImage }],
      ['meta', { property: 'og:image:type', content: 'image/png' }],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      ['meta', { property: 'og:image:alt', content: socialImageAlt }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: frontmatter.description }],
      ['meta', { name: 'twitter:image', content: socialImage }],
      ['meta', { name: 'twitter:image:alt', content: socialImageAlt }],
    ],
  }

  const rewritten = rewriteLinks(body, context)
  return `---\n${stringifyYaml(generatedFrontmatter).trimEnd()}\n---\n\n${rewritten.trimStart()}`
}

function renderPage(sourceFile, context) {
  const { frontmatter, body } = parseFrontmatter(readFileSync(sourceFile, 'utf8'), sourceFile)
  const sourcePath = relative(context.sourceRoot, sourceFile).split(sep).join('/')
  return renderMarkdownPage(frontmatter, body, {
    ...context,
    sourceFile,
    sourceUrl: `${context.repository}/blob/${context.ref}/${sourcePath}`,
  })
}

function buildNavigation(manifest, docsRoot) {
  const seenPages = new Set()
  const syntheticPages = new Map()
  if (manifest.examples) {
    syntheticPages.set('examples', {
      slug: 'examples',
      title: manifest.examples.title,
      description: manifest.examples.description,
    })
  }
  if (manifest.api) {
    syntheticPages.set('api', {
      slug: 'api',
      title: manifest.api.title,
      description: manifest.api.description,
    })
  }
  const navigation = manifest.navigation.map((group, groupIndex) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      fail(`docs/site.yml: navigation[${groupIndex}] must be a mapping`)
    }
    if (typeof group.title !== 'string' || group.title.trim() === '') {
      fail(`docs/site.yml: navigation[${groupIndex}].title must be a non-empty string`)
    }
    if (!Array.isArray(group.pages) || group.pages.length === 0) {
      fail(`docs/site.yml: navigation[${groupIndex}].pages must be a non-empty list`)
    }

    const pages = group.pages.map((slug) => {
      if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        fail(`docs/site.yml: invalid page slug: ${String(slug)}`)
      }
      if (seenPages.has(slug)) fail(`docs/site.yml: duplicate page slug: ${slug}`)
      seenPages.add(slug)

      if (syntheticPages.has(slug)) {
        const sourceFile = join(docsRoot, `${slug}.md`)
        if (existsSync(sourceFile)) fail(`docs/site.yml: synthetic page conflicts with docs/${slug}.md`)
        return syntheticPages.get(slug)
      }

      const sourceFile = join(docsRoot, `${slug}.md`)
      if (!existsSync(sourceFile)) fail(`docs/site.yml: missing page docs/${slug}.md`)
      const { frontmatter } = parseFrontmatter(readFileSync(sourceFile, 'utf8'), sourceFile)
      return { slug, title: frontmatter.title, description: frontmatter.description }
    })

    return { title: group.title, pages }
  })

  const unlisted = readdirSync(docsRoot)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3))
    .filter((slug) => !seenPages.has(slug))

  if (unlisted.length > 0) fail(`docs/site.yml: unlisted Markdown pages: ${unlisted.join(', ')}`)
  for (const slug of syntheticPages.keys()) {
    if (!seenPages.has(slug)) fail(`docs/site.yml: navigation must declare synthetic page ${slug}`)
  }
  return navigation
}

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

function renderExamples(manifest, product, context) {
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

function renderApi(manifest, product, context) {
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

function pageShell({ title, description, canonical, robots = 'index,follow,max-image-preview:large', head = '', body }) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonical = escapeHtml(canonical)
  const escapedSocialImage = escapeHtml(new URL(socialImagePath, canonical).href)
  const escapedSocialImageAlt = escapeHtml(socialImageAlt)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#ffffff">
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Solti">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta property="og:image" content="${escapedSocialImage}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapedSocialImageAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${escapedSocialImage}">
  <meta name="twitter:image:alt" content="${escapedSocialImageAlt}">
  <link rel="icon" type="image/svg+xml" href="/docs/solti-logo-dark.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Serif:wght@500;600&amp;display=swap">
  ${head}
  <title>${escapedTitle}</title>
  <style>
    :root { --title-section: clamp(2.2rem, 4.8vw, 4.8rem); color-scheme: light; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #141a21; background: #fff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; }
    a { color: inherit; text-underline-offset: .2em; }
    .shell { width: min(100% - 2rem, 76rem); margin-inline: auto; }
    .header { display: flex; align-items: center; justify-content: space-between; min-height: 5rem; border-bottom: 1px solid #d8dee6; }
    .brand { display: inline-flex; align-items: center; gap: .75rem; font-family: 'IBM Plex Mono', monospace; font-weight: 500; text-decoration: none; }
    .brand img { width: 2rem; height: 2rem; }
    .source { font-family: 'IBM Plex Mono', monospace; font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; }
    main { padding-block: clamp(4rem, 11vw, 9rem); }
    .eyebrow { margin: 0 0 1.25rem; color: #24713f; font-family: 'IBM Plex Mono', monospace; font-size: .75rem; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; }
    h1 { max-width: 13ch; margin: 0; font-family: 'IBM Plex Serif', Georgia, serif; font-size: clamp(3.25rem, 9vw, 7.5rem); font-weight: 600; letter-spacing: -.04em; line-height: .96; }
    .lede { max-width: 42rem; margin: 2rem 0 0; color: #3a424d; font-size: clamp(1.125rem, 2.4vw, 1.45rem); line-height: 1.55; }
    .catalog__intro { display: grid; align-items: end; grid-template-columns: minmax(0, 1.05fr) minmax(20rem, .95fr); gap: 1.5rem clamp(3rem, 8vw, 8rem); }
    .catalog__heading { display: grid; gap: 1.5rem; }
    .catalog .eyebrow { margin: 0; }
    .catalog h1 { max-width: 12ch; font-size: var(--title-section); font-weight: 500; letter-spacing: -.035em; line-height: .98; }
    .catalog .lede { align-self: end; padding-bottom: .5rem; margin: 0; font-size: clamp(1rem, 1.35vw, 1.2rem); line-height: 1.65; }
    .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; margin-top: clamp(3rem, 8vw, 6rem); }
    .product { min-height: 15rem; padding: 1.75rem; border: 1px solid #d8dee6; border-top: 3px solid #2f9e58; border-radius: .5rem; text-decoration: none; transition: border-color 160ms ease, transform 160ms ease; }
    .product:hover { border-color: #2f9e58; transform: translateY(-2px); }
    .product h2 { margin: 0; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 2rem; letter-spacing: -.02em; }
    .product p { margin: 1rem 0 2rem; color: #3a424d; line-height: 1.55; }
    .product span { font-family: 'IBM Plex Mono', monospace; font-size: .75rem; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
    .redirect { display: grid; min-height: 100vh; place-content: center; padding: 2rem; text-align: center; }
    .redirect h1 { max-width: 18ch; font-size: clamp(2.5rem, 7vw, 5rem); }
    .redirect p { color: #3a424d; font-size: 1.125rem; }
    @media (max-width: 48rem) { .catalog__intro { max-width: 42rem; grid-template-columns: minmax(0, 1fr); } }
    @media (prefers-reduced-motion: reduce) { .product { transition: none; } }
  </style>
</head>
<body>
${body}
</body>
</html>
`
}

function writeCatalog(staticOutput, catalog, siteUrl) {
  const cards = catalog.products.map((product) => `
      <a class="product" href="/docs/${escapeHtml(product.id)}/">
        <h2>${escapeHtml(product.title)}</h2>
        <p>${escapeHtml(product.description)}</p>
        <span>Open the guide →</span>
      </a>`).join('')
  const body = `<header class="header shell">
  <a class="brand" href="/"><img src="/docs/solti-logo-dark.svg" alt=""><span>Solti docs</span></a>
  <a class="source" href="https://github.com/soltiHQ">Source ↗</a>
</header>
<main class="shell catalog">
  <header class="catalog__intro">
    <div class="catalog__heading">
      <p class="eyebrow">Documentation</p>
      <h1>Build with the stack.</h1>
    </div>
    <p class="lede">Choose a component. Follow its versioned usage guide. Open the API reference when you need exact public contracts.</p>
  </header>
  <section class="products" aria-label="Product documentation">${cards}
  </section>
</main>`

  writeFileSync(join(staticOutput, 'index.html'), pageShell({
    title: catalog.title,
    description: catalog.description,
    canonical: `${siteUrl}/docs/`,
    body,
  }))

  const sitemapEntries = catalog.products.map((product) => `  <sitemap><loc>${siteUrl}/docs/${product.id}/sitemap.xml</loc></sitemap>`).join('\n')
  writeFileSync(
    join(staticOutput, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</sitemapindex>\n`,
  )
}

function writeGuideAlias(staticOutput, product, alias) {
  const target = `/docs/${product.product}/${product.line}/`
  const productDir = join(staticOutput, product.product)
  const aliasDir = alias ? join(productDir, alias) : productDir
  mkdirSync(aliasDir, { recursive: true })
  const label = alias === 'latest' ? 'latest' : 'current'

  const body = `<main class="redirect">
  <p class="eyebrow">${escapeHtml(product.title)} documentation</p>
  <h1>Opening the ${label} guide.</h1>
  <p><a href="${target}">Continue to ${escapeHtml(product.title)} ${escapeHtml(product.line)} →</a></p>
</main>`

  writeFileSync(join(aliasDir, 'index.html'), pageShell({
    title: `${product.title} documentation`,
    description: `${label === 'latest' ? 'Latest' : 'Current'} ${product.title} user guide.`,
    canonical: `${product.siteUrl}${target}`,
    robots: 'noindex,follow',
    head: `<meta http-equiv="refresh" content="0; url=${target}">`,
    body,
  }))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const source = resolve(args.source ?? process.env.DOCS_SOURCE ?? defaultSource)
  const output = resolve(args.output ?? process.env.DOCS_OUTPUT ?? defaultOutput)
  const staticOutput = resolve(args['static-output'] ?? process.env.DOCS_STATIC_OUTPUT ?? defaultStaticOutput)
  const siteUrl = (args['site-url'] ?? process.env.DOCS_SITE_URL ?? 'https://solti.io').replace(/\/$/, '')
  const allowDirty = (args['allow-dirty'] ?? process.env.DOCS_ALLOW_DIRTY ?? 'false') === 'true'

  if (!existsSync(source) || !statSync(source).isDirectory()) fail(`Product source does not exist: ${source}`)
  const { managedOutput } = assertSafeOutputPaths(output, source, staticOutput)
  const worktreeStatus = git(source, 'status', '--porcelain', '--untracked-files=all')
  if (worktreeStatus && !allowDirty) {
    fail('Product source contains uncommitted files; use an exact clean checkout or --allow-dirty true for local preview')
  }

  const docsRoot = join(source, 'docs')
  const manifestFile = join(docsRoot, 'site.yml')
  if (!existsSync(manifestFile)) fail(`Missing docs manifest: ${manifestFile}`)

  const manifest = validateManifest(parseYaml(readFileSync(manifestFile, 'utf8')), manifestFile)
  const cargoPackage = manifest.version.provider === 'cargo'
    ? readCargoPackage(source, manifest.version.package)
    : undefined
  const version = args.version ?? process.env.DOCS_VERSION ?? cargoPackage?.version
  if (!version) fail('A documentation version is required for the input version provider')
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) fail(`Invalid semantic version: ${version}`)
  if (cargoPackage && version !== cargoPackage.version) {
    fail(`Requested docs version ${version} does not match Cargo package version ${cargoPackage.version}`)
  }

  const origin = normalizeGitHubRepository(git(source, 'remote', 'get-url', 'origin'))
  const repository = normalizeGitHubRepository(manifest.repository)
  if (origin !== repository) fail(`docs repository ${repository} does not match Git origin ${origin}`)

  const versionLine = version.split('.').slice(0, 2).join('.')
  if (versionLine !== manifest.compatibility_line) {
    fail(`docs/site.yml compatibility_line ${manifest.compatibility_line} does not match version ${version}`)
  }

  const commit = args.commit ?? process.env.DOCS_COMMIT ?? git(source, 'rev-parse', 'HEAD')
  if (!/^[0-9a-f]{40}$/.test(commit)) fail(`Invalid source commit: ${commit}`)
  const ref = args.ref ?? process.env.DOCS_REF ?? commit
  if (ref.startsWith('v') && ref !== `v${version}`) {
    fail(`Release ref ${ref} does not match Cargo package version ${version}`)
  }
  const resolvedRef = git(source, 'rev-parse', `${ref}^{commit}`)
  if (resolvedRef !== commit) fail(`Source ref ${ref} resolves to ${resolvedRef}, expected ${commit}`)

  const navigation = buildNavigation(manifest, docsRoot)
  resetDocsOutput(output, managedOutput)
  const publicOutput = join(output, 'public')
  mkdirSync(publicOutput, { recursive: true })
  copyFileSync(join(appRoot, 'src', 'assets', 'logo', 'solti-logo-dark.svg'), join(publicOutput, 'solti-logo-dark.svg'))
  mkdirSync(staticOutput, { recursive: true })

  const product = {
    schema: 1,
    product: manifest.product,
    title: manifest.title,
    version,
    line: manifest.compatibility_line,
    repository,
    reference: renderReference(manifest.reference, version),
    ref,
    commit,
    siteUrl,
    navigation,
  }

  const examplesRoot = manifest.examples
    ? resolveRepositoryEntry(source, manifest.examples.directory, 'docs/site.yml: examples.directory', 'directory')
    : undefined
  const renderContext = {
    sourceRoot: source,
    docsRoot,
    repository: product.repository,
    referenceUrl: product.reference?.url,
    versionPackage: manifest.version.provider === 'cargo' ? manifest.version.package : undefined,
    ref,
    version,
    line: product.line,
    product: product.product,
    productTitle: product.title,
    siteUrl,
    output,
    publicOutput,
    examplesRoot,
    examplesSlug: manifest.examples ? 'examples' : undefined,
  }

  for (const group of navigation) {
    for (const page of group.pages) {
      if ((page.slug === 'examples' && manifest.examples) || (page.slug === 'api' && manifest.api)) continue
      const sourceFile = join(docsRoot, `${page.slug}.md`)
      const outputFile = join(output, `${page.slug}.md`)
      writeFileSync(outputFile, renderPage(sourceFile, {
        ...renderContext,
        slug: page.slug,
      }))
    }
  }

  renderExamples(manifest, product, renderContext)
  renderApi(manifest, product, renderContext)
  writeGuideAlias(staticOutput, product)
  writeGuideAlias(staticOutput, product, 'latest')
  writeFileSync(join(output, 'site.json'), `${JSON.stringify(product, null, 2)}\n`)

  process.stdout.write(`Prepared ${product.title} ${product.version} documentation from ${product.ref}.\n`)
}

if (resolve(process.argv[1] ?? '') === scriptFile) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

export { validateCatalog, writeCatalog }
