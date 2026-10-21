// E2 · paso 5: métricas (protocolo v1.0 §4 y ENMIENDAS E-6, E-8)
// node investigacion/E2-fidelidad-explicaciones/5-metricas.mjs

import { join } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { DIR, readJsonl } from './comun.mjs'
import { OBJETIVAS } from './verificador.mjs'

const etiquetas = Object.fromEntries(readJsonl(join(DIR, 'datos', 'etiquetas.jsonl')).map(e => [e.id, e]))
const TIPOS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']

function wilson(k, n, z = 1.959964) {
  if (n === 0) return { p: null, lo: null, hi: null, k, n }
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
  const r = x => Math.round(x * 1000) / 1000
  return { p: r(p), lo: r((c - h) / d), hi: r((c + h) / d), k, n }
}

const clean = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.\s]+$/, '').trim()

// ¿Marcó el verificador justo la alteración introducida?
function localized(v, e) {
  if (e.campo.startsWith('specialtyMatch')) return v.campos.some(c => c.regla === 'campo_afinidad' || c.regla === 'campo_principal')
  const alt = clean(e.alterada)
  return v.frases.some(f => {
    const t = clean(f.texto)
    return t === alt || t.includes(alt) || (alt.includes(t) && t.length > 15)
  })
}

const rulesOf = v => [...v.campos.map(c => c.regla), ...v.frases.flatMap(f => f.problemas.map(p => p.regla))]

const results = { prueba: 'E2 · Fidelidad de las explicaciones de ARA', fecha: new Date().toISOString(), modos: {} }
try { results.commit = execSync('git rev-parse --short HEAD', { cwd: DIR }).toString().trim() } catch {}
results.verificador_sha256 = readFileSync(join(DIR, 'VERIFICADOR.sha256'), 'utf8').trim().split('\n')

for (const mode of ['roles', 'sinRoles']) {
  const ver = readJsonl(join(DIR, 'datos', `veredictos-${mode}.jsonl`))
  const fieles = ver.filter(v => etiquetas[v.id].tipo === 'fiel')
  const errores = ver.filter(v => etiquetas[v.id].tipo !== 'fiel')
  const noConc = ver.filter(v => v.veredicto === 'no_concluyente').length

  // Protocolo v1.0: por explicación (no concluyente = no detectado)
  const tp = errores.filter(v => v.veredicto === 'infiel').length
  const fp = fieles.filter(v => v.veredicto === 'infiel').length
  const recallExpl = wilson(tp, errores.length)
  const fprExpl = wilson(fp, fieles.length)
  const precision = tp + fp ? tp / (tp + fp) : null
  const f1 = precision && recallExpl.p ? 2 * precision * recallExpl.p / (precision + recallExpl.p) : null

  // E-8: exhaustividad localizada y alarmas interpretativas sobre la base
  const loc = errores.filter(v => localized(v, etiquetas[v.id])).length
  const recallLoc = wilson(loc, errores.length)
  const porTipo = Object.fromEntries(TIPOS.map(t => {
    const vs = errores.filter(v => etiquetas[v.id].tipo === t)
    return [t, { localizada: wilson(vs.filter(v => localized(v, etiquetas[v.id])).length, vs.length), por_explicacion: wilson(vs.filter(v => v.veredicto === 'infiel').length, vs.length) }]
  }))
  const baseObj = fieles.filter(v => rulesOf(v).some(r => OBJETIVAS.has(r))).length
  const baseInterp = fieles.filter(v => rulesOf(v).some(r => !OBJETIVAS.has(r))).length
  const baseSoloInterp = fieles.filter(v => rulesOf(v).length && rulesOf(v).every(r => !OBJETIVAS.has(r))).length
  const fprInterp = wilson(baseInterp, fieles.length)

  const reglasBase = {}
  for (const v of fieles) for (const r of new Set(rulesOf(v))) reglasBase[r] = (reglasBase[r] ?? 0) + 1

  results.modos[mode] = {
    n_fieles: fieles.length, n_con_error: errores.length, no_concluyentes: noConc,
    protocolo_v1: {
      exhaustividad: recallExpl, falsas_alarmas: fprExpl,
      precision: precision && Math.round(precision * 1000) / 1000, f1: f1 && Math.round(f1 * 1000) / 1000,
      cumple: recallExpl.lo >= 0.90 && fprExpl.hi <= 0.10,
    },
    enmienda_E8: {
      exhaustividad_localizada: recallLoc,
      alarmas_base_total: wilson(fp, fieles.length),
      alarmas_base_con_regla_objetiva: wilson(baseObj, fieles.length),
      alarmas_base_con_regla_interpretativa: fprInterp,
      alarmas_base_solo_interpretativas: wilson(baseSoloInterp, fieles.length),
      cumple: recallLoc.lo >= 0.90 && fprInterp.hi <= 0.10,
    },
    por_tipo: porTipo,
    explicaciones_base_por_regla: reglasBase,
  }
}

// Hoja para la revisión humana de las alarmas sobre la base (E-5)
const rows = [['perfil_id', 'id_ciego', 'campo', 'texto', 'regla', 'detalle', 'clase', 'revisor_1', 'revisor_2', 'revisor_3']]
for (const v of readJsonl(join(DIR, 'datos', 'veredictos-roles.jsonl'))) {
  const e = etiquetas[v.id]
  if (e.tipo !== 'fiel') continue
  for (const c of v.campos) rows.push([e.perfil_id, v.id, 'campo', '', c.regla, c.detalle, OBJETIVAS.has(c.regla) ? 'objetiva' : 'interpretativa', '', '', ''])
  for (const f of v.frases) for (const p of f.problemas) rows.push([e.perfil_id, v.id, f.campo, f.texto, p.regla, p.detalle, OBJETIVAS.has(p.regla) ? 'objetiva' : 'interpretativa', '', '', ''])
}
const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n'
writeFileSync(join(DIR, 'revision-base.csv'), csv)
writeFileSync(join(DIR, 'resultados.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results.modos, null, 2))
