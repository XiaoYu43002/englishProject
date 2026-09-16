export interface MeaningSense {
  text: string
}

export interface MeaningPosBlock {
  pos: string
  senses: MeaningSense[]
}

const POS_RULES: Array<{ match: RegExp; label: string }> = [
  { match: /^(vt\.|及物动词)\s*/i, label: '动词' },
  { match: /^(vi\.|不及物动词)\s*/i, label: '动词' },
  { match: /^(n\.|noun|名词)\s*/i, label: '名词' },
  { match: /^(v\.|verb|动词)\s*/i, label: '动词' },
  { match: /^(adj\.|a\.|adjective|形容词)\s*/i, label: '形容词' },
  { match: /^(adv\.|adverb|副词)\s*/i, label: '副词' },
  { match: /^(prep\.|preposition|介词)\s*/i, label: '介词' },
  { match: /^(conj\.|conjunction|连词)\s*/i, label: '连词' },
  { match: /^(pron\.|pronoun|代词)\s*/i, label: '代词' },
  { match: /^(num\.|数词)\s*/i, label: '数词' },
  { match: /^(int\.|interjection|感叹词)\s*/i, label: '感叹词' },
  { match: /^(aux\.|助动词)\s*/i, label: '助动词' },
  { match: /^(art\.|冠词)\s*/i, label: '冠词' },
]

/** 二字标签在前，三字标签靠后，避免短长短错落 */
const POS_DISPLAY_RANK: Record<string, number> = {
  名词: 10,
  动词: 20,
  副词: 30,
  介词: 40,
  连词: 50,
  代词: 60,
  数词: 70,
  冠词: 80,
  '名词 / 动词': 90,
  释义: 100,
  形容词: 200,
  感叹词: 210,
  助动词: 220,
}

function posDisplayRank(pos: string) {
  if (POS_DISPLAY_RANK[pos] != null) return POS_DISPLAY_RANK[pos]
  const hanCount = [...pos].filter((char) => /[\u4e00-\u9fff]/.test(char)).length
  return hanCount >= 3 ? 250 : 150
}

function sortPosLabels(labels: string[]) {
  return [...labels].sort((a, b) => {
    const rank = posDisplayRank(a) - posDisplayRank(b)
    if (rank !== 0) return rank
    return a.localeCompare(b, 'zh-CN')
  })
}

function normalizeSpace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function detectPos(chunk: string): { pos: string; rest: string } | null {
  let text = normalizeSpace(chunk)
  if (!text) return null

  // n. & v.讨论 / n&v.
  const combo = text.match(/^(n\.?\s*[&+]\s*v\.?)\s*[:：]?\s*(.+)$/i)
  if (combo) return { pos: '名词 / 动词', rest: normalizeSpace(combo[2]) }

  const trailingCombo = text.match(/^(.+?)\s*[\(（]\s*n\s*[&+]?\s*v\.?\s*[\)）]\s*$/i)
  if (trailingCombo) return { pos: '名词 / 动词', rest: normalizeSpace(trailingCombo[1]) }

  for (const rule of POS_RULES) {
    if (rule.match.test(text)) {
      return { pos: rule.label, rest: normalizeSpace(text.replace(rule.match, '')) }
    }
  }
  return null
}

function splitSenseParts(rest: string): string[] {
  const cleaned = normalizeSpace(rest).replace(/^[：:]+/, '').replace(/^\d+[\.、\)]\s*/, '')
  if (!cleaned) return []

  const parts: string[] = []
  let buf = ''
  let depth = 0
  for (const ch of cleaned) {
    if (ch === '(' || ch === '（') depth += 1
    if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1)
    if (depth === 0 && /[；;，、]/.test(ch)) {
      const item = normalizeSpace(buf)
      if (item) parts.push(item)
      buf = ''
      continue
    }
    buf += ch
  }
  const last = normalizeSpace(buf)
  if (last) parts.push(last)
  return parts
}

/** 把同行多词性拆开：n. 书；本子 v. 预定（保留 n. & v. 为一整块） */
function splitInlinePosChunks(line: string): string[] {
  const text = normalizeSpace(line)
  if (!text) return []

  const combos: string[] = []
  const masked = text.replace(/n\.?\s*[&+]\s*v\.?/gi, (match) => {
    const key = `__COMBO${combos.length}__`
    combos.push(match)
    return key
  })

  const parts = masked.split(/(?=(?:\s|^)(?:n\.|vt\.|vi\.|v\.|adj\.|a\.|adv\.|prep\.|conj\.)\s*)/i)
  const out: string[] = []
  for (const part of parts) {
    const item = normalizeSpace(part.replace(/__COMBO(\d+)__/g, (_, index) => combos[Number(index)] || ''))
    if (!item) continue
    out.push(item)
  }
  return out.length ? out : [text]
}

/**
 * 将词书释义整理为：
 * 名词
 * 1. ...
 * 动词
 * 1. ...
 * 2. ...
 */
export function buildMeaningBlocks(meanings: string[] = []): MeaningPosBlock[] {
  const order: string[] = []
  const map = new Map<string, string[]>()

  const push = (pos: string, sense: string) => {
    const text = normalizeSpace(sense)
    if (!text) return
    if (!map.has(pos)) {
      map.set(pos, [])
      order.push(pos)
    }
    const list = map.get(pos)!
    if (!list.some((item) => item.toLowerCase() === text.toLowerCase())) list.push(text)
  }

  for (const raw of meanings) {
    const line = normalizeSpace(raw)
    if (!line) continue
    const chunks = splitInlinePosChunks(line)
    let matched = false
    for (const chunk of chunks) {
      const detected = detectPos(chunk)
      if (!detected) continue
      matched = true
      for (const sense of splitSenseParts(detected.rest)) push(detected.pos, sense)
    }
    if (!matched) {
      for (const sense of splitSenseParts(line)) push('释义', sense)
    }
  }

  if (order.length > 1 && order.includes('释义')) {
    const tagged = order.filter((pos) => pos !== '释义')
    const taggedTexts = new Set(tagged.flatMap((pos) => map.get(pos) || []).map((item) => item.toLowerCase()))
    const plain = (map.get('释义') || []).filter((item) => !taggedTexts.has(item.toLowerCase()))
    if (!plain.length) {
      map.delete('释义')
      return sortPosLabels(tagged).map((pos) => ({
        pos,
        senses: (map.get(pos) || []).map((text) => ({ text })),
      }))
    }
    map.set('释义', plain)
  }

  return sortPosLabels(order.filter((pos) => (map.get(pos) || []).length)).map((pos) => ({
    pos,
    senses: (map.get(pos) || []).map((text) => ({ text })),
  }))
}
