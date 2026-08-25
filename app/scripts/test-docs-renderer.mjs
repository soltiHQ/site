import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'solti-docs-renderer-'))
const source = join(temporaryRoot, 'source')
const generatedOutput = join(temporaryRoot, 'generated')
const renderedOutput = join(temporaryRoot, 'rendered')
const isolationMarker = 'Hermetic renderer output marker.'
const docsEnvironment = {
  DOCS_OUTPUT: generatedOutput,
  DOCS_RENDER_OUTPUT: renderedOutput,
  DOCS_STATIC_OUTPUT: renderedOutput,
  DOCS_SITE_URL: 'https://solti.io',
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.capture ? 'pipe' : 'inherit',
  })?.trim()
}

function requireHtmlMetadata(html, label) {
  const required = [
    'property="og:image:type" content="image/png"',
    'property="og:image:width" content="1200"',
    'property="og:image:height" content="630"',
    'property="og:image:alt"',
    'name="twitter:image:alt"',
    'rel="apple-touch-icon"',
  ]
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`${label} is missing metadata: ${marker}`)
  }
}

try {
  cpSync(join(appRoot, 'docs', 'fixtures', 'input-provider'), source, { recursive: true })
  appendFileSync(join(source, 'docs', 'index.md'), `\n\n${isolationMarker}\n`)
  run('git', ['init', '--quiet'], { cwd: source })
  run('git', ['remote', 'add', 'origin', 'https://github.com/soltiHQ/site.git'], { cwd: source })
  run('git', ['add', 'docs', 'api.json', 'examples'], { cwd: source })
  run('git', [
    '-c', 'user.name=Solti docs CI',
    '-c', 'user.email=docs-ci@solti.invalid',
    'commit', '--quiet', '-m', 'docs fixture',
  ], { cwd: source })
  const commit = run('git', ['rev-parse', 'HEAD'], { cwd: source, capture: true })
  run('git', ['tag', 'v0.1.0'], { cwd: source })

  run(process.execPath, [
    'scripts/prepare-docs.mjs',
    '--source', source,
    '--version', '0.1.0',
    '--ref', 'v0.1.0',
    '--commit', commit,
  ], { env: docsEnvironment })
  run('npm', ['run', 'docs:build', '--silent'], { env: docsEnvironment })

  const productRoot = join(renderedOutput, 'renderer-fixture')
  const lineRoot = join(productRoot, '0.1')
  const rendered = join(lineRoot, 'index.html')
  if (!existsSync(rendered)) throw new Error(`Missing rendered fixture: ${rendered}`)
  const logo = join(lineRoot, 'solti-logo-dark.svg')
  if (!existsSync(logo)) throw new Error(`Missing rendered fixture logo: ${logo}`)
  const alias = join(productRoot, 'index.html')
  if (!existsSync(alias)) throw new Error(`Missing rendered fixture alias: ${alias}`)
  const latestAlias = join(productRoot, 'latest', 'index.html')
  if (!existsSync(latestAlias)) throw new Error(`Missing rendered fixture latest alias: ${latestAlias}`)
  const latestAliasHtml = readFileSync(latestAlias, 'utf8')
  const latestTarget = '/docs/renderer-fixture/0.1/'
  if (!latestAliasHtml.includes('<meta name="robots" content="noindex,follow">')
    || !latestAliasHtml.includes(`<link rel="canonical" href="https://solti.io${latestTarget}">`)
    || !latestAliasHtml.includes(`<meta http-equiv="refresh" content="0; url=${latestTarget}">`)
    || latestAliasHtml.includes('/docs/renderer-fixture/latest/')) {
    throw new Error('Latest alias is not a noindex redirect to the compatibility line')
  }
  requireHtmlMetadata(latestAliasHtml, 'Latest alias')

  const apiPage = join(lineRoot, 'api.html')
  const apiIndex = join(lineRoot, 'api.json')
  if (!existsSync(apiPage) || !existsSync(apiIndex)) throw new Error('Missing rendered API inventory')
  const exactApiReference = 'https://docs.rs/renderer-fixture/0.1.0/renderer_fixture/struct.Example.html'
  const apiHtml = readFileSync(apiPage, 'utf8')
  if (!apiHtml.includes(`href="${exactApiReference}"`)) {
    throw new Error('Rendered API inventory does not link to the exact reference item')
  }
  if (!apiHtml.includes('href="https://solti.io/docs/renderer-fixture/0.1/api.json"')) {
    throw new Error('Rendered API download does not use the documentation compatibility-line path')
  }
  if (!apiHtml.includes('id="crate-root"') || apiHtml.includes('id="example"') || !apiHtml.includes('id="core"')) {
    throw new Error('Rendered API inventory does not group crate-root and module items correctly')
  }
  requireHtmlMetadata(apiHtml, 'Rendered API inventory')
  const apiJson = JSON.parse(readFileSync(apiIndex, 'utf8'))
  if (apiJson.reference !== 'https://docs.rs/renderer-fixture/0.1.0/renderer_fixture/'
    || apiJson.items[1]?.url !== exactApiReference) {
    throw new Error('Rendered api.json does not preserve exact versioned reference URLs')
  }
  if (readFileSync(apiIndex, 'utf8') !== readFileSync(join(source, 'api.json'), 'utf8')) {
    throw new Error('Rendered api.json is not an exact copy of the validated source artifact')
  }

  const renderedIndex = readFileSync(rendered, 'utf8')
  if (!renderedIndex.includes(isolationMarker)) {
    throw new Error('Renderer did not build pages from DOCS_OUTPUT')
  }
  if (!renderedIndex.includes('/docs/renderer-fixture/0.1/examples/hello')
    || /href="https:\/\/github\.com\/soltiHQ\/site\/blob\/[^"]+\/examples\/hello\.rs"/.test(renderedIndex)) {
    throw new Error('Guide example link does not stay inside the rendered documentation')
  }
  requireHtmlMetadata(renderedIndex, 'Rendered guide')

  const examplesPage = join(lineRoot, 'examples.html')
  const exampleDetail = join(lineRoot, 'examples', 'hello.html')
  if (!existsSync(examplesPage) || !existsSync(exampleDetail)) throw new Error('Missing rendered examples')
  const examplesHtml = readFileSync(examplesPage, 'utf8')
  if (!examplesHtml.includes('/docs/renderer-fixture/0.1/examples/hello')) {
    throw new Error('Examples catalog does not link to the internal detail page')
  }
  if (!examplesHtml.includes('href="https://github.com/soltiHQ/site/blob/v0.1.0/examples/README.md"')) {
    throw new Error('Examples catalog source does not use the exact release tag')
  }
  const detailHtml = readFileSync(exampleDetail, 'utf8')
  if (!detailHtml.includes('println!')
    || !detailHtml.includes('href="/docs/renderer-fixture/0.1/"')) {
    throw new Error('Example detail is missing the complete program or internal guide link')
  }
  if (!detailHtml.includes('href="https://github.com/soltiHQ/site/blob/v0.1.0/examples/hello.rs"')) {
    throw new Error('Example detail source does not use the exact release tag')
  }

  const unsafe = spawnSync(process.execPath, [
    'scripts/prepare-docs.mjs',
    '--source', source,
    '--output', source,
    '--static-output', renderedOutput,
    '--version', '0.1.0',
    '--ref', 'v0.1.0',
    '--commit', commit,
  ], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...docsEnvironment },
  })
  if (unsafe.status === 0 || !unsafe.stderr.includes('Docs output must not overlap the product source')) {
    throw new Error('Renderer did not reject an output path overlapping the product source')
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
