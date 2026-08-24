import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse as parseYaml } from 'yaml'

import { validateCatalog, writeCatalog } from './prepare-docs.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`)

    const key = argument.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)

    options[key] = value
    index += 1
  }

  return options
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const output = resolve(args.output ?? process.env.DOCS_CATALOG_OUTPUT ?? join(appRoot, 'dist', 'docs'))
  const siteUrl = (args['site-url'] ?? process.env.DOCS_SITE_URL ?? 'https://solti.io').replace(/\/$/, '')
  const catalogFile = join(appRoot, 'docs', 'catalog.yml')
  const catalog = validateCatalog(parseYaml(readFileSync(catalogFile, 'utf8')), catalogFile)

  mkdirSync(output, { recursive: true })
  writeCatalog(output, catalog, siteUrl)
  copyFileSync(join(appRoot, 'src', 'assets', 'logo', 'solti-logo-dark.svg'), join(output, 'solti-logo-dark.svg'))

  process.stdout.write(`Prepared the ${catalog.title} catalog.\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
