import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse as parseYaml } from 'yaml'

import { validateCatalog } from './prepare-docs.mjs'

const scriptFile = fileURLToPath(import.meta.url)
const appRoot = resolve(dirname(scriptFile), '..')

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

function required(options, key) {
  const value = options[key]
  if (typeof value !== 'string' || value.trim() === '') fail(`--${key} is required`)
  return value
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const repository = required(options, 'repository')
  const ref = required(options, 'ref')
  const commit = required(options, 'commit')
  const version = required(options, 'version')

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    fail('--repository must use owner/name form')
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) fail('--commit must be a lowercase 40-character Git commit')

  const semver = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  const match = version.match(semver)
  if (!match) fail('--version must be an exact semantic version')
  if (ref !== `v${version}`) fail(`--ref must equal v${version}`)

  const catalogFile = join(appRoot, 'docs', 'catalog.yml')
  const catalog = validateCatalog(parseYaml(readFileSync(catalogFile, 'utf8')), catalogFile)
  const products = catalog.products.filter((product) => product.repository === repository)
  if (products.length !== 1) fail(`Repository is not uniquely allowlisted: ${repository}`)

  const product = products[0]
  const outputs = {
    product: product.id,
    repository,
    'default-branch': product.default_branch,
    ref,
    commit,
    version,
    'compatibility-line': `${match[1]}.${match[2]}`,
  }

  if (process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`)
  }

  process.stdout.write(`Resolved ${product.title} ${version} from ${repository}@${ref}.\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
