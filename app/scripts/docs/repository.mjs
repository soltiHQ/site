import { execFileSync } from 'node:child_process'

import { fail } from './validation.mjs'

export function git(source, ...args) {
  return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim()
}

export function readCargoPackage(source, packageName) {
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

export function normalizeGitHubRepository(value) {
  return value
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
}
