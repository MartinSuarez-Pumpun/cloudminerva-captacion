// ── Q1 — Intereses vocacionales ──────────────────────────────────────────────

const Q1_WEIGHTS = {
  I1_1:  [{ f: 'F1', w: 2 }],
  I1_2:  [{ f: 'F2', w: 2 }],
  I1_3:  [{ f: 'F3', w: 2 }],
  I1_4:  [{ f: 'F4', w: 2 }],
  I1_5:  [{ f: 'F5', w: 2 }],
  I1_6:  [{ f: 'F6', w: 2 }],
  I1_7:  [{ f: 'F7', w: 2 }],
  I1_8:  [{ f: 'F8', w: 2 }],
  I1_9:  [{ f: 'F1', w: 1 }, { f: 'F2', w: 2 }],
  I1_10: [{ f: 'F6', w: 2 }, { f: 'F2', w: 1 }],
  I1_11: [{ f: 'F3', w: 1 }, { f: 'F8', w: 1 }],
  I1_12: [{ f: 'F1', w: 1 }, { f: 'F4', w: 1 }, { f: 'F6', w: 1 }],
}

// Suma máxima posible por familia (para normalizar a 0-1)
// F1: I1_1(2) + I1_9(1) + I1_12(1) = 4
// F2: I1_2(2) + I1_9(2) + I1_10(1) = 5
// F3: I1_3(2) + I1_11(1) = 3
// F4: I1_4(2) + I1_12(1) = 3
// F5: I1_5(2) = 2
// F6: I1_6(2) + I1_10(2) + I1_12(1) = 5
// F7: I1_7(2) = 2
// F8: I1_8(2) + I1_11(1) = 3
const Q1_FAMILY_MAX = { F1: 8, F2: 10, F3: 6, F4: 6, F5: 4, F6: 10, F7: 4, F8: 6 }

const Q1_VALUES = { si: 2, ns: 1, no: 0 }

export function scoreQ1(q1) {
  const raw = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0, F7: 0, F8: 0 }
  for (const [itemId, response] of Object.entries(q1)) {
    const value = Q1_VALUES[response] ?? 0
    const weights = Q1_WEIGHTS[itemId] ?? []
    for (const { f, w } of weights) {
      raw[f] = (raw[f] ?? 0) + value * w
    }
  }
  const normalized = {}
  for (const [f, max] of Object.entries(Q1_FAMILY_MAX)) {
    normalized[f] = max > 0 ? raw[f] / max : 0
  }
  return normalized // { F1: 0-1, ..., F8: 0-1 }
}

// ── Q2 — Aptitudes cognitivas (GTI) ──────────────────────────────────────────
// Pesos: Numérico=30 (15+15), Verbal=20 (10+10), Lógico-espacial=50 (25+25)
// Total máximo: 100

const Q2_CORRECT = { A2_1: 'B', A2_2: 'B', A2_3: 'C', A2_4: 'C', A2_5: 'B', A2_6: 'C' }
const Q2_WEIGHTS  = { A2_1: 15,  A2_2: 15,  A2_3: 10,  A2_4: 10,  A2_5: 25,  A2_6: 25  }

export function scoreQ2(q2) {
  let gti = 0
  for (const [itemId, response] of Object.entries(q2)) {
    if (response === Q2_CORRECT[itemId]) {
      gti += Q2_WEIGHTS[itemId] ?? 0
    }
  }
  return Math.min(100, gti)
}

// ── Q3 — Personalidad (elección forzada mini-TAPAS) ──────────────────────────
// Rasgos: D=Disciplina, R=Resiliencia, T=Trabajo equipo, O=Orientación detalle, A=Aceptación autoridad
// Distribución: D=3, R=2, T=2, O=2, A=3 (8 ítems × 1 rasgo por opción elegida)

const Q3_MAP = {
  P3_1: { A: 'D', B: 'R' },
  P3_2: { A: 'O', B: 'T' },
  P3_3: { A: 'A', B: 'D' },
  P3_4: { A: 'R', B: 'O' },
  P3_5: { A: 'T', B: 'D' },
  P3_6: { A: 'A', B: 'R' },
  P3_7: { A: 'O', B: 'T' },
  P3_8: { A: 'A', B: 'D' },
}

export function scoreQ3(q3) {
  const scores = { D: 0, R: 0, T: 0, O: 0, A: 0 }
  for (const [itemId, choice] of Object.entries(q3)) {
    const trait = Q3_MAP[itemId]?.[choice]
    if (trait) scores[trait] = (scores[trait] ?? 0) + 1
  }
  return scores
}

// ── Q4 — Motivación y disponibilidad ─────────────────────────────────────────

export function scoreQ4(q4) {
  return {
    movilidad:   q4.M4_1 ?? null,
    despliegues: q4.M4_2 ?? null,
    riesgo:      q4.M4_3 ?? null,
    horizonte:   q4.M4_4 ?? null,
    promocion:   q4.M4_5 ?? null,
  }
}

// ── Especialidades fundamentales ─────────────────────────────────────────────
// interests: pesos que suman 1.0 (para que interestScore esté en [0,1])
// personality: mínimos requeridos por rasgo

export const SPECIALTIES = [
  {
    id: 'infanteria_ligera',
    name: 'Infantería Ligera',
    branch: 'ET',
    interests: { F1: 0.70, F6: 0.30 },
    personality: { R: 2, T: 2 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'caballeria',
    name: 'Caballería',
    branch: 'ET',
    interests: { F1: 0.70, F2: 0.30 },
    personality: { R: 2, T: 2, D: 1 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'ingenieros',
    name: 'Ingenieros',
    branch: 'ET',
    interests: { F2: 0.70, F1: 0.30 },
    personality: { D: 2, O: 1 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'transmisiones',
    name: 'Transmisiones',
    branch: 'ET',
    interests: { F3: 0.70, F2: 0.30 },
    personality: { O: 2, D: 2 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'sanidad',
    name: 'Sanidad',
    branch: 'ET/Armada/EAE',
    interests: { F4: 1.00 },
    personality: { T: 2, O: 2 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'logistica',
    name: 'Logística',
    branch: 'ET',
    interests: { F5: 0.70, F6: 0.30 },
    personality: { O: 2, D: 2 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'operaciones_sistemas',
    name: 'Operaciones y Sistemas',
    branch: 'Armada',
    interests: { F3: 0.70, F7: 0.30 },
    personality: { O: 2, D: 1 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'energia_propulsion',
    name: 'Energía y Propulsión',
    branch: 'Armada',
    interests: { F2: 0.70, F7: 0.30 },
    personality: { D: 2, O: 1 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'aprovisionamiento',
    name: 'Aprovisionamiento',
    branch: 'Armada',
    interests: { F5: 1.00 },
    personality: { O: 2, D: 2 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'maniobra_navegacion',
    name: 'Maniobra y Navegación',
    branch: 'Armada',
    interests: { F7: 0.70, F1: 0.30 },
    personality: { R: 2, T: 2 },
    blockedByNoMovilidad: true,
  },
  {
    id: 'infanteria_marina',
    name: 'Infantería de Marina',
    branch: 'Armada',
    interests: { F1: 0.70, F7: 0.30 },
    personality: { R: 3, T: 2 },
    blockedByNoMovilidad: true,
  },
  {
    id: 'proteccion_apoyo',
    name: 'Protección y Apoyo a la Fuerza',
    branch: 'EAE',
    interests: { F1: 0.70, F6: 0.30 },
    personality: { R: 2, A: 2 },
    blockedByNoMovilidad: false,
  },
  {
    id: 'mantenimiento_operativo',
    name: 'Mantenimiento Operativo',
    branch: 'EAE',
    interests: { F2: 0.70, F3: 0.30 },
    personality: { O: 2, D: 2 },
    blockedByNoMovilidad: false,
  },
]

// ── Cálculo de afinidad ───────────────────────────────────────────────────────

function interestScore(intereses, specialtyInterests) {
  let score = 0
  for (const [family, weight] of Object.entries(specialtyInterests)) {
    score += (intereses[family] ?? 0) * weight
  }
  return score // weights sum to 1.0, so result is in [0,1]
}

function personalityScore(personalidad, requirements) {
  const entries = Object.entries(requirements)
  if (entries.length === 0) return 1.0
  const met = entries.filter(([t, min]) => (personalidad[t] ?? 0) >= min).length
  if (met === entries.length) return 1.0
  if (met === 0) return 0.0
  return 0.5
}

// Pesos de la fórmula de afinidad: intereses, GTI y personalidad
export const AFFINITY_WEIGHTS = { interests: 0.50, gti: 0.30, personality: 0.20 }

export function computeAffinity(intereses, gti, personalidad, specialty, weights = AFFINITY_WEIGHTS) {
  const iScore = interestScore(intereses, specialty.interests)
  const gtiScore = gti / 100
  const pScore = personalityScore(personalidad, specialty.personality)
  return weights.interests * iScore + weights.gti * gtiScore + weights.personality * pScore
}

export function rankSpecialties(intereses, gti, personalidad, motivacion, weights = AFFINITY_WEIGHTS) {
  // Filtro duro: M4.3='no' → no recomendar ninguna especialidad
  if (motivacion.riesgo === 'no') {
    return { redirected: true }
  }

  // Excluir por movilidad
  const excluded = new Set()
  if (motivacion.movilidad === 'no') {
    SPECIALTIES.filter(s => s.blockedByNoMovilidad).forEach(s => excluded.add(s.id))
  }

  const ranked = SPECIALTIES
    .filter(s => !excluded.has(s.id))
    .map(s => ({ ...s, affinity: computeAffinity(intereses, gti, personalidad, s, weights) }))
    .sort((a, b) => b.affinity - a.affinity)

  const primary = ranked[0]

  // Alternativa: segunda mejor de un cluster dominante distinto
  const primaryDom = Object.entries(primary.interests).sort((a, b) => b[1] - a[1])[0][0]
  const alternative = ranked.find(s => {
    const dom = Object.entries(s.interests).sort((a, b) => b[1] - a[1])[0][0]
    return dom !== primaryDom
  }) ?? ranked[1]

  const tied = ranked.length > 1 && (ranked[0].affinity - ranked[1].affinity) < 0.05

  return { redirected: false, primary, alternative, all: ranked, tied }
}

// ── Entry point principal ────────────────────────────────────────────────────

export function computeScores({ q1, q2, q3, q4 }) {
  const intereses   = scoreQ1(q1)
  const gti         = scoreQ2(q2)
  const personalidad = scoreQ3(q3)
  const motivacion  = scoreQ4(q4)
  const ranking     = rankSpecialties(intereses, gti, personalidad, motivacion)

  const suboficialesPath = gti >= 70 && (personalidad.A ?? 0) >= 2 && q4.M4_5 === 'si'
  const lowGTI           = gti < 40
  const profilePlano     = Object.values(intereses).every(v => v <= 0.30)

  return { intereses, gti, personalidad, motivacion, ranking, suboficialesPath, lowGTI, profilePlano }
}
