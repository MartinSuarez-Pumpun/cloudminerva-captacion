// E2 · paso 2: generación de explicaciones con el generador de producción de ARA (ENMIENDAS E-2)
// Dos formas de llamar a Grok:
//   · a través del proxy de producción (la clave la pone el servidor):
//       node investigacion/E2-fidelidad-explicaciones/2-generar.mjs desarrollo https://<dominio>/api/xai
//   · directamente a xAI con XAI_API_KEY en el entorno o en .env.local:
//       node investigacion/E2-fidelidad-explicaciones/2-generar.mjs desarrollo

import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DIR, ROOT, readJsonl, computeScores } from './comun.mjs'
import { SYSTEM, buildPrompt, Schema } from '../../src/core/aiReport.js'

const conjunto = process.argv[2]
if (!['desarrollo', 'evaluacion'].includes(conjunto)) {
  console.error('Uso: 2-generar.mjs desarrollo|evaluacion')
  process.exit(1)
}

const PROXY = process.argv[3]?.replace(/\/+$/, '') ?? null
const ENDPOINT = PROXY ? `${PROXY}/v1/chat/completions` : 'https://api.x.ai/v1/chat/completions'

function apiKey() {
  if (PROXY) return null
  if (process.env.XAI_API_KEY) return process.env.XAI_API_KEY
  const f = join(ROOT, '.env.local')
  if (existsSync(f)) {
    const m = readFileSync(f, 'utf8').match(/^XAI_API_KEY=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  console.error('Falta XAI_API_KEY (entorno o .env.local) o la URL del proxy de producción como segundo argumento.')
  process.exit(1)
}
const KEY = apiKey()

// Mismos parámetros que generateReport en src/core/aiReport.js
const MODEL = 'grok-4-fast-non-reasoning', MAX_TOKENS = 1800, TEMPERATURE = 0.4

const RAW = join(DIR, 'datos', 'generacion')
mkdirSync(RAW, { recursive: true })

async function generate(profile) {
  const out = join(RAW, `${profile.id}.json`)
  if (existsSync(out)) return JSON.parse(readFileSync(out, 'utf8'))
  const scores = computeScores(profile)
  const prompt = buildPrompt(scores)
  const body = {
    model: MODEL, max_tokens: MAX_TOKENS, temperature: TEMPERATURE,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
  }
  let res, data
  for (let attempt = 1; attempt <= 8; attempt++) {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
      body: JSON.stringify(body),
    })
    if (res.ok) { data = await res.json(); break }
    if ([401, 403, 404].includes(res.status)) throw new Error(`${ENDPOINT} respondió ${res.status}: ${(await res.text()).slice(0, 200)}`)
    // 429: el proxy de producción limita a 30 peticiones por minuto
    await new Promise(r => setTimeout(r, res.status === 429 ? 15000 : 2000 * attempt))
  }
  if (!data) throw new Error(`xAI ${res.status} tras 8 intentos (${profile.id})`)

  const content = data.choices?.[0]?.message?.content ?? ''
  let report = null, schemaError = null
  try { report = Schema.parse(JSON.parse(content)) } catch (e) { schemaError = String(e.message ?? e).slice(0, 500) }

  const record = {
    id: profile.id, conjunto: profile.conjunto, fecha: new Date().toISOString(),
    via: PROXY ? 'proxy_produccion' : 'api_xai', modelo_solicitado: MODEL, modelo_respuesta: data.model ?? null, respuesta_id: data.id ?? null,
    parametros: { temperature: TEMPERATURE, max_tokens: MAX_TOKENS },
    entrada: prompt, respuesta_bruta: content, uso: data.usage ?? null,
    cumple_esquema: !!report, error_esquema: schemaError, informe: report,
  }
  writeFileSync(out, JSON.stringify(record, null, 2))
  return record
}

const profiles = readJsonl(join(DIR, 'datos', 'perfiles.jsonl'))
const target = profiles.filter(p => p.conjunto === conjunto)
const reserves = profiles.filter(p => p.conjunto === 'reserva')

const ok = [], failed = []
const queue = target.slice()
async function worker() {
  while (queue.length) {
    const p = queue.shift()
    const r = await generate(p)
    if (r.cumple_esquema) { ok.push(p.id); continue }
    failed.push(p.id)
    // Sustitución por una reserva del mismo estrato (solo en evaluación)
    if (conjunto === 'evaluacion') {
      const sub = reserves.find(x => x.estrato === p.estrato && !x._usada)
      if (sub) { sub._usada = true; queue.push({ ...sub, conjunto: 'evaluacion', sustituye_a: p.id }) }
    }
  }
}
await Promise.all(Array.from({ length: 2 }, worker))

const final = profiles.filter(p => p.conjunto === conjunto).map(p => p.id).filter(id => ok.includes(id))
  .concat(ok.filter(id => !target.some(p => p.id === id)))
writeFileSync(join(DIR, 'datos', `generados-${conjunto}.json`), JSON.stringify({ conjunto, ids: final, sin_esquema: failed }, null, 2))
console.log({ conjunto, generados_validos: final.length, sin_esquema: failed })
