// E2 · paso 3: introducción controlada de errores T1–T6 (ENMIENDAS E-4) y conjunto ciego
// Se escribe después de congelar el verificador (E-9). Semilla fija.
// node investigacion/E2-fidelidad-explicaciones/3-errores.mjs

import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { DIR, readJsonl, writeJsonl, mulberry32, shuffle, computeScores, getField, setField } from './comun.mjs'

const SEED = 20261022
const rand = mulberry32(SEED)
const pick = arr => arr[Math.floor(rand() * arr.length)]
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1))

const FAMILY = { F1: 'Combate', F2: 'Técnica/Mecánica', F3: 'Tecnología/Cyber', F4: 'Sanidad/Cuidado', F5: 'Logística/Admin', F6: 'Mando/Liderazgo', F7: 'Marítimo/Aéreo', F8: 'Creativo/Artístico' }
const TRAIT = { D: 'Disciplina', R: 'Resiliencia', T: 'Trabajo en equipo', O: 'Orientación técnica', A: 'Aspiración/Autoridad' }
const lc = s => s.charAt(0).toLowerCase() + s.slice(1)

// ── Plantillas por tipo: cada una devuelve { campo, frase, referencia } o null si no aplica ──

function t1(sc) {
  // Atribución cruzada: el rasgo o familia más bajo recibe el valor del más alto
  const traits = Object.entries(sc.personalidad).sort((a, b) => b[1] - a[1])
  const [hk, hv] = traits[0], [lk, lv] = traits[traits.length - 1]
  const fams = Object.entries(sc.intereses).sort((a, b) => b[1] - a[1])
  const [fh, fhv] = fams[0], [fl, flv] = fams[fams.length - 1]
  const opts = []
  if (hv !== lv) {
    opts.push(
      () => ({ campo: 'profileSummary.personality', frase: `${TRAIT[lk]} alta (${hv}/3), uno de los rasgos más definidos del perfil.`, referencia: `${lk}=${lv}, ${hk}=${hv}` }),
      () => ({ campo: 'narrative', frase: `El rasgo de ${TRAIT[lk]} alcanza ${hv} sobre 3.`, referencia: `${lk}=${lv}, ${hk}=${hv}` }),
      () => ({ campo: 'strengths', frase: `${TRAIT[lk]} (${hv}/3)`, referencia: `${lk}=${lv}, ${hk}=${hv}` }),
    )
  }
  if (Math.round(fhv * 100) !== Math.round(flv * 100)) {
    opts.push(
      () => ({ campo: 'profileSummary.interests', frase: `Interés en ${FAMILY[fl]} del ${Math.round(fhv * 100)}%.`, referencia: `${fl}=${Math.round(flv * 100)}, ${fh}=${Math.round(fhv * 100)}` }),
      () => ({ campo: 'narrative', frase: `Sus intereses se concentran en ${FAMILY[fl]}, con un ${Math.round(fhv * 100)}%.`, referencia: `${fl}=${Math.round(flv * 100)}, ${fh}=${Math.round(fhv * 100)}` }),
    )
  }
  return opts.length ? pick(opts)() : null
}

function t2(sc) {
  // Cifra no respaldada: GTI, interés, rasgo o afinidad con un valor que no está en la puntuación
  const realPct = new Set(Object.values(sc.intereses).map(v => Math.round(v * 100)))
  const gti = sc.gti
  const wrongGti = pick([gti + randInt(15, 30), gti - randInt(15, 30)].filter(x => x >= 0 && x <= 100 && x !== gti)) ?? (gti >= 50 ? gti - 20 : gti + 20)
  const prim = sc.ranking.primary
  const affReal = Math.round(prim.affinity * 100)
  const wrongAff = affReal >= 60 ? affReal - randInt(8, 15) : affReal + randInt(8, 15)
  const [fk] = pick(Object.entries(sc.intereses))
  let wrongPct = randInt(10, 95); while (realPct.has(wrongPct)) wrongPct = randInt(10, 95)
  return pick([
    () => ({ campo: 'profileSummary.cognitive', frase: `Índice de entrenabilidad GTI ${wrongGti}/100.`, referencia: `gti=${gti}` }),
    () => ({ campo: 'narrative', frase: `El GTI obtenido es de ${wrongGti} puntos.`, referencia: `gti=${gti}` }),
    () => ({ campo: 'recommendation', frase: `Afinidad con ${prim.name} del ${wrongAff}%.`, referencia: `afinidad=${affReal}` }),
    () => ({ campo: 'profileSummary.interests', frase: `Interés en ${FAMILY[fk]} (${wrongPct}%).`, referencia: `${fk}=${Math.round(sc.intereses[fk] * 100)}` }),
    () => ({ campo: 'specialtyMatch.primary.affinity', valor: wrongAff / 100, referencia: `afinidad=${affReal}` }),
  ])()
}

function t3(sc) {
  // Especialidad equivocada: se justifica la principal con una familia que no forma parte de ella
  const prim = sc.ranking.primary
  const ajenas = Object.entries(sc.intereses).filter(([f, v]) => !(f in prim.interests) && v >= 0.5)
  const pool = ajenas.length ? ajenas : Object.entries(sc.intereses).filter(([f]) => !(f in prim.interests))
  const [f] = pick(pool)
  const fam = FAMILY[f]
  return pick([
    () => ({ campo: 'recommendation', frase: `${prim.name} encaja por su interés en ${fam}.`, referencia: `${prim.id}: ${Object.keys(prim.interests).join('+')}` }),
    () => ({ campo: 'narrative', frase: `El interés por ${fam} justifica la orientación hacia ${prim.name}.`, referencia: `${prim.id}: ${Object.keys(prim.interests).join('+')}` }),
    () => ({ campo: 'recommendation', frase: `Se recomienda ${prim.name} por la afinidad mostrada con ${fam}.`, referencia: `${prim.id}: ${Object.keys(prim.interests).join('+')}` }),
    () => ({ campo: 'headline', frase: `Su perfil en ${fam} es coherente con ${prim.name}.`, referencia: `${prim.id}: ${Object.keys(prim.interests).join('+')}` }),
  ])()
}

function t4(sc) {
  // Filtro omitido: solo perfiles con movilidad = «no»
  if (sc.motivacion.movilidad !== 'no') return null
  return pick([
    () => ({ campo: 'recommendation', frase: 'Infantería de Marina (Armada) es también una opción adecuada para su perfil.', referencia: 'movilidad=no excluye infanteria_marina' }),
    () => ({ campo: 'recommendation', frase: 'Maniobra y Navegación resultaría igualmente compatible con sus intereses.', referencia: 'movilidad=no excluye maniobra_navegacion' }),
    () => ({ campo: 'strengths', frase: 'Disponibilidad plena para cambios de destino geográfico', referencia: 'movilidad=no' }),
    () => ({ campo: 'narrative', frase: 'Acepta la movilidad geográfica que exige la carrera militar.', referencia: 'movilidad=no' }),
    () => ({ campo: 'recommendation', frase: 'Podría valorar Infantería de Marina como segunda alternativa.', referencia: 'movilidad=no excluye infanteria_marina' }),
  ])()
}

function t5() {
  // Adorno sin respaldo: garantía, predicción o beneficio que la puntuación no sostiene
  return pick([
    () => ({ campo: 'recommendation', frase: 'Esta especialidad le garantiza estabilidad profesional a largo plazo.', referencia: 'sin respaldo' }),
    () => ({ campo: 'narrative', frase: 'Su perfil predice un rendimiento sobresaliente en la formación.', referencia: 'sin respaldo' }),
    () => ({ campo: 'strengths', frase: 'Ascenso rápido asegurado dentro de la escala', referencia: 'sin respaldo' }),
    () => ({ campo: 'recommendation', frase: 'La especialidad ofrece una excelente proyección y buenas salidas en el ámbito civil.', referencia: 'sin respaldo' }),
    () => ({ campo: 'narrative', frase: 'Con este perfil, superar las pruebas de acceso es muy probable.', referencia: 'sin respaldo' }),
  ])()
}

function t6(sc) {
  // Contradicción: lo más bajo descrito como fortaleza, o lo más alto como debilidad
  const traits = Object.entries(sc.personalidad).sort((a, b) => a[1] - b[1])
  const [lk, lv] = traits[0], [hk, hv] = traits[traits.length - 1]
  const fams = Object.entries(sc.intereses).sort((a, b) => a[1] - b[1])
  const [fl, flv] = fams[0]
  const opts = []
  if (lv <= 1) {
    opts.push(
      () => ({ campo: 'strengths', frase: `${TRAIT[lk]} elevada`, referencia: `${lk}=${lv}` }),
      () => ({ campo: 'profileSummary.personality', frase: `${TRAIT[lk]} es uno de sus puntos fuertes.`, referencia: `${lk}=${lv}` }),
      () => ({ campo: 'narrative', frase: `Muestra una ${lc(TRAIT[lk])} alta.`, referencia: `${lk}=${lv}` }),
    )
  }
  if (hv >= 2) {
    opts.push(
      () => ({ campo: 'developmentAreas', frase: `Bajo nivel de ${lc(TRAIT[hk])}`, referencia: `${hk}=${hv}` }),
      () => ({ campo: 'profileSummary.personality', frase: `${TRAIT[hk]} por debajo de lo esperado.`, referencia: `${hk}=${hv}` }),
    )
  }
  if (flv <= 0.2) opts.push(() => ({ campo: 'profileSummary.interests', frase: `Interés muy marcado por ${FAMILY[fl]}.`, referencia: `${fl}=${Math.round(flv * 100)}` }))
  return pick(opts)()
}

const GEN = { T1: t1, T2: t2, T3: t3, T4: t4, T5: t5, T6: t6 }

// ── Aplicación ───────────────────────────────────────────────────────────────

function apply(report, alt) {
  const r = structuredClone(report)
  if (alt.valor !== undefined) {
    const original = getField(r, alt.campo)
    setField(r, alt.campo, alt.valor)
    return { informe: r, original: String(original), alterada: String(alt.valor) }
  }
  const v = getField(r, alt.campo)
  if (Array.isArray(v)) {
    const at = randInt(0, v.length)
    v.splice(at, 0, alt.frase)
  } else {
    // Se inserta como frase nueva en una posición al azar del campo
    const parts = v.split(/(?<=[.!?])\s+/)
    const at = randInt(0, parts.length)
    const frase = /[.!?]$/.test(alt.frase) ? alt.frase : `${alt.frase}.`
    parts.splice(at, 0, frase)
    setField(r, alt.campo, parts.join(' '))
  }
  return { informe: r, original: '', alterada: alt.frase }
}

const perfiles = Object.fromEntries(readJsonl(join(DIR, 'datos', 'perfiles.jsonl')).map(p => [p.id, p]))
const { ids } = JSON.parse(readFileSync(join(DIR, 'datos', 'generados-evaluacion.json'), 'utf8'))
const base = ids.map(id => {
  const g = JSON.parse(readFileSync(join(DIR, 'datos', 'generacion', `${id}.json`), 'utf8'))
  return { id, perfil: perfiles[id], informe: g.informe }
})

// Asignación de tipos: T4 solo a perfiles sin movilidad; el resto, 25 por tipo
const sinMov = shuffle(base.filter(b => b.perfil.q4.M4_1 === 'no'), rand)
const resto = shuffle(base.filter(b => b.perfil.q4.M4_1 !== 'no'), rand)
const t4Set = sinMov.slice(0, 25)
const others = shuffle([...sinMov.slice(25), ...resto], rand)
const assignment = [...t4Set.map(b => [b, 'T4'])]
const types = ['T1', 'T2', 'T3', 'T5', 'T6']
others.forEach((b, i) => assignment.push([b, types[i % types.length]]))

const items = [], labels = []
for (const b of base) items.push({ perfil_id: b.id, informe: b.informe, etiqueta: { tipo: 'fiel' } })
for (const [b, tipo] of assignment) {
  const sc = computeScores(b.perfil)
  const alt = GEN[tipo](sc)
  if (!alt) throw new Error(`${tipo} no aplicable a ${b.id}`)
  const res = apply(b.informe, alt)
  items.push({ perfil_id: b.id, informe: res.informe, etiqueta: { tipo, campo: alt.campo, original: res.original, alterada: res.alterada, referencia: alt.referencia } })
}

// Conjunto ciego barajado: el verificador solo ve id ciego, perfil e informe
const blind = shuffle(items, rand).map((it, i) => ({ ...it, id: `E2-${String(i + 1).padStart(3, '0')}` }))
writeJsonl(join(DIR, 'datos', 'conjunto.jsonl'), blind.map(({ id, perfil_id, informe }) => ({ id, perfil_id, informe })))
writeJsonl(join(DIR, 'datos', 'etiquetas.jsonl'), blind.map(({ id, perfil_id, etiqueta }) => ({ id, perfil_id, ...etiqueta })))

const count = {}
for (const it of items) count[it.etiqueta.tipo] = (count[it.etiqueta.tipo] ?? 0) + 1
console.log({ total: items.length, por_tipo: count })
