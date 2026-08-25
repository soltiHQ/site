import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptFile = fileURLToPath(import.meta.url)
const appRoot = resolve(dirname(scriptFile), '..')
const defaultContentFile = resolve(appRoot, 'src', 'contents', 'site.json')
const defaultPublicRoot = resolve(appRoot, 'public')
const stackIcons = new Set([
  'resource',
  'routing',
  'reconciliation',
  'lifecycle',
  'execution',
  'api',
  'discovery',
  'operations',
])

function fail(path, message) {
  throw new Error(`${path}: ${message}`)
}

function isInside(root, candidate) {
  const fromRoot = relative(root, candidate)
  return fromRoot === ''
    || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot))
}

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object')
  }
  return value
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(path, 'must be a non-empty string')
  }
  return value
}

function parseUrl(value, path) {
  const url = requireNonEmptyString(value, path)
  try {
    return new URL(url)
  } catch {
    fail(path, 'must be a valid URL')
  }
}

function validateLinkDestination(value, path, siteUrl) {
  const link = requireNonEmptyString(value, path)
  if (/[\\\u0000-\u001f\u007f]/.test(link)) fail(path, 'contains unsafe URL characters')

  if (link.startsWith('#')) {
    if (link.length === 1) fail(path, 'must name an in-page target')
    return
  }

  if (link.startsWith('/')) {
    if (link.startsWith('//')) fail(path, 'must not be protocol-relative')
    const target = new URL(link, siteUrl)
    if (target.origin !== siteUrl.origin) fail(path, 'must stay on the Solti site')
    return
  }

  const target = parseUrl(link, path)
  if (target.protocol !== 'https:') fail(path, 'external links must use HTTPS')
  if (target.username || target.password) fail(path, 'must not contain URL credentials')
}

function validatePublicPath(value, path, publicRoot) {
  const publicPath = requireNonEmptyString(value, path)
  if (!publicPath.startsWith('/') || publicPath.startsWith('//')) {
    fail(path, 'must be an absolute site-relative path')
  }
  if (publicPath.includes('?') || publicPath.includes('#')) {
    fail(path, 'must not contain a query string or fragment')
  }

  let decoded
  try {
    decoded = decodeURIComponent(publicPath)
  } catch {
    fail(path, 'must contain valid URL encoding')
  }
  if (decoded.split('/').includes('..')) fail(path, 'must not contain parent traversal')

  const file = resolve(publicRoot, `.${decoded}`)
  if (!isInside(publicRoot, file)) fail(path, 'must stay inside app/public')
  if (!existsSync(file) || !statSync(file).isFile()) {
    fail(path, `does not exist under app/public: ${publicPath}`)
  }
}

function visitLinkReferences(value, path, links) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitLinkReferences(item, `${path}[${index}]`, links))
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (key === 'link') {
      const link = requireNonEmptyString(child, childPath)
      if (!Object.hasOwn(links, link)) fail(childPath, `references unknown siteContent.links key: ${link}`)
      continue
    }
    visitLinkReferences(child, childPath, links)
  }
}

function visitMedia(value, path, publicRoot) {
  const media = requireObject(value, path)
  for (const [key, child] of Object.entries(media)) {
    const childPath = `${path}.${key}`
    if (key === 'version') {
      const version = requireNonEmptyString(child, childPath)
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)) {
        fail(childPath, 'must be safe for use as a query-string version token')
      }
    } else if (typeof child === 'string') {
      validatePublicPath(child, childPath, publicRoot)
    } else {
      visitMedia(child, childPath, publicRoot)
    }
  }
}

export function validateSiteContent(content, options = {}) {
  const publicRoot = resolve(options.publicRoot ?? defaultPublicRoot)
  const site = requireObject(content, 'siteContent')
  const links = requireObject(site.links, 'siteContent.links')
  const siteUrl = parseUrl(site.meta?.url, 'siteContent.meta.url')
  if (siteUrl.protocol !== 'https:') fail('siteContent.meta.url', 'must use HTTPS')

  for (const [key, value] of Object.entries(links)) {
    validateLinkDestination(value, `siteContent.links.${key}`, siteUrl)
  }
  visitLinkReferences(site.pages, 'siteContent.pages', links)

  const stackItems = site.pages?.content?.stack?.items
  if (!Array.isArray(stackItems) || stackItems.length === 0) {
    fail('siteContent.pages.content.stack.items', 'must be a non-empty array')
  }
  stackItems.forEach((item, index) => {
    const iconPath = `siteContent.pages.content.stack.items[${index}].icon`
    const icon = requireNonEmptyString(item?.icon, iconPath)
    if (!stackIcons.has(icon)) fail(iconPath, `unsupported stack icon: ${icon}`)
  })

  visitMedia(site.media, 'siteContent.media', publicRoot)

  const socialImage = parseUrl(site.meta?.image, 'siteContent.meta.image')
  if (socialImage.protocol !== 'https:') fail('siteContent.meta.image', 'must use HTTPS')
  if (socialImage.origin === siteUrl.origin) {
    validatePublicPath(socialImage.pathname, 'siteContent.meta.image', publicRoot)
  }
  requireNonEmptyString(site.meta?.imageAlt, 'siteContent.meta.imageAlt')

  return content
}

function main() {
  const file = resolve(process.argv[2] ?? defaultContentFile)
  const content = JSON.parse(readFileSync(file, 'utf8'))
  validateSiteContent(content)
  process.stdout.write(`Validated ${relative(appRoot, file)}.\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
