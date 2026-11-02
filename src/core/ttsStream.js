/**
 * Streaming TTS via xAI WebSocket (wss://api.x.ai/v1/tts).
 *
 * In dev the browser connects to /ws-tts (Vite proxy) which adds the
 * Authorization header server-side — browsers cannot set headers on WebSocket
 * upgrades, so a proxy is required (as xAI docs recommend). Inside the kiosk
 * the Node server proxies it instead and requires a token from /api/ai-token.
 *
 * Client → server: {"type":"text.delta","delta":"<text>"} then {"type":"text.done"}
 * Server → client: {"type":"audio.delta","delta":"<base64 mp3>"} then {"type":"audio.done"}
 */
import { getAiToken } from './aiToken'

export function streamTTS(text, { onChunk, onDone, onError }) {
  const params = new URLSearchParams({
    language:    'es',
    voice:       'eve',
    codec:       'mp3',
    sample_rate: '24000',
    bit_rate:    '128000',
  })

  let done = false
  let ws = null

  // The kiosk server only accepts TTS sockets that carry an AI token
  getAiToken().then((token) => {
    if (done) return
    if (token) params.set('token', token)
    ws = new WebSocket(`/ws-tts?${params}`)
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'text.delta', delta: "<fast>"+text+"</fast>" }))
      ws.send(JSON.stringify({ type: 'text.done' }))
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        if (e.data.byteLength > 0) onChunk(e.data)
        return
      }
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'audio.delta' && msg.delta) {
          const binary = atob(msg.delta)
          const buf = new ArrayBuffer(binary.length)
          const view = new Uint8Array(buf)
          for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
          onChunk(buf)
        } else if (msg.type === 'audio.done' && !done) {
          done = true; onDone()
        } else if (msg.type === 'error') {
          if (!done) { done = true; onError(new Error(msg.message)) }
        }
      } catch { /* ignore non-JSON */ }
    }

    ws.onclose = () => { if (!done) { done = true; onDone() } }
    ws.onerror = () => { if (!done) { done = true; onError(new Error('WebSocket TTS error')) } }
  })

  return () => { done = true; try { ws?.close() } catch { /* ignore */ } }
}

/** Streams TTS and resolves with a blob URL (or null on failure/timeout). */
export function streamTTSToUrl(text, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const chunks = []
    const timer  = setTimeout(() => { stop(); resolve(null) }, timeoutMs)

    const stop = streamTTS(text, {
      onChunk: (buf) => chunks.push(buf),
      onDone: () => {
        clearTimeout(timer)
        if (chunks.length === 0) { resolve(null); return }
        const blob = new Blob(chunks, { type: 'audio/mpeg' })
        resolve(URL.createObjectURL(blob))
      },
      onError: () => { clearTimeout(timer); resolve(null) },
    })
  })
}
