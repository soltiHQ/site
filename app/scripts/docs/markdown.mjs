import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'

import { stringify as stringifyYaml } from 'yaml'

import { socialImageAlt, socialImagePath } from './config.mjs'
import { assertInside, isInside } from './filesystem.mjs'
import { fail, parseFrontmatter } from './validation.mjs'

const localImageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const localImageOutputDirectory = 'docs-assets'

export function splitTarget(target) {
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

function canonicalPageUrl(siteUrl, product, line, slug) {
  const suffix = slug === 'index' ? '' : slug
  return `${siteUrl}/docs/${product}/${line}/${suffix}`
}

export function renderMarkdownPage(frontmatter, body, context) {
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

export function renderPage(sourceFile, context) {
  const { frontmatter, body } = parseFrontmatter(readFileSync(sourceFile, 'utf8'), sourceFile)
  const sourcePath = relative(context.sourceRoot, sourceFile).split(sep).join('/')
  return renderMarkdownPage(frontmatter, body, {
    ...context,
    sourceFile,
    sourceUrl: `${context.repository}/blob/${context.ref}/${sourcePath}`,
  })
}

export function buildNavigation(manifest, docsRoot) {
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
