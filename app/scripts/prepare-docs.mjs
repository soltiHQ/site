import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse as parseYaml } from 'yaml'

import { renderApi } from './docs/api.mjs'
import { writeGuideAlias } from './docs/catalog.mjs'
import { appRoot, defaultOutput, defaultSource, defaultStaticOutput } from './docs/config.mjs'
import { renderExamples } from './docs/examples.mjs'
import { assertSafeOutputPaths, resetDocsOutput, resolveRepositoryEntry } from './docs/filesystem.mjs'
import { buildNavigation, renderPage } from './docs/markdown.mjs'
import { git, normalizeGitHubRepository, readCargoPackage } from './docs/repository.mjs'
import { fail, validateManifest } from './docs/validation.mjs'

const scriptFile = fileURLToPath(import.meta.url)

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

function renderReference(reference, version) {
  if (!reference) return undefined
  return {
    label: reference.label,
    url: reference.url.replaceAll('{version}', version),
  }
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

export { validateCatalog } from './docs/validation.mjs'
export { writeCatalog } from './docs/catalog.mjs'
