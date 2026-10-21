// E2 · utilidades comunes: perfiles, puntuación, PRNG y lectura de ficheros

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeScores, SPECIALTIES } from '../../src/core/scoring.js'

export const DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(DIR, '..', '..')
export const T03_PROFILES = join(DIR, '..', 'T03-estabilidad-puntuacion', 'perfiles.jsonl.gz')

export { computeScores, SPECIALTIES }

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(arr, rand) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function readJsonl(path) {
  if (!existsSync(path)) return []
  const raw = path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString() : readFileSync(path, 'utf8')
  return raw.split('\n').filter(Boolean).map(l => JSON.parse(l))
}

export function writeJsonl(path, rows) {
  writeFileSync(path, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}

// Campos de texto del informe que se verifican (el disclaimer es texto fijo exigido por el prompt)
export const TEXT_FIELDS = ['headline', 'narrative', 'profileSummary.interests', 'profileSummary.cognitive',
  'profileSummary.personality', 'strengths', 'developmentAreas', 'recommendation']

export function getField(report, field) {
  return field.split('.').reduce((o, k) => (o == null ? o : o[k]), report)
}

export function setField(report, field, value) {
  const keys = field.split('.')
  const last = keys.pop()
  keys.reduce((o, k) => o[k], report)[last] = value
}

// Frases de un informe: [{ field, index, text }]; las listas cuentan cada elemento como un bloque
export function sentences(report) {
  const out = []
  for (const field of TEXT_FIELDS) {
    const v = getField(report, field)
    const blocks = Array.isArray(v) ? v : [v]
    blocks.forEach((b, bi) => {
      if (typeof b !== 'string') return
      splitSentences(b).forEach((text, si) => out.push({ field, block: bi, index: si, text }))
    })
  }
  return out
}

export function splitSentences(text) {
  // Corta en . ! ? seguidos de espacio y mayúscula; respeta decimales (0,72 / 0.72)
  return text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"])/u).map(s => s.trim()).filter(Boolean)
}
