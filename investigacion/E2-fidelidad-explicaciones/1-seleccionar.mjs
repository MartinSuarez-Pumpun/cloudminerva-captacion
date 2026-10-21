// E2 · paso 1: selección de perfiles (ENMIENDAS E-3)
// node investigacion/E2-fidelidad-explicaciones/1-seleccionar.mjs

import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { DIR, T03_PROFILES, readJsonl, writeJsonl, mulberry32, shuffle, computeScores } from './comun.mjs'

const SEED = 20261021
const N_EVAL = 150, N_EVAL_NO_MOVILIDAD = 40, N_DEV = 20

const rand = mulberry32(SEED)
const pool = readJsonl(T03_PROFILES)
  .filter(p => p.poblacion === 'L')
  .filter(p => !computeScores(p).ranking.redirected)

const noMov = shuffle(pool.filter(p => p.q4.M4_1 === 'no'), rand)
const rest = shuffle(pool.filter(p => p.q4.M4_1 !== 'no'), rand)

const evaluacion = [...noMov.slice(0, N_EVAL_NO_MOVILIDAD), ...rest.slice(0, N_EVAL - N_EVAL_NO_MOVILIDAD)]
// Reservas para sustituir respuestas que no cumplan el esquema (mismo estrato)
const reservas = [...noMov.slice(N_EVAL_NO_MOVILIDAD, N_EVAL_NO_MOVILIDAD + 10), ...rest.slice(N_EVAL - N_EVAL_NO_MOVILIDAD, N_EVAL - N_EVAL_NO_MOVILIDAD + 20)]
const desarrollo = rest.slice(N_EVAL - N_EVAL_NO_MOVILIDAD + 20, N_EVAL - N_EVAL_NO_MOVILIDAD + 20 + N_DEV)

const tag = (rows, conjunto) => rows.map(p => ({ id: p.id, conjunto, estrato: p.q4.M4_1 === 'no' ? 'sin_movilidad' : 'general', q1: p.q1, q2: p.q2, q3: p.q3, q4: p.q4 }))

mkdirSync(join(DIR, 'datos'), { recursive: true })
writeJsonl(join(DIR, 'datos', 'perfiles.jsonl'), [...tag(evaluacion, 'evaluacion'), ...tag(reservas, 'reserva'), ...tag(desarrollo, 'desarrollo')])
console.log({ pool: pool.length, sin_movilidad_disponibles: noMov.length, evaluacion: evaluacion.length, reservas: reservas.length, desarrollo: desarrollo.length })
