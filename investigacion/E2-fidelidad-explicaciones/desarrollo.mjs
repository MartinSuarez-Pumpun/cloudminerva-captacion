// E2 · revisión del verificador sobre el conjunto de desarrollo (no cuenta para las métricas)
// node investigacion/E2-fidelidad-explicaciones/desarrollo.mjs [roles|sinRoles]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIR, readJsonl, computeScores } from './comun.mjs'
import { verify } from './verificador.mjs'

const mode = process.argv[2] ?? 'roles'
const perfiles = Object.fromEntries(readJsonl(join(DIR, 'datos', 'perfiles.jsonl')).map(p => [p.id, p]))
let infieles = 0, n = 0
for (const f of readdirSync(join(DIR, 'datos', 'generacion'))) {
  const r = JSON.parse(readFileSync(join(DIR, 'datos', 'generacion', f)))
  if (r.conjunto !== 'desarrollo') continue
  n++
  const v = verify(r.informe, computeScores(perfiles[r.id]), mode)
  if (v.veredicto === 'infiel') infieles++
  console.log(`\n${r.id}: ${v.veredicto}`)
  for (const c of v.campos) console.log(`  [campo] ${c.regla}: ${c.detalle}`)
  for (const s of v.frases) console.log(`  [${s.field}] ${s.text}\n      → ${s.problemas.map(p => `${p.regla}: ${p.detalle}`).join(' | ')}`)
}
console.log(`\n${infieles}/${n} marcadas como infieles (${mode})`)
