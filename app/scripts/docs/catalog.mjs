import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { socialImageAlt, socialImagePath } from './config.mjs'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function pageShell({ title, description, canonical, robots = 'index,follow,max-image-preview:large', head = '', body }) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonical = escapeHtml(canonical)
  const escapedSocialImage = escapeHtml(new URL(socialImagePath, canonical).href)
  const escapedSocialImageAlt = escapeHtml(socialImageAlt)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#ffffff">
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Solti">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta property="og:image" content="${escapedSocialImage}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapedSocialImageAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${escapedSocialImage}">
  <meta name="twitter:image:alt" content="${escapedSocialImageAlt}">
  <link rel="icon" type="image/svg+xml" href="/docs/solti-logo-dark.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Serif:wght@500;600&amp;display=swap">
  ${head}
  <title>${escapedTitle}</title>
  <style>
    :root { --title-section: clamp(2.2rem, 4.8vw, 4.8rem); color-scheme: light; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #141a21; background: #fff; }
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
    .catalog__intro { display: grid; align-items: end; grid-template-columns: minmax(0, 1.05fr) minmax(20rem, .95fr); gap: 1.5rem clamp(3rem, 8vw, 8rem); }
    .catalog__heading { display: grid; gap: 1.5rem; }
    .catalog .eyebrow { margin: 0; }
    .catalog h1 { max-width: 12ch; font-size: var(--title-section); font-weight: 500; letter-spacing: -.035em; line-height: .98; }
    .catalog .lede { align-self: end; padding-bottom: .5rem; margin: 0; font-size: clamp(1rem, 1.35vw, 1.2rem); line-height: 1.65; }
    .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; margin-top: clamp(3rem, 8vw, 6rem); }
    .product { min-height: 15rem; padding: 1.75rem; border: 1px solid #d8dee6; border-top: 3px solid #2f9e58; border-radius: .5rem; text-decoration: none; transition: border-color 160ms ease, transform 160ms ease; }
    .product:hover { border-color: #2f9e58; transform: translateY(-2px); }
    .product h2 { margin: 0; font-family: 'IBM Plex Serif', Georgia, serif; font-size: 2rem; letter-spacing: -.02em; }
    .product p { margin: 1rem 0 2rem; color: #3a424d; line-height: 1.55; }
    .product span { font-family: 'IBM Plex Mono', monospace; font-size: .75rem; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
    .redirect { display: grid; min-height: 100vh; place-content: center; padding: 2rem; text-align: center; }
    .redirect h1 { max-width: 18ch; font-size: clamp(2.5rem, 7vw, 5rem); }
    .redirect p { color: #3a424d; font-size: 1.125rem; }
    @media (max-width: 48rem) { .catalog__intro { max-width: 42rem; grid-template-columns: minmax(0, 1fr); } }
    @media (prefers-reduced-motion: reduce) { .product { transition: none; } }
  </style>
</head>
<body>
${body}
</body>
</html>
`
}

export function writeCatalog(staticOutput, catalog, siteUrl) {
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
<main class="shell catalog">
  <header class="catalog__intro">
    <div class="catalog__heading">
      <p class="eyebrow">Documentation</p>
      <h1>Build with the stack.</h1>
    </div>
    <p class="lede">Choose a component. Follow its versioned usage guide. Open the API reference when you need exact public contracts.</p>
  </header>
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

export function writeGuideAlias(staticOutput, product, alias) {
  const target = `/docs/${product.product}/${product.line}/`
  const productDir = join(staticOutput, product.product)
  const aliasDir = alias ? join(productDir, alias) : productDir
  mkdirSync(aliasDir, { recursive: true })
  const label = alias === 'latest' ? 'latest' : 'current'

  const body = `<main class="redirect">
  <p class="eyebrow">${escapeHtml(product.title)} documentation</p>
  <h1>Opening the ${label} guide.</h1>
  <p><a href="${target}">Continue to ${escapeHtml(product.title)} ${escapeHtml(product.line)} →</a></p>
</main>`

  writeFileSync(join(aliasDir, 'index.html'), pageShell({
    title: `${product.title} documentation`,
    description: `${label === 'latest' ? 'Latest' : 'Current'} ${product.title} user guide.`,
    canonical: `${product.siteUrl}${target}`,
    robots: 'noindex,follow',
    head: `<meta http-equiv="refresh" content="0; url=${target}">`,
    body,
  }))
}
