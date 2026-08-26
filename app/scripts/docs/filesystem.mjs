import {
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
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import { appRoot, defaultOutput, defaultStaticOutput } from './config.mjs'
import { fail } from './validation.mjs'

const outputMarkerName = '.solti-docs-renderer-output'
const outputMarkerContents = 'solti-docs-renderer-output:v1\n'

export function assertInside(root, path, label) {
  const fromRoot = relative(root, path)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    fail(`${label}: path escapes the product repository`)
  }
}

export function isInside(root, path) {
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

export function assertSafeOutputPaths(output, source, staticOutput) {
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

export function resetDocsOutput(output, managedOutput) {
  assertOwnedOutputDirectory(output, managedOutput)
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, outputMarkerName), outputMarkerContents)
}

export function resolveRepositoryEntry(sourceRoot, input, label, type) {
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
