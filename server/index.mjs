import { createHash, randomInt, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthStore } from './auth-store.mjs'
import { sendAliyunSms, smsConfigured } from './sms.mjs'
import { createTtsCache, publicAudioUrl, normalizeAccent, normalizeVoice } from './tts.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const separator = trimmed.indexOf('=')
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}
const vocabulary = JSON.parse(fs.readFileSync(path.join(root, 'data', 'vocabulary.json'), 'utf8'))
const books = JSON.parse(fs.readFileSync(path.join(root, 'data', 'wordbooks.json'), 'utf8'))
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'taxonomy', 'taxonomy.json'), 'utf8'))
const ocrStopwords = new Set(
  JSON.parse(fs.readFileSync(path.join(root, 'data', 'ocr-stopwords.json'), 'utf8')).map((item) =>
    String(item || '').trim().toLowerCase(),
  ).filter(Boolean),
)
const wordMap = new Map(vocabulary.map((item) => [item.word, item]))
const bookMap = new Map(books.map((item) => [item.id, item]))
const port = Number(process.env.PORT || 8787)

function uniqueMeanings(list = []) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const normalized = String(item || '').trim().replace(/\s+/g, ' ')
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** 一词多画像：词书侧重点在前，常用义补齐 */
function meaningsForBook(entry, bookId) {
  if (!entry) return []
  const focused = bookId ? entry.meaningsByBook?.[bookId] || [] : []
  const common = entry.meanings || []
  return uniqueMeanings([...focused, ...common])
}

function projectWord(entry, bookId) {
  if (!entry) return null
  return {
    ...entry,
    meanings: meaningsForBook(entry, bookId),
    activeBookId: bookId || entry.activeBookId || entry.bookIds?.[0] || '',
  }
}
const allowedOrigin = process.env.CORS_ORIGIN || '*'
const ocrServiceUrl = String(process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8790').replace(/\/$/, '')
const maxUploadBytes = Number(process.env.OCR_MAX_IMAGE_BYTES || 8 * 1024 * 1024) + 128 * 1024
const authStore = createAuthStore(path.join(root, 'data', 'auth-store.json'))
const wechatMpAppId = process.env.WECHAT_MP_APPID || ''
const wechatMpSecret = process.env.WECHAT_MP_SECRET || ''
const smsDebug = String(process.env.SMS_DEBUG || '') === '1'
const publicApiBase = String(process.env.PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const tts = createTtsCache({
  root,
  kokoroUrl: process.env.KOKORO_TTS_URL || 'http://127.0.0.1:8880',
  timeoutMs: process.env.KOKORO_TIMEOUT_MS,
})

function resolveAudioUrl(word, request, accent = 'uk', voice) {
  return publicAudioUrl(word, {
    accent,
    voice,
    publicBase: publicApiBase,
    requestHost: request?.headers?.host,
  }) || youdaoVoiceUrl(word, normalizeAccent(accent) === 'uk' ? '1' : '2')
}

function sendMp3(response, filePath, { cached, accent = 'uk', voice = '' }) {
  const data = fs.readFileSync(filePath)
  const layer = cached ? 'kokoro-cache' : 'kokoro-synth'
  response.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': data.length,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': cached ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    'X-Audio-Source': 'kokoro',
    'X-Audio-Accent': normalizeAccent(accent),
    'X-Audio-Voice': voice || '',
    'X-Audio-Cache': cached ? 'hit' : 'miss',
    'X-Audio-Layer': layer,
  })
  response.end(data)
}

function audioLayerLabel(layer, accent = 'uk') {
  const accentLabel = normalizeAccent(accent) === 'uk' ? '英' : '美'
  if (layer === 'kokoro-cache') return `1.Kokoro${accentLabel}缓存`
  if (layer === 'kokoro-synth') return `1.Kokoro${accentLabel}新合成`
  if (layer === 'youdao') return `2.有道${accentLabel}音`
  return layer || 'unknown'
}

function send(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': status === 200 ? 'private, max-age=60' : 'no-store',
  })
  response.end(JSON.stringify(data))
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('图片过大'), { statusCode: 413 }))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

async function readJson(request, limit = 64 * 1024) {
  const raw = await readBody(request, limit)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    throw Object.assign(new Error('JSON 格式错误'), { statusCode: 400 })
  }
}

function bearerToken(request) {
  const header = String(request.headers.authorization || '')
  const matched = header.match(/^Bearer\s+(.+)$/i)
  return matched ? matched[1].trim() : ''
}

function isPhone(value) {
  return /^1\d{10}$/.test(String(value || ''))
}

function semanticFallback(word) {
  const code = [...word].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const domain = taxonomy[code % taxonomy.length]
  return {
    semanticDomainId: domain.id,
    semanticPath: `${domain.name} › ${domain.slot} › ${word}`,
    reviewRequired: true,
  }
}

function enrichOcrCandidate(candidate) {
  const normalized = String(candidate.normalized || candidate.word || '').toLowerCase()
  const local = wordMap.get(normalized)
  const semantic = local || semanticFallback(normalized)
  return {
    ...candidate,
    id: normalized,
    normalized,
    word: normalized,
    known: Boolean(local),
    meanings: local?.meanings || [],
    usphone: local?.usphone || '',
    ukphone: local?.ukphone || '',
    semanticDomainId: semantic.semanticDomainId,
    semanticPath: semantic.semanticPath,
    reviewRequired: semantic.reviewRequired,
  }
}

function truncateInput(value) {
  return value.length <= 20 ? value : `${value.slice(0, 10)}${value.length}${value.slice(-10)}`
}

function youdaoVoiceUrl(word, type = '2') {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

async function queryYoudao(word) {
  const appKey = process.env.YOUDAO_APP_KEY
  const appSecret = process.env.YOUDAO_APP_SECRET
  if (!appKey || !appSecret) return null
  const salt = randomUUID()
  const curtime = String(Math.floor(Date.now() / 1000))
  const sign = createHash('sha256').update(`${appKey}${truncateInput(word)}${salt}${curtime}${appSecret}`).digest('hex')
  const body = new URLSearchParams({ q: word, from: 'en', to: 'zh-CHS', appKey, salt, sign, signType: 'v3', curtime, ext: 'mp3', voice: '0' })
  const response = await fetch('https://openapi.youdao.com/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error(`Youdao HTTP ${response.status}`)
  const data = await response.json()
  if (data.errorCode !== '0') throw new Error(`Youdao error ${data.errorCode}`)
  return data
}

async function wechatCode2Session(jsCode) {
  if (!wechatMpAppId || !wechatMpSecret) throw Object.assign(new Error('未配置微信小程序 AppID/Secret'), { statusCode: 503 })
  const endpoint = new URL('https://api.weixin.qq.com/sns/jscode2session')
  endpoint.searchParams.set('appid', wechatMpAppId)
  endpoint.searchParams.set('secret', wechatMpSecret)
  endpoint.searchParams.set('js_code', jsCode)
  endpoint.searchParams.set('grant_type', 'authorization_code')
  const response = await fetch(endpoint)
  const data = await response.json()
  if (data.errcode) throw Object.assign(new Error(data.errmsg || `微信登录失败 ${data.errcode}`), { statusCode: 400 })
  if (!data.openid) throw Object.assign(new Error('微信未返回 openid'), { statusCode: 502 })
  return data
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {})
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (url.pathname === '/health') {
    const kokoro = await tts.health()
    return send(response, 200, {
      ok: true,
      words: vocabulary.length,
      books: books.length,
      youdaoConfigured: Boolean(process.env.YOUDAO_APP_KEY && process.env.YOUDAO_APP_SECRET),
      smsConfigured: smsConfigured(),
      wechatMpConfigured: Boolean(wechatMpAppId && wechatMpSecret),
      ocrServiceUrl,
      kokoro,
      audioCacheDir: tts.cacheDir,
    })
  }

  // /audio/{accent}/{voice}/{word}.mp3  或兼容 /audio/{accent|en}/{word}.mp3?voice=
  const audioVoiceMatch = url.pathname.match(/^\/audio\/(us|uk)\/([a-z0-9_]+)\/([^/]+)\.mp3$/i)
  const audioLegacyMatch = url.pathname.match(/^\/audio\/(us|uk|en)\/([^/]+)\.mp3$/i)
  if ((audioVoiceMatch || audioLegacyMatch) && request.method === 'GET') {
    const accent = normalizeAccent(
      audioVoiceMatch
        ? audioVoiceMatch[1]
        : (audioLegacyMatch[1] === 'en' ? 'us' : audioLegacyMatch[1]),
    )
    const voice = normalizeVoice(
      accent,
      audioVoiceMatch ? audioVoiceMatch[2] : (url.searchParams.get('voice') || ''),
    )
    const rawName = decodeURIComponent((audioVoiceMatch ? audioVoiceMatch[3] : audioLegacyMatch[2])).trim().toLowerCase()
    const word = rawName.replace(/_/g, ' ')
    if (!/^[a-z][a-z0-9 .'-]{0,63}$/.test(word)) return send(response, 400, { message: '单词格式不正确' })
    try {
      const existed = tts.hasCache(word, accent, voice)
      const planned = existed ? 'kokoro-cache' : 'kokoro-synth'
      console.log(`[audio] word=${word} accent=${accent} voice=${voice} try=${audioLayerLabel(planned, accent)} url=${url.pathname}`)
      const started = Date.now()
      const result = await tts.ensureCached(word, accent, voice)
      const layer = result.cached ? 'kokoro-cache' : 'kokoro-synth'
      console.log(`[audio] word=${word} accent=${accent} voice=${voice} used=${audioLayerLabel(layer, accent)} ms=${Date.now() - started} bytes=${fs.statSync(result.file).size}`)
      return sendMp3(response, result.file, { cached: result.cached, accent, voice: result.voice })
    } catch (error) {
      console.error(`[audio] word=${word} accent=${accent} voice=${voice} used=${audioLayerLabel('youdao', accent)} reason=kokoro_fail err=${error.message}`)
      return send(response, error.statusCode || 503, {
        message: error.message || '发音合成失败',
        layer: 'youdao',
        accent,
        voice,
        layerLabel: audioLayerLabel('youdao', accent),
        fallback: youdaoVoiceUrl(word, accent === 'uk' ? '1' : '2'),
      })
    }
  }

  const audioMetaMatch = url.pathname.match(/^\/api\/audio\/(us|uk|en)\/(?:([a-z0-9_]+)\/)?([^/]+)$/i)
  if (audioMetaMatch && request.method === 'GET') {
    const accent = normalizeAccent(audioMetaMatch[1] === 'en' ? 'us' : audioMetaMatch[1])
    const voice = normalizeVoice(accent, audioMetaMatch[2] || url.searchParams.get('voice') || '')
    const word = decodeURIComponent(audioMetaMatch[3]).trim().toLowerCase().replace(/_/g, ' ')
    if (!/^[a-z][a-z0-9 .'-]{0,63}$/.test(word)) return send(response, 400, { message: '单词格式不正确' })
    const cached = tts.hasCache(word, accent, voice)
    const layer = cached ? 'kokoro-cache' : (tts.configured ? 'kokoro-synth' : 'youdao')
    console.log(`[audio-meta] word=${word} accent=${accent} voice=${voice} plan=${audioLayerLabel(layer, accent)} cached=${cached}`)
    return send(response, 200, {
      word,
      accent,
      voice,
      layer,
      layerLabel: audioLayerLabel(layer, accent),
      cached,
      audioUrl: resolveAudioUrl(word, request, accent, voice),
      audioFallbackUrl: youdaoVoiceUrl(word, accent === 'uk' ? '1' : '2'),
      fallbackLayer: 'youdao',
      fallbackLayerLabel: audioLayerLabel('youdao', accent),
      voices: tts.voices,
    })
  }
  if (url.pathname === '/api/books') return send(response, 200, books.map(({ wordIds, ...book }) => book))

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const user = authStore.getSessionUser(bearerToken(request))
    if (!user) return send(response, 401, { message: '未登录或登录已过期' })
    return send(response, 200, { user })
  }

  if (url.pathname === '/api/auth/sms/send' && request.method === 'POST') {
    try {
      const body = await readJson(request)
      const phone = String(body.phone || '').trim()
      const scene = String(body.scene || 'login').trim() || 'login'
      if (!isPhone(phone)) return send(response, 400, { message: '请输入正确的手机号' })
      if (!authStore.canSend(phone)) return send(response, 429, { message: '发送太频繁，请稍后再试' })
      const code = String(randomInt(100000, 999999))
      await sendAliyunSms({ phone, code, scene })
      authStore.saveCode(phone, code)
      const payload = { ok: true, cooldownSec: 60 }
      if (smsDebug) payload.debugCode = code
      return send(response, 200, payload)
    } catch (error) {
      console.error('[sms]', error.message)
      return send(response, error.statusCode || 502, { message: error.message || '短信发送失败' })
    }
  }

  if (url.pathname === '/api/auth/sms/login' && request.method === 'POST') {
    try {
      const body = await readJson(request)
      const phone = String(body.phone || '').trim()
      const code = String(body.code || '').trim()
      if (!isPhone(phone)) return send(response, 400, { message: '请输入正确的手机号' })
      if (!/^\d{4,8}$/.test(code)) return send(response, 400, { message: '请输入验证码' })
      if (!authStore.consumeCode(phone, code)) return send(response, 400, { message: '验证码错误或已过期' })
      const user = authStore.upsertPhoneUser(phone)
      const token = authStore.createSession(user.id)
      return send(response, 200, { token, user: authStore.publicUser(user), method: 'phone' })
    } catch (error) {
      return send(response, error.statusCode || 500, { message: error.message || '登录失败' })
    }
  }

  if (url.pathname === '/api/auth/wechat/miniprogram' && request.method === 'POST') {
    try {
      const body = await readJson(request)
      const jsCode = String(body.code || body.js_code || '').trim()
      if (!jsCode) return send(response, 400, { message: '缺少微信登录 code' })
      const session = await wechatCode2Session(jsCode)
      const user = authStore.upsertWechatUser({ openId: session.openid, unionId: session.unionid || '' })
      const token = authStore.createSession(user.id)
      return send(response, 200, { token, user: authStore.publicUser(user), method: 'wechat' })
    } catch (error) {
      console.error('[wechat]', error.message)
      return send(response, error.statusCode || 502, { message: error.message || '微信登录失败' })
    }
  }

  if (url.pathname === '/api/ocr/status' && request.method === 'GET') {
    try {
      const upstream = await fetch(`${ocrServiceUrl}/health`, { signal: AbortSignal.timeout(3000) })
      const data = await upstream.json()
      return send(response, upstream.status, data)
    } catch {
      return send(response, 503, { ok: false, message: 'OCR 服务未启动' })
    }
  }

  if (url.pathname === '/api/ocr/words' && request.method === 'POST') {
    const contentType = String(request.headers['content-type'] || '')
    if (!contentType.startsWith('multipart/form-data')) return send(response, 415, { message: '请使用 multipart/form-data 上传图片' })
    try {
      const body = await readBody(request, maxUploadBytes)
      const upstream = await fetch(`${ocrServiceUrl}/ocr/words`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
        signal: AbortSignal.timeout(45000),
      })
      const data = await upstream.json()
      if (!upstream.ok) return send(response, upstream.status, { message: data.detail || 'OCR 识别失败' })
      return send(response, 200, {
        ...data,
        candidates: (data.candidates || [])
          .filter((item) => !ocrStopwords.has(String(item.normalized || item.word || '').toLowerCase()))
          .map(enrichOcrCandidate),
      })
    } catch (error) {
      const status = error.statusCode || 503
      return send(response, status, { message: status === 413 ? '图片超过大小限制' : 'OCR 服务不可用，请确认 RapidOCR 已启动' })
    }
  }

  const bookMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/words$/)
  if (bookMatch) {
    const book = bookMap.get(decodeURIComponent(bookMatch[1]))
    if (!book) return send(response, 404, { message: '词书不存在' })
    const limit = Math.min(300, Math.max(1, Number(url.searchParams.get('limit')) || 120))
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
    const query = String(url.searchParams.get('q') || '').trim().toLowerCase()
    const sourceIds = query ? book.wordIds.filter((id) => id.includes(query)) : book.wordIds
    const items = sourceIds.slice(offset, offset + limit).map((id) => projectWord(wordMap.get(id), book.id)).filter(Boolean)
    return send(response, 200, { items, total: sourceIds.length, offset, limit })
  }

  const wordMatch = url.pathname.match(/^\/api\/dictionary\/([^/]+)$/)
  if (wordMatch) {
    const word = decodeURIComponent(wordMatch[1]).trim().toLowerCase()
    if (!/^[a-z][a-z .'-]{0,48}$/.test(word)) return send(response, 400, { message: '单词格式不正确' })
    const bookId = String(url.searchParams.get('bookId') || '').trim()
    const local = wordMap.get(word)
    const localMeanings = bookId ? meaningsForBook(local, bookId) : (local?.meanings || [])
    try {
      const online = await queryYoudao(word)
      if (online) {
        const basic = online.basic || {}
        const onlineMeanings = Array.isArray(basic.explains) && basic.explains.length
          ? basic.explains
          : online.translation || []
        // 有词书画像时优先用「侧重点 + 常用义」，有道只补音标/发音
        const meanings = localMeanings.length ? localMeanings : (onlineMeanings.length ? onlineMeanings : local?.meanings || [])
        return send(response, 200, {
          word,
          phonetic: basic['us-phonetic'] ? `/${basic['us-phonetic']}/` : basic.phonetic ? `/${basic.phonetic}/` : '',
          meanings,
          meaningsByBook: local?.meaningsByBook,
          activeBookId: bookId || undefined,
          audioUrl: resolveAudioUrl(word, request, 'us'),
          audioUrlUk: resolveAudioUrl(word, request, 'uk'),
          audioFallbackUrl: youdaoVoiceUrl(word, '2'),
          audioFallbackUrlUk: youdaoVoiceUrl(word, '1'),
          source: localMeanings.length ? 'local' : 'youdao',
        })
      }
    } catch (error) {
      console.error('[youdao]', error.message)
    }
    if (!local) return send(response, 404, { message: '未找到该词' })
    return send(response, 200, {
      word,
      phonetic: local.usphone ? `/${local.usphone}/` : local.ukphone ? `/${local.ukphone}/` : '',
      meanings: localMeanings.length ? localMeanings : local.meanings,
      meaningsByBook: local.meaningsByBook,
      activeBookId: bookId || undefined,
      audioUrl: resolveAudioUrl(word, request, 'us'),
      audioUrlUk: resolveAudioUrl(word, request, 'uk'),
      audioFallbackUrl: youdaoVoiceUrl(word, '2'),
      audioFallbackUrlUk: youdaoVoiceUrl(word, '1'),
      source: 'local',
    })
  }

  return send(response, 404, { message: 'Not found' })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Zhimi dictionary service: http://localhost:${port}`)
  console.log(`Youdao: ${process.env.YOUDAO_APP_KEY && process.env.YOUDAO_APP_SECRET ? 'configured' : 'dictvoice fallback'}`)
  console.log(`Kokoro: ${tts.configured ? process.env.KOKORO_TTS_URL || 'http://127.0.0.1:8880' : 'disabled'} voices=${JSON.stringify(tts.voices)}`)
  console.log(`SMS: ${smsConfigured() ? 'configured' : 'missing'}`)
  console.log(`WeChat MP: ${wechatMpAppId && wechatMpSecret ? 'configured' : 'missing AppID/Secret'}`)
  console.log(`RapidOCR upstream: ${ocrServiceUrl}`)
})
