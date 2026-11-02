/**
 * Short-lived token for the AI proxies (/api/xai and /ws-tts).
 *
 * The kiosk server only proxies xAI calls that carry a token from
 * /api/ai-token. It's cached until shortly before it expires and shared by
 * concurrent callers. Returns null when the endpoint isn't available (e.g.
 * running this demo standalone with `vite`), so callers just send no token.
 */
let cached = null
let pending = null

export async function getAiToken() {
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token
  pending ??= fetch('/api/ai-token', { method: 'POST' })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null)
    .then(data => { cached = data?.token ? data : null; pending = null; return cached?.token ?? null })
  return pending
}

/** JSON headers for /api/xai, including the AI token when available. */
export async function aiHeaders() {
  const token = await getAiToken()
  return {
    'Content-Type': 'application/json',
    ...(token && { 'X-AI-Token': token }),
  }
}
