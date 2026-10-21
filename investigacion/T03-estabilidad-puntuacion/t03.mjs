// T03 · Estabilidad de la puntuación de ARA (L5, R-L5.2). Protocolo: PROTOCOLO.md
// Ejecutar desde la raíz del repositorio: node investigacion/T03-estabilidad-puntuacion/t03.mjs

import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  scoreQ1, scoreQ2, scoreQ3, scoreQ4, rankSpecialties, computeScores, AFFINITY_WEIGHTS,
} from '../../src/core/scoring.js'

const OUT = dirname(fileURLToPath(import.meta.url))
const SEED = 20261020
const N = 2000

// ── PRNG reproducible ────────────────────────────────────────────────────────

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const pick = arr => arr[Math.floor(rand() * arr.length)]
const uniform = (a, b) => a + (b - a) * rand()

function gamma(k) {
  // Marsaglia-Tsang; para k < 1 se usa el refuerzo k+1
  if (k < 1) return gamma(k + 1) * Math.pow(rand(), 1 / k)
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x, v
    do {
      const u1 = rand(), u2 = rand()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    if (Math.log(rand()) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v
  }
}
const beta = (a, b) => { const x = gamma(a); return x / (x + gamma(b)) }

// ── Ítems ────────────────────────────────────────────────────────────────────

const Q1_ITEMS = {
  I1_1: ['F1'], I1_2: ['F2'], I1_3: ['F3'], I1_4: ['F4'], I1_5: ['F5'], I1_6: ['F6'],
  I1_7: ['F7'], I1_8: ['F8'], I1_9: ['F1', 'F2'], I1_10: ['F6', 'F2'], I1_11: ['F3', 'F8'],
  I1_12: ['F1', 'F4', 'F6'],
}
const Q2_CORRECT = { A2_1: 'B', A2_2: 'B', A2_3: 'C', A2_4: 'C', A2_5: 'B', A2_6: 'C' }
const Q3_MAP = {
  P3_1: { A: 'D', B: 'R' }, P3_2: { A: 'O', B: 'T' }, P3_3: { A: 'A', B: 'D' }, P3_4: { A: 'R', B: 'O' },
  P3_5: { A: 'T', B: 'D' }, P3_6: { A: 'A', B: 'R' }, P3_7: { A: 'O', B: 'T' }, P3_8: { A: 'A', B: 'D' },
}
const Q4_ITEMS = ['M4_1', 'M4_2', 'M4_3', 'M4_4', 'M4_5']
const BLOCK = { q1: Object.keys(Q1_ITEMS), q2: Object.keys(Q2_CORRECT), q3: Object.keys(Q3_MAP), q4: Q4_ITEMS }
const ALL_ITEMS = Object.entries(BLOCK).flatMap(([b, ids]) => ids.map(id => [b, id]))

// ── Perfiles sintéticos ──────────────────────────────────────────────────────

function profileUniform() {
  const p = { q1: {}, q2: {}, q3: {}, q4: {} }
  for (const id of BLOCK.q1) p.q1[id] = pick(['si', 'ns', 'no'])
  for (const id of BLOCK.q2) p.q2[id] = pick(['A', 'B', 'C', 'D'])
  for (const id of BLOCK.q3) p.q3[id] = pick(['A', 'B'])
  for (const id of BLOCK.q4) p.q4[id] = pick(['si', 'depende', 'no'])
  return p
}

function profileLatent() {
  const p = { q1: {}, q2: {}, q3: {}, q4: {} }
  const theta = {}
  for (const f of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8']) theta[f] = beta(0.7, 0.7)
  for (const [id, fams] of Object.entries(Q1_ITEMS)) {
    const s = fams.reduce((a, f) => a + theta[f], 0) / fams.length
    const u = rand()
    p.q1[id] = u < 0.15 ? 'ns' : (u < 0.15 + 0.85 * s ? 'si' : 'no')
  }
  const ability = rand()
  for (const [id, ok] of Object.entries(Q2_CORRECT)) {
    p.q2[id] = rand() < 0.25 + 0.70 * ability ? ok : pick(['A', 'B', 'C', 'D'].filter(x => x !== ok))
  }
  const g = Object.fromEntries(['D', 'R', 'T', 'O', 'A'].map(t => [t, gamma(1)]))
  for (const [id, m] of Object.entries(Q3_MAP)) {
    p.q3[id] = rand() < g[m.A] / (g[m.A] + g[m.B]) ? 'A' : 'B'
  }
  for (const id of Q4_ITEMS) {
    const u = rand()
    p.q4[id] = u < 0.6 ? 'si' : (u < 0.9 ? 'depende' : 'no')
  }
  return p
}

// ── Ranking y métricas ───────────────────────────────────────────────────────

function rank(p, weights = AFFINITY_WEIGHTS) {
  const r = rankSpecialties(scoreQ1(p.q1), scoreQ2(p.q2), scoreQ3(p.q3), scoreQ4(p.q4), weights)
  return r.redirected ? null : r
}

function kendallTauB(x, y) {
  let c = 0, d = 0, tx = 0, ty = 0
  for (let i = 0; i < x.length; i++) {
    for (let j = i + 1; j < x.length; j++) {
      const sx = sgn(x[i] - x[j]), sy = sgn(y[i] - y[j])
      if (sx === 0 && sy === 0) continue
      if (sx === 0) { tx++; continue }
      if (sy === 0) { ty++; continue }
      if (sx === sy) c++; else d++
    }
  }
  const den = Math.sqrt((c + d + tx) * (c + d + ty))
  return den === 0 ? 1 : (c - d) / den
}

// Las afinidades son sumas de decimales: dos especialidades empatadas en exacto
// pueden diferir en ~1e-16 según el orden de las operaciones. Se tratan como empate.
const EPS = 1e-9
const sgn = d => (Math.abs(d) < EPS ? 0 : Math.sign(d))
const round = (x, k = 4) => Math.round(x * 10 ** k) / 10 ** k

function compare(base, pert) {
  // Afinidad por especialidad, sobre las especialidades admitidas en ambos
  const ids = base.all.map(s => s.id).filter(id => pert.all.some(s => s.id === id))
  const a = ids.map(id => base.all.find(s => s.id === id).affinity)
  const b = ids.map(id => pert.all.find(s => s.id === id).affinity)
  const top5b = base.all.slice(0, 5).map(s => s.id)
  const top5p = pert.all.slice(0, 5).map(s => s.id)
  return {
    tau: round(kendallTauB(a, b)),
    primary_changed: base.primary.id !== pert.primary.id,
    // Cambio entre especialidades que ya estaban empatadas en la línea base (lo decide el redondeo y el orden de la lista)
    primary_changed_within_tie: base.primary.id !== pert.primary.id &&
      Math.abs(base.primary.affinity - (base.all.find(s => s.id === pert.primary.id)?.affinity ?? -1)) < EPS,
    alternative_changed: base.alternative.id !== pert.alternative.id,
    top5_overlap: top5b.filter(id => top5p.includes(id)).length / 5,
    top5_positions_changed: top5b.filter((id, i) => top5p[i] !== id).length,
  }
}

function withoutItems(p, items) {
  const c = { q1: { ...p.q1 }, q2: { ...p.q2 }, q3: { ...p.q3 }, q4: { ...p.q4 } }
  for (const [b, id] of items) delete c[b][id]
  return c
}

function sample(arr, k) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, k)
}

function normalize(w) {
  const s = w.interests + w.gti + w.personality
  return { interests: w.interests / s, gti: w.gti / s, personality: w.personality / s }
}

// Condiciones: cada una devuelve el ranking perturbado de un perfil
const CONDITIONS = []
for (const k of ['interests', 'gti', 'personality']) {
  for (const f of [0.8, 0.9, 1.1, 1.2]) {
    CONDITIONS.push({
      id: `peso_${k}_x${f}`, group: 'pesos_uno_a_uno', amplitude: Math.abs(1 - f),
      run: p => rank(p, normalize({ ...AFFINITY_WEIGHTS, [k]: AFFINITY_WEIGHTS[k] * f })),
    })
  }
}
for (const amp of [0.1, 0.2]) {
  CONDITIONS.push({
    id: `pesos_conjunto_${amp * 100}`, group: 'pesos_conjunto', amplitude: amp,
    run: p => rank(p, normalize({
      interests: AFFINITY_WEIGHTS.interests * uniform(1 - amp, 1 + amp),
      gti: AFFINITY_WEIGHTS.gti * uniform(1 - amp, 1 + amp),
      personality: AFFINITY_WEIGHTS.personality * uniform(1 - amp, 1 + amp),
    })),
  })
}
// Comprobación de la predicción 2: escalar todos los pesos no cambia el orden
CONDITIONS.push({
  id: 'pesos_sin_renormalizar_x1.2', group: 'control', amplitude: 0,
  run: p => rank(p, { interests: 0.6, gti: 0.36, personality: 0.24 }),
})
for (const k of [1, 2, 4, 8]) {
  CONDITIONS.push({
    id: `faltan_${k}`, group: 'faltantes', amplitude: k,
    run: p => rank(withoutItems(p, sample(ALL_ITEMS, k))),
  })
}
for (const b of ['q1', 'q2', 'q3', 'q4']) {
  CONDITIONS.push({
    id: `falta_1_${b}`, group: 'faltantes_bloque', amplitude: 1,
    run: p => rank(withoutItems(p, [[b, pick(BLOCK[b])]])),
  })
}

// ── Ejecución ────────────────────────────────────────────────────────────────

let commit = 'desconocido'
try { commit = execSync('git rev-parse --short HEAD', { cwd: OUT }).toString().trim() } catch {}
const dirty = (() => { try { return execSync('git status --porcelain -- ../../src', { cwd: OUT }).toString().trim() !== '' } catch { return null } })()

const POPULATIONS = { U: profileUniform, L: profileLatent }
const profilesOut = []
const logOut = []
const results = {
  prueba: 'T03 · Estabilidad de la puntuación de ARA',
  fecha_ejecucion: new Date().toISOString(),
  semilla: SEED, n_por_poblacion: N, commit, src_modificado_sin_commit: dirty,
  pesos_base: AFFINITY_WEIGHTS, poblaciones: {},
}

const median = a => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const quantile = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))] }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length

for (const [pop, gen] of Object.entries(POPULATIONS)) {
  const perCond = Object.fromEntries(CONDITIONS.map(c => [c.id, []]))
  let redirected = 0, exactTop1Ties = 0, tiedFlag = 0, prodMismatch = 0, valid = 0
  const marginTop1 = []

  for (let i = 0; i < N; i++) {
    const p = gen()
    const pid = `${pop}-${String(i).padStart(4, '0')}`
    profilesOut.push(JSON.stringify({ id: pid, poblacion: pop, ...p }))
    const base = rank(p)
    if (!base) { redirected++; continue }
    valid++

    // La línea base debe coincidir con la ruta de producción (computeScores)
    const prod = computeScores(p).ranking
    if (prod.primary.id !== base.primary.id || prod.all.some((s, j) => s.id !== base.all[j].id)) prodMismatch++

    const m = base.all[0].affinity - base.all[1].affinity
    marginTop1.push(m)
    if (m < EPS) exactTop1Ties++
    if (base.tied) tiedFlag++

    for (const c of CONDITIONS) {
      const pert = c.run(p)
      if (!pert) continue
      const r = compare(base, pert)
      perCond[c.id].push(r)
      logOut.push(JSON.stringify({ perfil: pid, condicion: c.id, ...r }))
    }
  }

  const agg = {}
  for (const c of CONDITIONS) {
    const rs = perCond[c.id]
    const taus = rs.map(r => r.tau)
    agg[c.id] = {
      grupo: c.group, n: rs.length,
      tau_mediana: round(median(taus)), tau_p05: round(quantile(taus, 0.05)), tau_media: round(mean(taus)),
      cambio_principal: round(mean(rs.map(r => +r.primary_changed))),
      cambio_principal_entre_empatadas: round(mean(rs.map(r => +r.primary_changed_within_tie))),
      cambio_alternativa: round(mean(rs.map(r => +r.alternative_changed))),
      solape_top5_medio: round(mean(rs.map(r => r.top5_overlap))),
      puestos_top5_cambiados_medio: round(mean(rs.map(r => r.top5_positions_changed))),
    }
  }

  results.poblaciones[pop] = {
    perfiles: N, redirigidos: redirected, analizados: valid,
    discrepancias_con_produccion: prodMismatch,
    linea_base: {
      empate_exacto_primer_puesto: round(exactTop1Ties / valid),
      aviso_empate_menor_005: round(tiedFlag / valid),
      margen_primer_segundo_mediana: round(median(marginTop1)),
    },
    condiciones: agg,
  }
}

// ── Criterios del protocolo ──────────────────────────────────────────────────

const criteria = {}
for (const [pop, r] of Object.entries(results.poblaciones)) {
  const c = r.condiciones
  const at = amp => Object.entries(c).filter(([id, v]) =>
    (v.grupo === 'pesos_uno_a_uno' || v.grupo === 'pesos_conjunto') &&
    Math.abs(CONDITIONS.find(x => x.id === id).amplitude - amp) < 1e-9)
  const worst = rows => ({
    tau_mediana_min: Math.min(...rows.map(([, v]) => v.tau_mediana)),
    cambio_principal_max: Math.max(...rows.map(([, v]) => v.cambio_principal)),
  })
  const w10 = worst(at(0.1)), w20 = worst(at(0.2))
  criteria[pop] = {
    pesos_10: { ...w10, cumple: w10.tau_mediana_min >= 0.90 && w10.cambio_principal_max <= 0.05 },
    pesos_20: { ...w20, cumple: w20.tau_mediana_min >= 0.80 && w20.cambio_principal_max <= 0.10 },
    falta_1: { cambio_principal: c.faltan_1.cambio_principal, cumple: c.faltan_1.cambio_principal <= 0.10 },
  }
}
results.criterios = criteria

// Predicciones analíticas: el orden no cambia salvo entre especialidades ya empatadas
const strictlyStable = v => v.cambio_principal === v.cambio_principal_entre_empatadas && v.tau_p05 === 1
const pred = {}
for (const [pop, r] of Object.entries(results.poblaciones)) {
  const c = r.condiciones
  pred[pop] = {
    p1_peso_gti_no_cambia_orden: ['peso_gti_x0.8', 'peso_gti_x0.9', 'peso_gti_x1.1', 'peso_gti_x1.2']
      .every(id => strictlyStable(c[id])),
    p2_escalar_pesos_no_cambia_orden: strictlyStable(c['pesos_sin_renormalizar_x1.2']),
    p3_faltar_aptitud_no_cambia_orden: strictlyStable(c.falta_1_q2),
  }
}
results.predicciones = pred

writeFileSync(join(OUT, 'perfiles.jsonl.gz'), gzipSync(profilesOut.join('\n') + '\n'))
writeFileSync(join(OUT, 'registros.jsonl.gz'), gzipSync(logOut.join('\n') + '\n'))
writeFileSync(join(OUT, 'resultados.json'), JSON.stringify(results, null, 2) + '\n')

console.log(JSON.stringify({ criterios: criteria, predicciones: pred }, null, 2))
for (const [pop, r] of Object.entries(results.poblaciones)) {
  console.log(`\nPoblación ${pop}: ${r.analizados} analizados, ${r.redirigidos} redirigidos, ${r.discrepancias_con_produccion} discrepancias con producción`)
  console.log('línea base', r.linea_base)
  console.table(Object.fromEntries(Object.entries(r.condiciones).map(([id, v]) =>
    [id, { tau_med: v.tau_mediana, tau_p05: v.tau_p05, principal: v.cambio_principal, en_empate: v.cambio_principal_entre_empatadas, alternativa: v.cambio_alternativa, solape5: v.solape_top5_medio }])))
}
