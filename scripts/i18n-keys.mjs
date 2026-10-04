// Lists translation keys used in src/ and reports which ones a locale file lacks: `node scripts/i18n-keys.mjs ru`
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(vue|ts)$/.test(f) && !p.includes('components/ui')) out.push(p)
  }
  return out
}

const keys = new Set()
const dynamic = new Set()
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\b(?:\$t|t|tm)\(\s*(['`])([^'`]+)\1/g)) {
    if (m[2].includes('${')) dynamic.add(m[2])
    else keys.add(m[2])
  }
}

const locale = process.argv[2]
if (!locale) {
  console.log([...keys].sort().join('\n'))
  console.log('\n# dynamic\n' + [...dynamic].sort().join('\n'))
  process.exit(0)
}
const dict = JSON.parse(readFileSync(`src/i18n/${locale}.json`, 'utf8'))
const has = (k) => k.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), dict) !== undefined
const missing = [...keys].filter((k) => !has(k)).sort()
console.log(missing.length ? missing.join('\n') : 'all static keys present')
process.exit(missing.length ? 1 : 0)
