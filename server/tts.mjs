import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_TIMEOUT_MS = 45000

export const DEFAULT_VOICES = {
  us: process.env.KOKORO_VOICE_US || process.env.KOKORO_VOICE || 'af_heart',
  uk: process.env.KOKORO_VOICE_UK || 'bf_emma',
}

const ALLOWED_VOICES = new Set([
  'af_heart',
  'af_bella',
  'af_sky',
  'bf_emma',
  'bf_isabella',
  'bf_alice',
])

export function normalizeAccent(value) {
  const raw = String(value || 'uk').trim().toLowerCase()
  if (raw === 'us' || raw === 'en-us' || raw === 'en_us' || raw === 'american') return 'us'
  return 'uk'
}

export function normalizeVoice(accent, voice) {
  const key = normalizeAccent(accent)
  const candidate = String(voice || '').trim()
  if (candidate && ALLOWED_VOICES.has(candidate)) return candidate
  return DEFAULT_VOICES[key]
}

export function normalizeAudioWord(word) {
  return String(word || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 .'-]/g, '')
    .slice(0, 64)
}

export function audioFileName(word) {
  const key = normalizeAudioWord(word)
  if (!key) return ''
  return `${key.replace(/ /g, '_')}.mp3`
}

export function createTtsCache({ root, kokoroUrl, timeoutMs }) {
  const baseDir = path.join(root, 'data', 'audio')
  fs.mkdirSync(baseDir, { recursive: true })
  const baseUrl = String(kokoroUrl || '').replace(/\/$/, '')
  const timeout = Number(timeoutMs) || DEFAULT_TIMEOUT_MS
  const inflight = new Map()

  function cachePath(word, accent = 'uk', voice) {
    const name = audioFileName(word)
    const accentKey = normalizeAccent(accent)
    const voiceKey = normalizeVoice(accentKey, voice)
    return name ? path.join(baseDir, accentKey, voiceKey, name) : ''
  }

  function legacyCandidates(word, accent = 'uk', voice) {
    const name = audioFileName(word)
    const accentKey = normalizeAccent(accent)
    const voiceKey = normalizeVoice(accentKey, voice)
    if (!name) return []
    return [
      path.join(baseDir, accentKey, voiceKey, name),
      path.join(baseDir, accentKey, name),
      ...(accentKey === 'us' && voiceKey === DEFAULT_VOICES.us ? [path.join(baseDir, 'en', name)] : []),
    ]
  }

  function resolveExisting(word, accent = 'uk', voice) {
    for (const file of legacyCandidates(word, accent, voice)) {
      if (fs.existsSync(file) && fs.statSync(file).size > 0) return file
    }
    return ''
  }

  function hasCache(word, accent = 'uk', voice) {
    return Boolean(resolveExisting(word, accent, voice))
  }

  async function synthesize(word, accent = 'uk', voice) {
    if (!baseUrl) throw Object.assign(new Error('Kokoro TTS 未配置'), { statusCode: 503 })
    const input = normalizeAudioWord(word)
    if (!input || !/^[a-z][a-z0-9 .'-]{0,63}$/.test(input)) {
      throw Object.assign(new Error('单词格式不正确'), { statusCode: 400 })
    }
    const accentKey = normalizeAccent(accent)
    const voiceKey = normalizeVoice(accentKey, voice)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(`${baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro',
          input,
          voice: voiceKey,
          response_format: 'mp3',
          speed: 1.0,
          stream: false,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw Object.assign(new Error(`Kokoro HTTP ${response.status}${text ? `: ${text.slice(0, 120)}` : ''}`), {
          statusCode: 502,
        })
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) throw Object.assign(new Error('Kokoro 返回空音频'), { statusCode: 502 })
      return { buffer, voice: voiceKey, accent: accentKey }
    } finally {
      clearTimeout(timer)
    }
  }

  async function ensureCached(word, accent = 'uk', voice) {
    const accentKey = normalizeAccent(accent)
    const voiceKey = normalizeVoice(accentKey, voice)
    const existing = resolveExisting(word, accentKey, voiceKey)
    if (existing) return { file: existing, cached: true, accent: accentKey, voice: voiceKey }

    const file = cachePath(word, accentKey, voiceKey)
    if (!file) throw Object.assign(new Error('单词格式不正确'), { statusCode: 400 })
    fs.mkdirSync(path.dirname(file), { recursive: true })

    const lockKey = `${accentKey}:${voiceKey}:${path.basename(file)}`
    if (inflight.has(lockKey)) return inflight.get(lockKey)

    const task = (async () => {
      const { buffer } = await synthesize(word, accentKey, voiceKey)
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
      fs.writeFileSync(tmp, buffer)
      fs.renameSync(tmp, file)
      return { file, cached: false, accent: accentKey, voice: voiceKey }
    })().finally(() => inflight.delete(lockKey))

    inflight.set(lockKey, task)
    return task
  }

  async function health() {
    if (!baseUrl) return { ok: false, configured: false }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      const response = await fetch(`${baseUrl}/health`, { signal: controller.signal }).catch(() =>
        fetch(`${baseUrl}/v1/models`, { signal: controller.signal }),
      )
      clearTimeout(timer)
      return {
        ok: Boolean(response?.ok),
        configured: true,
        url: baseUrl,
        voices: DEFAULT_VOICES,
        allowedVoices: [...ALLOWED_VOICES],
      }
    } catch {
      return {
        ok: false,
        configured: true,
        url: baseUrl,
        voices: DEFAULT_VOICES,
        allowedVoices: [...ALLOWED_VOICES],
      }
    }
  }

  return {
    baseDir,
    cacheDir: path.join(baseDir, 'uk', DEFAULT_VOICES.uk),
    hasCache,
    cachePath,
    ensureCached,
    health,
    configured: Boolean(baseUrl),
    voices: DEFAULT_VOICES,
  }
}

export function publicAudioUrl(word, { accent = 'uk', voice, publicBase, requestHost } = {}) {
  const name = audioFileName(word)
  if (!name) return ''
  const accentKey = normalizeAccent(accent)
  const voiceKey = normalizeVoice(accentKey, voice)
  const rel = `/audio/${accentKey}/${voiceKey}/${name}`
  const base = String(publicBase || '').replace(/\/$/, '')
  if (base) return `${base}${rel}`
  if (requestHost) {
    const host = String(requestHost).replace(/\/$/, '')
    const hasScheme = /^https?:\/\//i.test(host)
    return `${hasScheme ? host : `http://${host}`}${rel}`
  }
  return rel
}
