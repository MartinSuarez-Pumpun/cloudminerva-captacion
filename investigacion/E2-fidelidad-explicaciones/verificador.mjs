// E2 · verificador de fidelidad de las explicaciones de ARA (ENMIENDAS E-1)
//
// Modo «roles»: extrae de cada frase afirmaciones con su papel
//   atributo (familia de interés, rasgo, GTI, filtro, especialidad) → valor (cifra o nivel) → relación
// y las comprueba contra la puntuación determinista (computeScores).
// Modo «sinRoles» (línea base): solo comprueba que cada cifra del texto existe en la puntuación
// y que cada especialidad nombrada es la principal o la alternativa.

import { sentences } from './comun.mjs'

// ── Normalización y tokens ───────────────────────────────────────────────────

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function tokenize(text) {
  // Conserva las cifras con su unidad: 67%, 2/3, 75/100, 0.72 / 0,72
  const re = /\d+(?:[.,]\d+)?\s*(?:%|\/\s*100|\/\s*3)?|[a-zñ]+(?:[/-][a-zñ]+)*|[(),;:]/g
  const out = []
  let m
  const t = norm(text)
  while ((m = re.exec(t))) out.push({ w: m[0], i: m.index })
  return out
}

// ── Léxico de atributos (sobre tokens normalizados) ──────────────────────────
// Cada patrón: lista de tokens consecutivos (regex por token).

const ATTRS = [
  // Rasgos primero, para que «orientación técnica» no se lea como familia técnica
  { key: 'O', kind: 'rasgo', pats: [['orientacion', 'tecnica'], ['orientacion', 'al', 'detalle']] },
  { key: 'A', kind: 'rasgo', pats: [['aspiracion/autoridad'], ['autoridad']] },
  { key: 'D', kind: 'rasgo', pats: [['disciplina']] },
  { key: 'R', kind: 'rasgo', pats: [['resiliencia']] },
  { key: 'T', kind: 'rasgo', pats: [['trabajo', 'en', 'equipo']] },
  { key: 'gti', kind: 'gti', pats: [['gti'], ['entrenabilidad']] },
  // Filtros de disponibilidad
  { key: 'promocion', kind: 'filtro', pats: [['aspiracion', 'a', '^suboficial(es)?$']] },
  { key: 'movilidad', kind: 'filtro', pats: [['movilidad'], ['^geografic[ao]s?$']] },
  { key: 'despliegues', kind: 'filtro', pats: [['^desplieg']] },
  { key: 'riesgo', kind: 'filtro', pats: [['riesgo']] },
  { key: 'horizonte', kind: 'filtro', pats: [['horizonte'], ['temporal']] },
  // Familias de interés
  { key: 'F2', kind: 'interes', pats: [['tecnica/mecanica'], ['^mecanic'], ['^tecnico-mecanic']] },
  { key: 'F1', kind: 'interes', pats: [['combate']] },
  { key: 'F3', kind: 'interes', pats: [['tecnologia/cyber'], ['^tecnologi'], ['^c[iy]ber']] },
  { key: 'F4', kind: 'interes', pats: [['sanidad/cuidado'], ['^sanitari'], ['cuidado'], ['sanidad']] },
  { key: 'F5', kind: 'interes', pats: [['logistica/admin'], ['^logistic'], ['^administra']] },
  { key: 'F6', kind: 'interes', pats: [['mando/liderazgo'], ['mando'], ['liderazgo']] },
  { key: 'F7', kind: 'interes', pats: [['maritimo/aereo'], ['^maritim'], ['^aere']] },
  { key: 'F8', kind: 'interes', pats: [['creativo/artistico'], ['^creativ'], ['^artistic']] },
]

const SPEC_NAMES = {
  infanteria_ligera: 'infanteria ligera', caballeria: 'caballeria', ingenieros: 'ingenieros',
  transmisiones: 'transmisiones', sanidad: 'sanidad', logistica: 'logistica',
  operaciones_sistemas: 'operaciones y sistemas', energia_propulsion: 'energia y propulsion',
  aprovisionamiento: 'aprovisionamiento', maniobra_navegacion: 'maniobra y navegacion',
  infanteria_marina: 'infanteria de marina', proteccion_apoyo: 'proteccion y apoyo a la fuerza',
  mantenimiento_operativo: 'mantenimiento operativo',
}

// ── Léxico de niveles ────────────────────────────────────────────────────────

const LEVELS = [
  ['MEDIOALTO', /^(medi[oa]|moderad[oa]s?)-alt[oa]s?$/],
  ['MAX', /^maxim[oa]s?$/],
  ['NULO', /^(nul[oa]s?|ausencia|ausente|sin|ninguna?|ni|carece)$/],
  ['ALTO', /^(alt[oa]s?|elevad[oa]s?|destacad[oa]s?|fuerte|predominantes?|dominantes?|marcad[oa]|principal|notable|sobresaliente)$/],
  ['BAJO', /^(baj[oa]s?|limitad[oa]s?|reducid[oa]s?|escas[oa]s?|menor|debil|poc[oa])$/],
  ['MEDIO', /^(moderad[oa]s?|medi[oa]s?|intermedi[oa]s?|competente)$/],
]
const FILTER_WORDS = [
  ['SI', /^(disponibilidad|disposicion|disponible|dispuest[oa]|acept|permit|asum)/],
  ['NO_SI', /^(condicion|depend|limit|restric|sin|no)/],
]
const FILLER = /^(de|del|en|por|con|el|la|los|las|un|una|a|al|interes|intereses|puntuacion|puntuaciones|afinidad|atraccion|preferencia|ambito|nivel|indice|rango|dentro|indica|se|situa|que|muestra|valor|valores|capacidad|orientacion|y|muy|total|\(|\)|,|:)$/
const NUM = /^\d/
// Tras el atributo solo se admite relleno corto: «Disciplina alta (3/3)», «GTI de 60 indica nivel competente»
const POST_FILLER = /^(\(|\)|de|del|en|nivel|indica|se|situa|rango|dentro|:|puntuacion|un|el|capacidad|aprendizaje)$/

const levelOf = w => (LEVELS.find(([, re]) => re.test(w)) ?? [null])[0]
const filterOf = w => (FILTER_WORDS.find(([, re]) => re.test(w)) ?? [null])[0]

// Bandas que admite cada nivel, por tipo de atributo (generosas a propósito)
function levelOk(kind, level, v) {
  if (kind === 'interes') {
    return { MAX: v >= 95, NULO: v <= 5, ALTO: v >= 50, MEDIOALTO: v >= 50, BAJO: v <= 50, MEDIO: v >= 17 && v <= 83 }[level]
  }
  if (kind === 'rasgo') {
    return { MAX: v === 3, NULO: v === 0, ALTO: v >= 2, MEDIOALTO: v >= 2, BAJO: v <= 1, MEDIO: v >= 1 && v <= 2 }[level]
  }
  if (kind === 'gti') {
    // Bandas del propio prompt de ARA: <40 bajo, 40-69 competente, ≥70 destacado
    return { MAX: v === 100, NULO: v === 0, ALTO: v >= 70, MEDIOALTO: v >= 55, BAJO: v < 40, MEDIO: v >= 40 && v < 70 }[level]
  }
  return true
}

// ── Extracción de afirmaciones con papel ─────────────────────────────────────

function findAttrs(tokens) {
  const found = []
  const used = new Set()
  for (const a of ATTRS) {
    for (const pat of a.pats) {
      for (let i = 0; i + pat.length <= tokens.length; i++) {
        if ([...Array(pat.length).keys()].some(k => used.has(i + k))) continue
        const ok = pat.every((p, k) => (p.startsWith('^') ? new RegExp(p).test(tokens[i + k].w) : tokens[i + k].w === p))
        if (!ok) continue
        found.push({ key: a.key, kind: a.kind, start: i, end: i + pat.length - 1 })
        for (let k = 0; k < pat.length; k++) used.add(i + k)
      }
    }
  }
  return found.sort((x, y) => x.start - y.start)
}

// Agrupa atributos del mismo tipo separados solo por «,», «y», «e», «ni», «/»
function groups(attrs, tokens) {
  const out = []
  for (const a of attrs) {
    const g = out[out.length - 1]
    if (g && g.kind === a.kind) {
      const between = tokens.slice(g.end + 1, a.start).map(t => t.w)
      if (between.every(w => [',', 'y', 'e', 'ni'].includes(w))) { g.members.push(a); g.end = a.end; continue }
    }
    out.push({ kind: a.kind, members: [a], start: a.start, end: a.end })
  }
  return out
}

function scan(tokens, from, dir, test, maxSteps, stopAt, filler = FILLER) {
  for (let i = from, steps = 0; i >= 0 && i < tokens.length && steps < maxSteps; i += dir, steps++) {
    if (stopAt.has(i)) return null
    const w = tokens[i].w
    const r = test(w)
    if (r) return { value: r, at: i }
    if (!filler.test(w) && !NUM.test(w)) return null
  }
  return null
}

function parseNumber(w) {
  const n = parseFloat(w.replace(',', '.'))
  const unit = /%/.test(w) ? '%' : /\/\s*3/.test(w) ? '/3' : /\/\s*100/.test(w) ? '/100' : ''
  return { n, unit }
}

// ── Valores de referencia ────────────────────────────────────────────────────

function reference(scores) {
  const pct = v => Math.round(v * 100)
  return {
    interes: Object.fromEntries(Object.entries(scores.intereses).map(([k, v]) => [k, pct(v)])),
    rasgo: scores.personalidad,
    gti: scores.gti,
    filtro: scores.motivacion,
    primary: scores.ranking.primary,
    alternative: scores.ranking.alternative,
    allowed: new Set([scores.ranking.primary.id, scores.ranking.alternative.id]),
    affinities: [pct(scores.ranking.primary.affinity), pct(scores.ranking.alternative.affinity)],
    subof: scores.suboficialesPath,
    excluded: scores.motivacion.movilidad === 'no' ? new Set(['infanteria_marina', 'maniobra_navegacion']) : new Set(),
  }
}

function valueOf(ref, a) {
  if (a.kind === 'interes') return ref.interes[a.key]
  if (a.kind === 'rasgo') return ref.rasgo[a.key]
  if (a.kind === 'gti') return ref.gti
  if (a.kind === 'filtro') return ref.filtro[a.key]
}

// ── Comprobaciones por frase ─────────────────────────────────────────────────

const CAUSAL = /(alinea|coincid|coheren|apunt|justific|debido a|compatib|encaj|idoneidad|sugiere|adecuacion)/
const EQUIV = /(igualmente valid|equivalente|comparable|misma afinidad|similar afinidad|ambas .{0,30}igual)/
const PATH = /(via|recorrido|acceso|abre|camino|natural)[^.]{0,40}suboficial|suboficiales?[^.]{0,20}(recorrido|natural)/
const PATH_NEG = /(sin aspiracion|no .{0,15}suboficial|alcanzar (los )?umbral|requiere|refuerzo)/
const ADORNO = /(garantiz|asegur|exito|predic|rendimiento (optimo|excelente|sobresaliente|superior)|ascens|estabilidad|empleabilidad|salari|sueldo|retribu|futuro (prometedor|brillante))/

const UNAMBIGUOUS = Object.entries(SPEC_NAMES).filter(([id]) => id !== 'sanidad' && id !== 'logistica').map(([, n]) => n)
const SPEC_CONTEXT = new RegExp('(especialidad(es)?( de)?|hacia|como|recomienda|alternativa|opcion(es)?|entre|(' +
  UNAMBIGUOUS.join('|') + ')( \\([^)]*\\))? (y|o|e))\\s*$')

// Sanidad y Logística son también nombres de familia: solo cuentan como especialidad
// si llevan la rama entre paréntesis o van en un contexto de especialidad
function specialtiesIn(t) {
  const out = []
  for (const [id, name] of Object.entries(SPEC_NAMES)) {
    const re = new RegExp(`(?<![a-z])${name}(?![a-z/])`, 'g')
    for (const m of t.matchAll(re)) {
      const idx = m.index
      if (id === 'sanidad' || id === 'logistica') {
        const after = t.slice(idx + name.length, idx + name.length + 2)
        const before = t.slice(Math.max(0, idx - 40), idx)
        if (!after.startsWith(' (') && !SPEC_CONTEXT.test(before)) continue
      }
      out.push({ id, at: idx, end: idx + name.length })
    }
  }
  return out
}

function checkSentence(s, ref, mode) {
  const issues = []
  const t = norm(s.text)
  const tokens = tokenize(s.text)

  // Especialidades nombradas (ambos modos)
  for (const sp of specialtiesIn(t)) {
    if (ref.excluded.has(sp.id)) issues.push({ regla: 'especialidad_excluida', detalle: sp.id })
    else if (!ref.allowed.has(sp.id)) issues.push({ regla: 'especialidad_no_recomendada', detalle: sp.id })
  }

  if (mode === 'sinRoles') {
    // Toda cifra del texto debe existir en algún lugar de la puntuación
    const pool = new Set([
      ...Object.values(ref.interes), ...Object.values(ref.rasgo), ref.gti, ...ref.affinities, 100, 3,
    ])
    for (const tk of tokens) {
      if (!NUM.test(tk.w)) continue
      let { n } = parseNumber(tk.w)
      if (n > 0 && n < 1 && /[.,]/.test(tk.w)) n = Math.round(n * 100)
      if (![...pool].some(v => Math.abs(v - n) <= 1)) issues.push({ regla: 'cifra_inexistente', detalle: tk.w })
    }
    return issues
  }

  // 1) Atributos con nivel y cifra (los tramos que son nombre de especialidad no son atributos)
  const specSpans = specialtiesIn(t)
  const attrs = findAttrs(tokens).filter(a => !specSpans.some(sp => tokens[a.start].i >= sp.at && tokens[a.start].i < sp.end))
  const attrPos = new Set(attrs.flatMap(a => Array.from({ length: a.end - a.start + 1 }, (_, k) => a.start + k)))
  const gs = groups(attrs, tokens)
  const testFor = kind => (kind === 'filtro' ? filterOf : levelOf)
  const postFillerFor = kind => (kind === 'gti' ? new RegExp(POST_FILLER.source.replace('^(', '^(,|')) : POST_FILLER)

  // Nivel pospuesto propio de cada atributo; esas palabras ya no sirven como antepuestas del siguiente
  const consumed = new Set(attrPos)
  for (const g of gs) for (const a of g.members) {
    a.post = scan(tokens, a.end + 1, +1, testFor(a.kind), a.kind === 'gti' ? 8 : 4, attrPos, postFillerFor(a.kind))
    if (a.post) consumed.add(a.post.at)
  }
  for (const g of gs) {
    for (const a of g.members) {
      a.pre = scan(tokens, a.start - 1, -1, testFor(a.kind), 5, new Set([...consumed].filter(i => i !== a.post?.at)))
    }
    const groupPre = g.members[0].pre
    const groupPost = g.members[g.members.length - 1].post
    // Filtros: «Disponibilidad geográfica y de despliegue condicionada» → el calificativo va al final de la cláusula
    let clauseNoSi = null
    if (g.kind === 'filtro') {
      for (let i = g.end + 1; i < tokens.length && ![',', ';', ':'].includes(tokens[i].w); i++) {
        if (filterOf(tokens[i].w) === 'NO_SI') { clauseNoSi = { value: 'NO_SI', at: i }; break }
      }
    }
    const isFilter = g.kind === 'filtro'
    const num = scan(tokens, g.end + 1, +1, w => (NUM.test(w) ? w : null), g.kind === 'gti' ? 4 : 3, attrPos)

    for (const a of g.members) {
      const lvl = isFilter
        ? (a.post ?? clauseNoSi ?? a.pre ?? groupPre)
        : (a.post ?? a.pre ?? groupPre ?? groupPost)
      const v = valueOf(ref, a)
      if (v == null) continue
      if (lvl && !isFilter && !levelOk(a.kind, lvl.value, v)) {
        issues.push({ regla: 'nivel', detalle: `${a.key}=${v} descrito como ${lvl.value}` })
      }
      if (lvl && isFilter) {
        if (lvl.value === 'SI' && v !== 'si') issues.push({ regla: 'filtro', detalle: `${a.key}=${v} descrito como disponible` })
        if (lvl.value === 'NO_SI' && v === 'si') issues.push({ regla: 'filtro', detalle: `${a.key}=si descrito como condicionado` })
      }
      if (num && !isFilter) {
        const { n, unit } = parseNumber(num.value)
        const okUnit = a.kind === 'interes' ? unit === '%' || unit === '' : a.kind === 'rasgo' ? unit === '/3' || unit === '' : unit !== '%' && unit !== '/3'
        const okVal = a.kind === 'interes' ? Math.abs(n - v) <= 1 : n === v
        if (!okUnit || !okVal) issues.push({ regla: 'cifra', detalle: `${a.key}=${v} con cifra ${num.value}` })
      }
    }
  }

  // 2) Afinidad citada
  for (const m of t.matchAll(/afinidad(?:es)?(?: [a-z]+){0,2}? (?:del? )?(\d+(?:[.,]\d+)?)\s*(%?)/g)) {
    let n = parseFloat(m[1].replace(',', '.'))
    if (n <= 1 && !m[2]) n = Math.round(n * 100)
    if (!ref.affinities.some(a => Math.abs(a - n) <= 1)) issues.push({ regla: 'afinidad', detalle: `${m[1]}${m[2]} no es ${ref.affinities.join(' ni ')}` })
  }

  // 3) Equivalencia entre principal y alternativa
  if (EQUIV.test(t) && Math.abs(ref.affinities[0] - ref.affinities[1]) >= 5) {
    issues.push({ regla: 'equivalencia', detalle: `afinidades ${ref.affinities.join(' y ')}` })
  }

  // 4) Factor que justifica una especialidad
  const specs = specSpans.filter(sp => ref.allowed.has(sp.id))
  if (specs.length && CAUSAL.test(t)) {
    const fams = new Set(specs.flatMap(sp => Object.keys((sp.id === ref.primary.id ? ref.primary : ref.alternative).interests)))
    for (const a of attrs.filter(a => a.kind === 'interes')) {
      if (!fams.has(a.key)) issues.push({ regla: 'factor_ajeno', detalle: `${a.key} no forma parte de ${specs.map(s => s.id).join('/')}` })
    }
  }

  // 5) Vía de Suboficiales afirmada sin cumplir la condición
  if (PATH.test(t) && !PATH_NEG.test(t) && !ref.subof) issues.push({ regla: 'via_suboficiales', detalle: 'condición no cumplida' })

  // 6) Adorno sin respaldo
  const ad = t.match(ADORNO)
  if (ad) issues.push({ regla: 'adorno', detalle: ad[0] })

  return issues
}

// ── Comprobaciones de campos estructurados (ambos modos) ─────────────────────

function checkFields(report, ref) {
  const issues = []
  const sm = report.specialtyMatch
  const pct = v => Math.round(v * 100)
  if (norm(sm.primary.name) !== SPEC_NAMES[ref.primary.id]) issues.push({ regla: 'campo_principal', detalle: sm.primary.name })
  if (norm(sm.alternative.name) !== SPEC_NAMES[ref.alternative.id]) issues.push({ regla: 'campo_alternativa', detalle: sm.alternative.name })
  if (Math.abs(pct(sm.primary.affinity) - ref.affinities[0]) > 1) issues.push({ regla: 'campo_afinidad', detalle: `principal ${sm.primary.affinity}` })
  if (Math.abs(pct(sm.alternative.affinity) - ref.affinities[1]) > 1) issues.push({ regla: 'campo_afinidad', detalle: `alternativa ${sm.alternative.affinity}` })
  return issues
}

// Reglas objetivas: se comprueban de forma mecánica contra la puntuación, sin interpretar el texto.
// Reglas interpretativas: dependen de leer un nivel, un nexo causal o un adorno en lenguaje natural.
export const OBJETIVAS = new Set(['campo_principal', 'campo_alternativa', 'campo_afinidad', 'campo_suboficiales',
  'equivalencia', 'afinidad', 'cifra', 'via_suboficiales', 'especialidad_excluida', 'cifra_inexistente'])

// ── API ──────────────────────────────────────────────────────────────────────

export function verify(report, scores, mode = 'roles') {
  if (!report || !report.specialtyMatch || scores.ranking.redirected) {
    return { veredicto: 'no_concluyente', frases: [], campos: [] }
  }
  const ref = reference(scores)
  const campos = checkFields(report, ref)
  if (mode === 'roles' && report.suboficialesPath !== ref.subof) {
    campos.push({ regla: 'campo_suboficiales', detalle: `${report.suboficialesPath} y la condición da ${ref.subof}` })
  }
  const frases = sentences(report)
    .map(s => ({ ...s, problemas: checkSentence(s, ref, mode) }))
    .filter(s => s.problemas.length)
  return { veredicto: frases.length || campos.length ? 'infiel' : 'fiel', frases, campos }
}
