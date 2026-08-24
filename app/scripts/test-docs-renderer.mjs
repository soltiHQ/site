import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'solti-docs-renderer-'))
const source = join(temporaryRoot, 'source')
const staticOutput = join(temporaryRoot, 'static')

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? appRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  })?.trim()
}

try {
  cpSync(join(appRoot, 'docs', 'fixtures', 'input-provider'), source, { recursive: true })
  run('git', ['init'], { cwd: source })
  run('git', ['remote', 'add', 'origin', 'https://github.com/soltiHQ/site.git'], { cwd: source })
  run('git', ['add', 'docs'], { cwd: source })
  run('git', ['-c', 'user.name=Solti docs CI', '-c', 'user.email=docs-ci@solti.invalid', 'commit', '-m', 'docs fixture'], { cwd: source })
  const commit = run('git', ['rev-parse', 'HEAD'], { cwd: source, capture: true })

  run(process.execPath, [
    'scripts/prepare-docs.mjs',
    '--source', source,
    '--static-output', staticOutput,
    '--version', '0.1.0',
    '--ref', commit,
    '--commit', commit,
  ])
  run('npm', ['run', 'docs:build', '--silent'])

  const rendered = join(appRoot, 'dist', 'docs', 'renderer-fixture', '0.1', 'index.html')
  if (!existsSync(rendered)) throw new Error(`Missing rendered fixture: ${rendered}`)
  const logo = join(appRoot, 'dist', 'docs', 'renderer-fixture', '0.1', 'solti-logo-dark.svg')
  if (!existsSync(logo)) throw new Error(`Missing rendered fixture logo: ${logo}`)
  const alias = join(staticOutput, 'renderer-fixture', 'index.html')
  if (!existsSync(alias)) throw new Error(`Missing rendered fixture alias: ${alias}`)
  if (/>API reference<\/span>/.test(readFileSync(rendered, 'utf8'))) {
    throw new Error('Renderer added an API reference that the fixture manifest does not define')
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
