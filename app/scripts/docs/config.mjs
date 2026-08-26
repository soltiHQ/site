import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const defaultOutput = join(appRoot, 'docs', '.generated')
export const defaultStaticOutput = join(appRoot, 'dist', 'docs')
export const defaultSource = resolve(appRoot, '..', '..', 'taskvisor')
const siteMeta = JSON.parse(readFileSync(join(appRoot, 'src', 'contents', 'site.json'), 'utf8')).meta
export const socialImagePath = new URL(siteMeta.image).pathname
export const socialImageAlt = siteMeta.imageAlt
