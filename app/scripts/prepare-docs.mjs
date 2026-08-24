import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const scriptFile = fileURLToPath(import.meta.url)
const appRoot = resolve(dirname(scriptFile), '..')
const defaultOutput = join(appRoot, 'docs', '.generated')
const defaultSource = resolve(appRoot, '..', '..', 'taskvisor')

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

function splitTarget(target) {
  const hashIndex = target.indexOf('#')
  if (hashIndex === -1) return { path: target, hash: '' }
  return { path: target.slice(0, hashIndex), hash: target.slice(hashIndex) }
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

      return line.replace(/(\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (_whole, open, rawTarget, close) => {
        const target = rawTarget.replaceAll('&amp;', '&')

        if (target.startsWith('#') || target.startsWith('/') || target.startsWith('mailto:')) {
          return `${open}${rawTarget}${close}`
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

        if (resolved.startsWith(`${context.docsRoot}${sep}`) || resolved === context.docsRoot) {
          return `${open}${rawTarget}${close}`
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

function renderPage(sourceFile, context) {
  const { frontmatter, body } = parseFrontmatter(readFileSync(sourceFile, 'utf8'), sourceFile)
  const canonical = canonicalPageUrl(context.siteUrl, context.product, context.line, context.slug)
  const sourcePath = relative(context.sourceRoot, sourceFile).split(sep).join('/')
  const title = `${frontmatter.title} | ${context.productTitle} docs`

  const generatedFrontmatter = {
    ...frontmatter,
    product: context.product,
    productTitle: context.productTitle,
    version: context.version,
    compatibilityLine: context.line,
    sourceUrl: `${context.repository}/blob/${context.ref}/${sourcePath}`,
    head: [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:type', content: 'article' }],
      ['meta', { property: 'og:site_name', content: 'Solti' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: frontmatter.description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:image', content: `${context.siteUrl}/social/solti-preview.png` }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: frontmatter.description }],
      ['meta', { name: 'twitter:image', content: `${context.siteUrl}/social/solti-preview.png` }],
    ],
  }

  const rewritten = rewriteLinks(body, { ...context, sourceFile })
  return `---\n${stringifyYaml(generatedFrontmatter).trimEnd()}\n---\n\n${rewritten.trimStart()}`
}

function buildNavigation(manifest, docsRoot) {
  const seenPages = new Set()
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
  return navigation
}

function pageShell({ title, description, canonical, robots = 'index,follow,max-image-preview:large', head = '', body }) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonical = escapeHtml(canonical)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Solti">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta property="og:image" content="https://solti.io/social/solti-preview.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="https://solti.io/social/solti-preview.png">
  <link rel="icon" type="image/svg+xml" href="/docs/solti-logo-dark.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Serif:wght@500;600&amp;display=swap">
  ${head}
  <title>${escapedTitle}</title>
  <style>
    :root { color-scheme: light; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #141a21; background: #fff; }
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
    .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; margin-top: clamp(3rem, 8vw, 6rem); }
    .product { min-height: 15rem; padding: 1.75rem; border: 1px solid #d8dee6; border-top: 3px solid #2f9e58; border-radius: .5rem; text-decoration: none; transition: border-color 160ms ease, transform 160ms ease; }
    .product:hover { border-color: #2f9e58; transform: translateY(-2px); }
    .product h2 { margin: 0; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 2rem; letter-spacing: -.02em; }
    .product p { margin: 1rem 0 2rem; color: #3a424d; line-height: 1.55; }
    .product span { font-family: 'IBM Plex Mono', monospace; font-size: .75rem; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
    .redirect { display: grid; min-height: 100vh; place-content: center; padding: 2rem; text-align: center; }
    .redirect h1 { max-width: 18ch; font-size: clamp(2.5rem, 7vw, 5rem); }
    .redirect p { color: #3a424d; font-size: 1.125rem; }
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
<main class="shell">
  <p class="eyebrow">Documentation</p>
  <h1>Build with the stack.</h1>
  <p class="lede">Choose a component. Follow its versioned usage guide. Open the API reference when you need exact public contracts.</p>
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

function writeCurrentAlias(staticOutput, product) {
  const target = `/docs/${product.product}/${product.line}/`
  const productDir = join(staticOutput, product.product)
  mkdirSync(productDir, { recursive: true })

  const body = `<main class="redirect">
  <p class="eyebrow">${escapeHtml(product.title)} documentation</p>
  <h1>Opening the current guide.</h1>
  <p><a href="${target}">Continue to ${escapeHtml(product.title)} ${escapeHtml(product.line)} →</a></p>
</main>`

  writeFileSync(join(productDir, 'index.html'), pageShell({
    title: `${product.title} documentation`,
    description: `Current ${product.title} user guide.`,
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
  const staticOutput = resolve(args['static-output'] ?? process.env.DOCS_STATIC_OUTPUT ?? join(appRoot, 'dist', 'docs'))
  const siteUrl = (args['site-url'] ?? process.env.DOCS_SITE_URL ?? 'https://solti.io').replace(/\/$/, '')
  const allowDirty = (args['allow-dirty'] ?? process.env.DOCS_ALLOW_DIRTY ?? 'false') === 'true'

  if (!existsSync(source) || !statSync(source).isDirectory()) fail(`Product source does not exist: ${source}`)
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
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
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

  for (const group of navigation) {
    for (const page of group.pages) {
      const sourceFile = join(docsRoot, `${page.slug}.md`)
      const outputFile = join(output, `${page.slug}.md`)
      writeFileSync(outputFile, renderPage(sourceFile, {
        sourceRoot: source,
        docsRoot,
        sourceFile,
        sourceUrl: sourceFile,
        repository: product.repository,
        referenceUrl: product.reference?.url,
        versionPackage: manifest.version.provider === 'cargo' ? manifest.version.package : undefined,
        ref,
        version,
        line: product.line,
        product: product.product,
        productTitle: product.title,
        siteUrl,
        slug: page.slug,
      }))
    }
  }

  writeCurrentAlias(staticOutput, product)
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
