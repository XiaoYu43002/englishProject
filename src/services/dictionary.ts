import { apiUrl } from '@/config/api'
import type { DictionaryResult, VocabularyWord } from '@/types/domain'
import { meaningsForBook } from '@/utils/meanings'
import { usePronunciationStore, type AudioAccent } from '@/stores/pronunciation'

export type { AudioAccent }
export type AudioLayer = 'kokoro-cache' | 'kokoro-synth' | 'youdao' | 'unknown'

export function audioLayerLabel(layer: AudioLayer | string, accent: AudioAccent = 'uk') {
  const accentLabel = accent === 'uk' ? '英' : '美'
  if (layer === 'kokoro-cache') return `1.Kokoro${accentLabel}缓存`
  if (layer === 'kokoro-synth') return `1.Kokoro${accentLabel}`
  if (layer === 'youdao') return `2.有道${accentLabel}音`
  return `?.${layer || 'unknown'}`
}

function logAudio(message: string, extra?: Record<string, unknown>) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
  console.log(`[发音] ${message}${suffix}`)
}

export function youdaoVoiceUrl(word: string, accent: AudioAccent = 'uk') {
  const q = String(word || '').trim()
  if (!q) return ''
  const type = accent === 'uk' ? 1 : 2
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(q)}&type=${type}`
}

export function kokoroAudioUrl(word: string, accent: AudioAccent = 'uk', voice?: string) {
  const key = String(word || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.'-]/g, '')
  if (!key) return ''
  const pronunciation = usePronunciationStore()
  const accentKey = accent || pronunciation.accent
  const voiceKey = voice || (accentKey === 'uk' ? pronunciation.voiceUk : pronunciation.voiceUs)
  return apiUrl(`/audio/${accentKey}/${voiceKey}/${key}.mp3`)
}

function withVoice(result: DictionaryResult): DictionaryResult {
  const pronunciation = usePronunciationStore()
  return {
    ...result,
    audioUrl: result.audioUrl || kokoroAudioUrl(result.word, 'us', pronunciation.voiceUs) || youdaoVoiceUrl(result.word, 'us'),
    audioUrlUk: result.audioUrlUk || kokoroAudioUrl(result.word, 'uk', pronunciation.voiceUk) || youdaoVoiceUrl(result.word, 'uk'),
    audioFallbackUrl: result.audioFallbackUrl || youdaoVoiceUrl(result.word, 'us'),
    audioFallbackUrlUk: result.audioFallbackUrlUk || youdaoVoiceUrl(result.word, 'uk'),
  }
}

export async function lookupWord(word: VocabularyWord, bookId?: string): Promise<DictionaryResult> {
  const activeBookId = bookId || word.activeBookId || word.bookIds?.[0] || ''
  const meanings = meaningsForBook(word, activeBookId)
  const local: DictionaryResult = withVoice({
    word: word.word,
    phonetic: word.usphone ? `/${word.usphone}/` : word.ukphone ? `/${word.ukphone}/` : '',
    meanings: meanings.length ? meanings : word.meanings,
    source: 'local',
  })
  const query = activeBookId ? `?bookId=${encodeURIComponent(activeBookId)}` : ''
  const endpoint = apiUrl(`/api/dictionary/${encodeURIComponent(word.word)}${query}`)
  if (!endpoint) return local

  try {
    return await new Promise<DictionaryResult>((resolve) => {
      uni.request({
        url: endpoint,
        timeout: 10000,
        success: (response) => {
          const data = response.data as DictionaryResult
          if (response.statusCode !== 200 || !data?.word) {
            resolve(local)
            return
          }
          if (local.meanings?.length) {
            resolve(withVoice({ ...data, meanings: local.meanings, source: 'local' }))
            return
          }
          resolve(withVoice(data))
        },
        fail: () => resolve(local),
      })
    })
  } catch {
    return local
  }
}

let audio: UniApp.InnerAudioContext | undefined

export function playAudio(url?: string) {
  if (!url) return false
  audio?.destroy()
  audio = uni.createInnerAudioContext()
  audio.obeyMuteSwitch = false
  audio.src = url
  audio.play()
  return true
}

export interface PlayWordAudioResult {
  ok: boolean
  layer: AudioLayer
  layerLabel: string
  accent: AudioAccent
  voice: string
}

/**
 * 直接播 Kokoro 缓存 URL（按音色分目录，命中很快），不再先等 meta。
 * 失败再回退有道。
 */
export async function playWordAudio(
  word: string,
  options?: {
    accent?: AudioAccent
    voice?: string
    audioUrl?: string
    audioFallbackUrl?: string
  },
): Promise<PlayWordAudioResult> {
  const pronunciation = usePronunciationStore()
  const accent: AudioAccent = options?.accent || pronunciation.accent
  const voice = options?.voice || (accent === 'uk' ? pronunciation.voiceUk : pronunciation.voiceUs)
  const fallback = options?.audioFallbackUrl || youdaoVoiceUrl(word, accent)
  const primary = kokoroAudioUrl(word, accent, voice) || options?.audioUrl || ''

  logAudio('准备播放', {
    word,
    accent,
    voice,
    primary: primary || null,
    fallback: fallback || null,
  })

  if (!primary && !fallback) {
    return { ok: false, layer: 'unknown', layerLabel: audioLayerLabel('unknown', accent), accent, voice }
  }

  return await new Promise((resolve) => {
    audio?.destroy()
    audio = uni.createInnerAudioContext()
    audio.obeyMuteSwitch = false

    let settled = false
    let usedFallback = false
    let activeLayer: AudioLayer = primary ? 'kokoro-synth' : 'youdao'

    const finish = (layer: AudioLayer, ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // 成功时统一显示 Kokoro口音（具体 cache/synth 看服务端日志，避免额外请求）
      const displayLayer: AudioLayer = layer === 'youdao' ? 'youdao' : 'kokoro-synth'
      const layerLabel = audioLayerLabel(displayLayer, accent)
      logAudio(ok ? '实际使用' : '播放失败', {
        word,
        accent,
        voice,
        layer: layerLabel,
        url: layer === 'youdao' ? fallback : primary,
      })
      resolve({ ok, layer: displayLayer, layerLabel, accent, voice })
    }

    const timer = setTimeout(() => {
      if (!usedFallback && fallback && fallback !== primary && audio) {
        usedFallback = true
        activeLayer = 'youdao'
        logAudio('播放超时，回退有道', { word, accent })
        audio.src = fallback
        audio.play()
        setTimeout(() => finish('youdao', false), 8000)
        return
      }
      finish(activeLayer, false)
    }, 10000)

    audio.onPlay(() => finish(activeLayer, true))
    audio.onError((err) => {
      logAudio('主地址失败', { word, accent, voice, err: err?.errMsg || err })
      if (usedFallback || !fallback || fallback === primary) {
        finish(activeLayer, false)
        return
      }
      usedFallback = true
      activeLayer = 'youdao'
      if (!audio) {
        finish('youdao', false)
        return
      }
      audio.src = fallback
      audio.play()
    })

    audio.src = primary || fallback
    audio.play()
  })
}
