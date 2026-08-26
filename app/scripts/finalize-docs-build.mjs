import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generatedRoot = resolve(
  process.env.DOCS_OUTPUT ?? resolve(appRoot, 'docs', '.generated'),
)
const renderedRoot = resolve(
  process.env.DOCS_RENDER_OUTPUT ?? resolve(appRoot, 'dist', 'docs'),
)

function fail(message) {
  throw new Error(message)
}

function main() {
  const manifestFile = resolve(generatedRoot, 'site.json')
  if (!existsSync(manifestFile) || !lstatSync(manifestFile).isFile()) {
    fail(`Generated documentation manifest does not exist: ${manifestFile}`)
  }

  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail(`Generated documentation manifest must be an object: ${manifestFile}`)
  }
  if (typeof manifest.product !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(manifest.product)) {
    fail(`Generated documentation manifest has an invalid product: ${manifestFile}`)
  }
  if (typeof manifest.line !== 'string' || !/^\d+\.\d+$/.test(manifest.line)) {
    fail(`Generated documentation manifest has an invalid compatibility line: ${manifestFile}`)
  }

  const versionedSitemap = resolve(renderedRoot, manifest.product, manifest.line, 'sitemap.xml')
  if (!existsSync(versionedSitemap) || !lstatSync(versionedSitemap).isFile()) {
    fail(`Versioned documentation sitemap does not exist: ${versionedSitemap}`)
  }

  const productOutput = resolve(renderedRoot, manifest.product)
  if (existsSync(productOutput)) {
    const productEntry = lstatSync(productOutput)
    if (productEntry.isSymbolicLink() || !productEntry.isDirectory()) {
      fail(`Rendered product output must be a directory: ${productOutput}`)
    }
  } else {
    mkdirSync(productOutput, { recursive: true })
  }

  const productSitemap = resolve(productOutput, 'sitemap.xml')
  if (existsSync(productSitemap)) {
    const sitemapEntry = lstatSync(productSitemap)
    if (sitemapEntry.isSymbolicLink() || !sitemapEntry.isFile()) {
      fail(`Product sitemap must be a regular file: ${productSitemap}`)
    }
  }
  copyFileSync(versionedSitemap, productSitemap)
  process.stdout.write(`Prepared ${manifest.product} product sitemap for compatibility line ${manifest.line}.\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
