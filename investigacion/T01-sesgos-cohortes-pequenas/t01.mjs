// T01 · E3 · Sesgos con cohortes pequeñas (L5, R-L5.6, H5.2). Protocolo: PROTOCOLO.md
// Ejecutar desde la raíz del repositorio: node investigacion/T01-sesgos-cohortes-pequenas/t01.mjs

import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const SEED = 20261020
const REPS = 1000

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
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
const binomial = (n, p) => { let s = 0; for (let i = 0; i < n; i++) if (rand() < p) s++; return s }

const sigmoid = x => 1 / (1 + Math.exp(-x))
const logit = p => Math.log(p / (1 - p))
const logSig = x => (x >= 0 ? -Math.log1p(Math.exp(-x)) : x - Math.log1p(Math.exp(x)))

// ── Métodos clásicos ─────────────────────────────────────────────────────────

function fourFifths(sA, nA, sB, nB) {
  if (sA === 0) return false
  return (sB / nB) < 0.8 * (sA / nA)
}

const LOG_FACT = [0]
for (let i = 1; i <= 2000; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i)
const logChoose = (n, k) => LOG_FACT[n] - LOG_FACT[k] - LOG_FACT[n - k]

// Fisher unilateral: P(X ≤ sB) con X hipergeométrica (B seleccionado menos que A)
function fisherLower(sA, nA, sB, nB) {
  const S = sA + sB, N = nA + nB
  const lo = Math.max(0, S - nA), hi = Math.min(S, nB)
  const den = logChoose(N, S)
  let p = 0
  for (let x = lo; x <= Math.min(sB, hi); x++) p += Math.exp(logChoose(nB, x) + logChoose(nA, S - x) - den)
  return Math.min(1, p)
}

// ── Modelo bayesiano jerárquico por cuadrícula ───────────────────────────────

const grid = (a, b, step) => { const g = []; for (let x = a; x <= b + 1e-9; x += step) g.push(Math.round(x * 1e6) / 1e6); return g }
const D = grid(-4, 4, 0.1)            // δ y δₖ
const ALPHA = grid(-5, 5, 0.25)       // αₖ
const TAU = grid(0, 1, 0.1)           // τ
const nd = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / s

const logPriorAlpha = ALPHA.map(a => -0.5 * (a / 1.5) ** 2)
const priorDelta = D.map(d => nd(d, 0, 1))
const priorTauRaw = TAU.map(t => nd(t, 0, 0.5))
const priorTau = priorTauRaw.map(w => w / priorTauRaw.reduce((x, y) => x + y, 0))

// Núcleo N(δₖ; δ, τ²) normalizado por filas, para cada τ
const KERNELS = TAU.map(t => {
  if (t === 0) return null
  return D.map(di => {
    const row = D.map(dj => nd(dj, di, t))
    const s = row.reduce((x, y) => x + y, 0)
    return row.map(v => v / s)
  })
})

// Verosimilitud de una promoción, marginalizada en αₖ y convolucionada con cada τ
const cache = new Map()
function cohortTerms(sA, nA, sB, nB) {
  const key = `${nA}|${sA}|${nB}|${sB}`
  let v = cache.get(key)
  if (v) return v
  const logL = D.map(d => {
    let m = -Infinity
    const terms = ALPHA.map((a, i) => {
      const t = logPriorAlpha[i] + sA * logSig(a) + (nA - sA) * logSig(-a) + sB * logSig(a + d) + (nB - sB) * logSig(-(a + d))
      if (t > m) m = t
      return t
    })
    return m + Math.log(terms.reduce((acc, t) => acc + Math.exp(t - m), 0))
  })
  const mx = Math.max(...logL)
  const L = logL.map(l => Math.exp(l - mx))
  v = KERNELS.map(K => (K ? K.map(row => row.reduce((acc, w, j) => acc + w * L[j], 0)) : L))
  cache.set(key, v)
  return v
}

function bayes(cohorts) {
  const terms = cohorts.map(c => cohortTerms(c.sA, c.nA, c.sB, c.nB))
  const post = D.map((_, i) => {
    let s = 0
    for (let m = 0; m < TAU.length; m++) {
      let prod = priorTau[m]
      for (const t of terms) prod *= t[m][i]
      s += prod
    }
    return s * priorDelta[i]
  })
  const Z = post.reduce((x, y) => x + y, 0)
  const sAt = cohorts.reduce((x, c) => x + c.sA, 0), nAt = cohorts.reduce((x, c) => x + c.nA, 0)
  const pA = (sAt + 0.5) / (nAt + 1)
  const dStar = logit(0.8 * pA) - logit(pA)
  let pNeg = 0, pBelowStar = 0
  D.forEach((d, i) => { if (d < 0) pNeg += post[i] / Z; if (d < dStar) pBelowStar += post[i] / Z })
  const level = pNeg >= 0.95 ? 'aviso' : (pBelowStar < 0.05 ? 'sin_indicio' : 'inconcluso')
  return { level, pNeg, pBelowStar }
}

// Exploratorio (posterior al protocolo): decide sobre el efecto de la última
// promoción, δ_K, con préstamo de información de las anteriores, en lugar de δ.
function bayesLast(cohorts) {
  const K = cohorts.length
  const terms = cohorts.map(c => cohortTerms(c.sA, c.nA, c.sB, c.nB))
  const LK = terms[K - 1][0] // τ = 0: verosimilitud sin convolucionar
  const post = D.map(() => 0)
  for (let m = 0; m < TAU.length; m++) {
    const f = D.map((_, i) => {
      let prod = priorTau[m] * priorDelta[i]
      for (let k = 0; k < K - 1; k++) prod *= terms[k][m][i]
      return prod
    })
    for (let j = 0; j < D.length; j++) {
      // p(δ_K = D[j] | δ) = KERNELS[m][i][j]; con τ = 0, δ_K = δ
      const mix = KERNELS[m] ? f.reduce((acc, fi, i) => acc + fi * KERNELS[m][i][j], 0) : f[j]
      post[j] += mix * LK[j]
    }
  }
  const Z = post.reduce((x, y) => x + y, 0)
  const last = cohorts[K - 1]
  const pA = (last.sA + 0.5) / (last.nA + 1)
  const dStar = logit(0.8 * pA) - logit(pA)
  let pNeg = 0, pBelowStar = 0
  D.forEach((d, i) => { if (d < 0) pNeg += post[i] / Z; if (d < dStar) pBelowStar += post[i] / Z })
  return pNeg >= 0.95 ? 'aviso' : (pBelowStar < 0.05 ? 'sin_indicio' : 'inconcluso')
}

// ── Escenarios ───────────────────────────────────────────────────────────────

const NS = [10, 20, 40, 60, 100]
const P0 = [0.3, 0.5, 0.7]
const RATIOS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5]
const SETUPS = [{ K: 1, tau: 0 }, { K: 3, tau: 0 }, { K: 3, tau: 0.3 }]

let commit = 'desconocido'
try { commit = execSync('git rev-parse --short HEAD', { cwd: OUT }).toString().trim() } catch {}

const csv = ['K,tau,n,p0,razon,rep,cohortes_sA_sB,cq,fisher_p,cq_ultima,fisher_p_ultima,bayes,bayes_p_neg,bayes_p_bajo_08,bayes_ultima_exploratorio']
const scenarios = []
const t0 = Date.now()

for (const { K, tau } of SETUPS) {
  for (const n of NS) {
    for (const p0 of P0) {
      for (const r of RATIOS) {
        const delta = logit(p0 * r) - logit(p0)
        const c = { cq: 0, fisher: 0, cq_ultima: 0, fisher_ultima: 0, aviso: 0, inconcluso: 0, sin_indicio: 0, bl: { aviso: 0, inconcluso: 0, sin_indicio: 0 } }
        for (let rep = 0; rep < REPS; rep++) {
          const cohorts = []
          for (let k = 0; k < K; k++) {
            const a = logit(p0) + (K > 1 ? 0.3 * normal() : 0)
            const dk = delta + tau * normal()
            cohorts.push({ sA: binomial(n, sigmoid(a)), nA: n, sB: binomial(n, sigmoid(a + dk)), nB: n })
          }
          const sA = cohorts.reduce((x, q) => x + q.sA, 0), sB = cohorts.reduce((x, q) => x + q.sB, 0)
          const last = cohorts[K - 1]
          const cq = fourFifths(sA, n * K, sB, n * K)
          const fp = fisherLower(sA, n * K, sB, n * K)
          const cqL = fourFifths(last.sA, n, last.sB, n)
          const fpL = fisherLower(last.sA, n, last.sB, n)
          const b = bayes(cohorts)
          const bl = bayesLast(cohorts)
          c.bl[bl]++
          c.cq += cq; c.fisher += fp < 0.05; c.cq_ultima += cqL; c.fisher_ultima += fpL < 0.05; c[b.level]++
          csv.push([K, tau, n, p0, r, rep, cohorts.map(q => `${q.sA}/${q.sB}`).join(' '), +cq, fp.toFixed(5),
            +cqL, fpL.toFixed(5), b.level, b.pNeg.toFixed(5), b.pBelowStar.toFixed(5), bl].join(','))
        }
        const f = x => Math.round((x / REPS) * 1000) / 1000
        scenarios.push({
          K, tau, n, p0, razon: r, delta_real: Math.round(delta * 1000) / 1000,
          alarma: {
            cuatro_quintos: f(c.cq), fisher: f(c.fisher),
            ...(K > 1 ? { cuatro_quintos_ultima: f(c.cq_ultima), fisher_ultima: f(c.fisher_ultima) } : {}),
            bayes: f(c.aviso),
          },
          bayes_niveles: { aviso: f(c.aviso), inconcluso: f(c.inconcluso), sin_indicio: f(c.sin_indicio) },
          exploratorio_bayes_ultima: { aviso: f(c.bl.aviso), inconcluso: f(c.bl.inconcluso), sin_indicio: f(c.bl.sin_indicio) },
        })
      }
    }
  }
  console.error(`K=${K} τ=${tau} listo (${((Date.now() - t0) / 1000).toFixed(1)} s, caché ${cache.size})`)
}

// ── Hipótesis H5.2 ───────────────────────────────────────────────────────────

const find = (K, tau, n, p0, r) => scenarios.find(s => s.K === K && s.tau === tau && s.n === n && s.p0 === p0 && s.razon === r)
const hyp = {}
for (const { K, tau } of SETUPS) {
  const pw = find(K, tau, 40, 0.5, 0.6).alarma, fa = find(K, tau, 40, 0.5, 1.0).alarma
  hyp[`K${K}_tau${tau}`] = Object.fromEntries(Object.keys(pw).map(m =>
    [m, { potencia: pw[m], falsas_alarmas: fa[m], cumple: pw[m] >= 0.8 && fa[m] <= 0.05 }]))
}
const h = Object.values(hyp)
const bayesOnly = h.every(x => x.bayes.cumple && !x.cuatro_quintos.cumple && !x.fisher.cumple)

// Falsa tranquilidad del modelo bayesiano: «sin indicio» con razón real ≤ 0,7
const falseReassurance = scenarios.filter(s => s.razon <= 0.7)
  .reduce((m, s) => Math.max(m, s.bayes_niveles.sin_indicio), 0)
const maxFalseAlarm = {}
for (const s of scenarios.filter(s => s.razon === 1.0)) {
  for (const [m, v] of Object.entries(s.alarma)) maxFalseAlarm[m] = Math.max(maxFalseAlarm[m] ?? 0, v)
}

const explo = {}
for (const { K, tau } of SETUPS) {
  explo[`K${K}_tau${tau}`] = {
    potencia: find(K, tau, 40, 0.5, 0.6).exploratorio_bayes_ultima.aviso,
    falsas_alarmas: find(K, tau, 40, 0.5, 1.0).exploratorio_bayes_ultima.aviso,
  }
}
const exploMaxFA = Math.max(...scenarios.filter(s => s.razon === 1.0).map(s => s.exploratorio_bayes_ultima.aviso))
const exploMaxFR = Math.max(...scenarios.filter(s => s.razon <= 0.7).map(s => s.exploratorio_bayes_ultima.sin_indicio))

const results = {
  prueba: 'T01 · E3 · Sesgos con cohortes pequeñas',
  fecha_ejecucion: new Date().toISOString(),
  semilla: SEED, repeticiones: REPS, commit,
  hipotesis_H5_2: { configuraciones: hyp, confirmada_en_todas: bayesOnly },
  falsas_alarmas_maximas_por_metodo: maxFalseAlarm,
  bayes_falsa_tranquilidad_maxima: falseReassurance,
  exploratorio_bayes_ultima: { n40_p05: explo, falsas_alarmas_maximas: exploMaxFA, falsa_tranquilidad_maxima: exploMaxFR },
  escenarios: scenarios,
}

writeFileSync(join(OUT, 'resultados.json'), JSON.stringify(results, null, 2) + '\n')
writeFileSync(join(OUT, 'repeticiones.csv.gz'), gzipSync(csv.join('\n') + '\n'))

console.log(JSON.stringify({ hipotesis: results.hipotesis_H5_2, falsas_alarmas_maximas_por_metodo: maxFalseAlarm, bayes_falsa_tranquilidad_maxima: falseReassurance, exploratorio: results.exploratorio_bayes_ultima }, null, 2))
for (const { K, tau } of SETUPS) {
  console.log(`\nK=${K} τ=${tau} · p0=0,5`)
  console.table(scenarios.filter(s => s.K === K && s.tau === tau && s.p0 === 0.5).map(s => ({
    n: s.n, razon: s.razon, ...s.alarma, inconcl: s.bayes_niveles.inconcluso, sin_ind: s.bayes_niveles.sin_indicio, expl_aviso: s.exploratorio_bayes_ultima.aviso, expl_sin_ind: s.exploratorio_bayes_ultima.sin_indicio,
  })))
}
