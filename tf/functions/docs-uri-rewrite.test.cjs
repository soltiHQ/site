const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const context = {}
vm.createContext(context)
vm.runInContext(readFileSync(join(__dirname, 'docs-uri-rewrite.js'), 'utf8'), context)

const cases = new Map([
  ['/', '/'],
  ['/assets/app.js', '/assets/app.js'],
  ['/docs', '/docs/index.html'],
  ['/docs/', '/docs/index.html'],
  ['/docs/taskvisor', '/docs/taskvisor/index.html'],
  ['/docs/taskvisor/', '/docs/taskvisor/index.html'],
  ['/docs/taskvisor/0.8', '/docs/taskvisor/0.8/index.html'],
  ['/docs/taskvisor/0.8/', '/docs/taskvisor/0.8/index.html'],
  ['/docs/taskvisor/0.8/installation', '/docs/taskvisor/0.8/installation.html'],
  ['/docs/taskvisor/0.8/installation.html', '/docs/taskvisor/0.8/installation.html'],
  ['/docs/taskvisor/0.8/assets/app.123.js', '/docs/taskvisor/0.8/assets/app.123.js'],
])

test('rewrites clean documentation paths to static S3 objects', () => {
  for (const [uri, expected] of cases) {
    const result = context.handler({ request: { uri } })
    assert.equal(result.uri, expected, uri)
  }
})
