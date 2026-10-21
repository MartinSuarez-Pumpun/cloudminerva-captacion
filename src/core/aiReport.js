import { z } from 'zod'

export const Schema = z.object({
  headline:     z.string(),
  narrative:    z.string(),
  specialtyMatch: z.object({
    primary:     z.object({ name: z.string(), branch: z.string(), affinity: z.number().min(0).max(1) }),
    alternative: z.object({ name: z.string(), branch: z.string(), affinity: z.number().min(0).max(1) }),
  }),
  profileSummary: z.object({
    interests:   z.string(),
    cognitive:   z.string(),
    personality: z.string(),
  }),
  strengths:          z.array(z.string()),
  developmentAreas:   z.array(z.string()),
  recommendation:     z.string(),
  suboficialesPath:   z.boolean(),
  disclaimer:         z.string(),
})

export const SYSTEM = `Eres ARA, evaluador de orientación vocacional militar para las Fuerzas Armadas españolas (Pumpún Dixital).
Tu función es interpretar los resultados de una batería de evaluación (intereses vocacionales, índice de entrenabilidad GTI, perfil de personalidad y filtros de disponibilidad) y emitir un informe de orientación hacia la especialidad fundamental más adecuada del catálogo español.

REGLAS INNEGOCIABLES:
1. NO INVENTES PUNTUACIONES. Solo usa las métricas que recibes en el payload.
2. NO DIAGNOSTIQUES. No uses términos clínicos ni psicopatológicos.
3. SOLO DESCRIBES PATRONES OBSERVADOS en esta sesión específica.
4. TONO: profesional, sobrio, técnico militar. Sin emojis ni florituras. Frases cortas y claras.
5. El disclaimer debe incluir siempre: "Esta evaluación es una demostración tecnológica orientativa. No sustituye una valoración psicotécnica profesional completa ni puede usarse como criterio único de selección. Las pruebas oficiales se realizan en los Centros de Reclutamiento del Ministerio de Defensa."
6. Responde SOLO con JSON válido, sin markdown ni fences.
7. En profileSummary.personality describe los rasgos con nombres completos (Disciplina, Resiliencia, Trabajo en equipo, Orientación técnica, Aspiración/Autoridad), nunca con los códigos D/R/T/O/A.

CRITERIOS DE GTI: <40 bajo (mencionar preparación), 40-69 competente, ≥70 destacado (abrir puerta a Suboficiales si procede).
ESPECIALIDADES DISPONIBLES: Infantería Ligera (ET), Caballería (ET), Ingenieros (ET), Transmisiones (ET), Sanidad (ET/Armada/EAE), Logística (ET), Operaciones y Sistemas (Armada), Energía y Propulsión (Armada), Aprovisionamiento (Armada), Maniobra y Navegación (Armada), Infantería de Marina (Armada), Protección y Apoyo a la Fuerza (EAE), Mantenimiento Operativo (EAE).`

export function buildPrompt(scores) {
  const { intereses, gti, personalidad, motivacion, ranking, suboficialesPath, lowGTI, profilePlano } = scores
  const familyNames = { F1:'Combate', F2:'Técnica/Mecánica', F3:'Tecnología/Cyber', F4:'Sanidad/Cuidado', F5:'Logística/Admin', F6:'Mando/Liderazgo', F7:'Marítimo/Aéreo', F8:'Creativo/Artístico' }

  const interesLines = Object.entries(intereses)
    .map(([f, v]) => `  ${familyNames[f] ?? f}: ${Math.round(v * 100)}%`)
    .join('\n')

  const TRAIT_NAMES = { D: 'Disciplina', R: 'Resiliencia', T: 'Trabajo en equipo', O: 'Orientación técnica', A: 'Aspiración/Autoridad' }
  const personalidadLines = Object.entries(personalidad)
    .map(([r, v]) => `  ${TRAIT_NAMES[r] ?? r}: ${v}/3`)
    .join(', ')

  const primaryAff  = ranking.primary  ? (ranking.primary.affinity  * 100).toFixed(0) + '%' : 'N/D'
  const altAff      = ranking.alternative ? (ranking.alternative.affinity * 100).toFixed(0) + '%' : 'N/D'

  const flags = []
  if (lowGTI)          flags.push('GTI_BAJO: motivar y no desanimar, señalar preparación previa')
  if (profilePlano)    flags.push('PERFIL_PLANO: priorizar intereses sobre personalidad en la narrativa')
  if (ranking.tied)    flags.push('EMPATE: mencionar ambas especialidades como igualmente válidas')
  if (suboficialesPath) flags.push('VIA_SUBOFICIALES: mencionar explícitamente como recorrido natural')

  return `Candidato evaluado:

Perfil de intereses vocacionales (0-100%):
${interesLines}

Índice de entrenabilidad GTI: ${gti}/100

Perfil de personalidad (0-3 por rasgo):
${personalidadLines}

Filtros de disponibilidad:
  Movilidad geográfica: ${motivacion.movilidad}
  Despliegues internacionales: ${motivacion.despliegues}
  Riesgo físico: ${motivacion.riesgo}
  Horizonte temporal: ${motivacion.horizonte}
  Aspiración a Suboficial: ${motivacion.promocion}

Especialidad recomendada por scoring: ${ranking.primary?.name} (${ranking.primary?.branch}) — afinidad ${primaryAff}
Especialidad alternativa: ${ranking.alternative?.name} (${ranking.alternative?.branch}) — afinidad ${altAff}
${flags.length ? '\nFlags especiales:\n' + flags.map(f => '  • ' + f).join('\n') : ''}

Genera el informe en JSON siguiendo este esquema exacto. IMPORTANTE: affinity debe ser un decimal entre 0 y 1 (ejemplo: 0.72 para 72% de afinidad), NUNCA un porcentaje entero.
{"headline":"string","narrative":"string","specialtyMatch":{"primary":{"name":"string","branch":"string","affinity":decimal_0_a_1},"alternative":{"name":"string","branch":"string","affinity":decimal_0_a_1}},"profileSummary":{"interests":"string","cognitive":"string","personality":"string"},"strengths":["string"],"developmentAreas":["string"],"recommendation":"string","suboficialesPath":boolean,"disclaimer":"string"}`
}

function buildFallback(scores) {
  const primary = scores.ranking.primary
  return {
    headline: primary
      ? `Perfil orientado a ${primary.name} (${primary.branch})`
      : 'Evaluación completada — informe en modo sin conexión.',
    narrative: 'El sistema ha generado este informe en modo fallback. Los datos de la sesión han sido capturados correctamente.',
    specialtyMatch: {
      primary:     { name: primary?.name ?? 'N/D', branch: primary?.branch ?? '', affinity: primary?.affinity ?? 0 },
      alternative: { name: scores.ranking.alternative?.name ?? 'N/D', branch: scores.ranking.alternative?.branch ?? '', affinity: scores.ranking.alternative?.affinity ?? 0 },
    },
    profileSummary: {
      interests:   'Datos capturados. Análisis pendiente de conexión.',
      cognitive:   `GTI: ${scores.gti}/100.`,
      personality: 'Datos capturados. Análisis pendiente de conexión.',
    },
    strengths:        ['Sesión completada correctamente'],
    developmentAreas: ['Requiere análisis con conexión activa'],
    recommendation:   primary
      ? `Explorar la especialidad de ${primary.name}. Contactar con el Centro de Reclutamiento para más información.`
      : 'Contactar con el Centro de Reclutamiento para orientación personalizada.',
    suboficialesPath: scores.suboficialesPath,
    disclaimer: 'Esta evaluación es una demostración tecnológica orientativa. No sustituye una valoración psicotécnica profesional completa ni puede usarse como criterio único de selección. Las pruebas oficiales se realizan en los Centros de Reclutamiento del Ministerio de Defensa.',
  }
}

export async function generateReport(scores) {
  try {
    const res = await fetch('/api/xai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4-fast-non-reasoning',
        max_tokens: 1800,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: buildPrompt(scores) },
        ],
      }),
    })
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    return Schema.parse(parsed)
  } catch {
    return buildFallback(scores)
  }
}
