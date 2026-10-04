import { readFileSync } from 'node:fs'
import { bundleFromUnknown } from '../src/domain/bundle'
import { runChecks } from '../src/domain/checks'
import { decryptJson, isEnvelope } from '../src/domain/crypto'
import { buildGraph } from '../src/domain/graph'
import { referenceIssues } from '../src/domain/schema'

const file = process.argv[2] ?? 'public/panel.enc.json'
let raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
if (isEnvelope(raw)) {
  const password = process.env.PANEL_PASSWORD
  if (!password) {
    console.log(`${file} is encrypted and PANEL_PASSWORD is not set, skipping content validation`)
    process.exit(0)
  }
  raw = await decryptJson(raw, password)
}
const parsed = bundleFromUnknown(raw)
if (parsed.kind !== 'bundle') {
  const issues = parsed.kind === 'invalid' ? parsed.issues : [{ path: '', message: 'still encrypted' }]
  for (const i of issues) console.error(`schema ${i.path}: ${i.message}`)
  process.exit(1)
}
const data = parsed.bundle.data
const refs = referenceIssues(data)
for (const i of refs) console.error(`ref ${i.path}: ${i.message}`)
const results = runChecks(data, buildGraph(data))
const count = (l: string) => results.filter((r) => r.level === l).length
for (const r of results) console.log(`${r.level.padEnd(5)} ${r.code.padEnd(18)} ${r.device ?? ''} ${r.point ?? ''} ${JSON.stringify(r.params)}`)
console.log(`\n${data.devices.length} devices, ${data.points.length} points · errors ${count('error')}, warnings ${count('warn')}, info ${count('info')}`)
process.exit(refs.length ? 1 : 0)
