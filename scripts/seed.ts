import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { extname, join, dirname, basename } from 'node:path'
import * as yaml from 'js-yaml'
import { makeBundle } from '../src/domain/bundle'
import { encryptJson } from '../src/domain/crypto'
import { referenceIssues } from '../src/domain/schema'

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

const source = process.argv[2] ?? 'data/demo.yaml'
const target = process.argv[3] ?? 'public/panel.enc.json'
const password = process.env.PANEL_PASSWORD
if (!password) {
  console.error('PANEL_PASSWORD is not set')
  process.exit(1)
}

const doc = yaml.load(readFileSync(source, 'utf8')) as { data: unknown; assetsDir?: string }
const assets: Record<string, string> = {}
if (doc.assetsDir) {
  const dir = join(dirname(source), doc.assetsDir)
  for (const f of readdirSync(dir)) {
    const mime = MIME[extname(f).toLowerCase()]
    if (!mime) continue
    assets[basename(f, extname(f))] = `data:${mime};base64,${readFileSync(join(dir, f)).toString('base64')}`
  }
}

const bundle = makeBundle(doc.data as never, assets)
const issues = referenceIssues(bundle.data)
if (issues.length) {
  for (const i of issues) console.error(`${i.path}: ${i.message}`)
  process.exit(1)
}
const env = await encryptJson(bundle, password)
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, JSON.stringify(env))
console.log(`${target}: ${bundle.data.devices.length} devices, ${bundle.data.points.length} points, ${Object.keys(assets).length} assets`)
