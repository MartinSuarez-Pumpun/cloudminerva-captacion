// E2 · paso 4: ejecución del verificador, con roles y sin roles, sobre el conjunto ciego
// Solo lee conjunto.jsonl; las etiquetas no se abren aquí (ENMIENDAS E-7).
// node investigacion/E2-fidelidad-explicaciones/4-verificar.mjs

import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DIR, readJsonl, writeJsonl, computeScores } from './comun.mjs'
import { verify } from './verificador.mjs'

// El verificador debe ser el congelado en E-9
for (const line of readFileSync(join(DIR, 'VERIFICADOR.sha256'), 'utf8').trim().split('\n')) {
  const [hash, file] = line.split(/\s+/)
  const now = createHash('sha256').update(readFileSync(join(DIR, file))).digest('hex')
  if (now !== hash) throw new Error(`${file} ha cambiado desde la congelación (E-9)`)
}

const perfiles = Object.fromEntries(readJsonl(join(DIR, 'datos', 'perfiles.jsonl')).map(p => [p.id, p]))
const conjunto = readJsonl(join(DIR, 'datos', 'conjunto.jsonl'))
const fecha = new Date().toISOString()

for (const mode of ['roles', 'sinRoles']) {
  const out = conjunto.map(it => {
    const v = verify(it.informe, computeScores(perfiles[it.perfil_id]), mode)
    return { id: it.id, modo: mode, fecha, veredicto: v.veredicto, campos: v.campos, frases: v.frases.map(f => ({ campo: f.field, bloque: f.block, texto: f.text, problemas: f.problemas })) }
  })
  writeJsonl(join(DIR, 'datos', `veredictos-${mode}.jsonl`), out)
  console.log(mode, out.reduce((acc, r) => ({ ...acc, [r.veredicto]: (acc[r.veredicto] ?? 0) + 1 }), {}))
}
