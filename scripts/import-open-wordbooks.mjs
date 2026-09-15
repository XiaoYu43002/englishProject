import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourceDir = process.env.ZHIMI_DICT_SOURCE || path.join(root, 'inputs', 'qwerty-learner')

const books = [
  { id: 'chuzhong', title: '初中英语核心', shortTitle: '初中', file: 'ChuZhongluan_2_T.json', level: '初中基础', accent: '#4d6b58', description: '初中阶段常用词汇，适合入门与同步巩固。' },
  { id: 'zhongkao', title: '中考英语核心', shortTitle: '中考', file: 'ZhongKaoHeXin.json', level: '中考冲刺', accent: '#5a7260', description: '中考高频核心词，覆盖听说读写常见考点。' },
  { id: 'gaokao', title: '高考英语 3500', shortTitle: '高考', file: 'GaoKao_3500.json', level: '高中核心', accent: '#58725f', description: '高中阶段常用与高考核心词汇，适合系统打基础。' },
  { id: 'cet4', title: '大学英语四级', shortTitle: 'CET-4', file: 'CET4_T.json', level: '大学基础', accent: '#2f6652', description: '覆盖四级高频核心词汇，适合日常积累与考前复习。' },
  { id: 'cet6', title: '大学英语六级', shortTitle: 'CET-6', file: 'CET6_T.json', level: '大学进阶', accent: '#a57c42', description: '面向六级阅读、听力与写作的进阶词汇。' },
  { id: 'tem4', title: '英语专业四级', shortTitle: '专四', file: 'Level4luan_2_T.json', level: '专业英语', accent: '#6b7d52', description: '英语专业四级常见词汇，强化专业基础阅读。' },
  { id: 'kaoyan2024', title: '考研英语 2024', shortTitle: '考研', file: 'KaoYan_2024.json', level: '考研备考', accent: '#7a6548', description: '考研英语高频词汇，适合阅读与写作备考。' },
  { id: 'ielts', title: '雅思核心词汇', shortTitle: 'IELTS', file: 'IELTS_3_T.json', level: '留学考试', accent: '#3f6f7a', description: '雅思听说读写高频词，服务出国考试备考。' },
  { id: 'toefl', title: '托福核心词汇', shortTitle: 'TOEFL', file: 'TOEFL_3_T.json', level: '留学考试', accent: '#456a84', description: '托福学术场景核心词汇，强化阅读与听力。' },
  { id: 'sat', title: 'SAT 词汇', shortTitle: 'SAT', file: 'SAT_3_T.json', level: '留学考试', accent: '#5b5f7a', description: 'SAT 常见词汇，侧重学术阅读与精确表达。' },
  { id: 'gre1500', title: 'GRE 核心 1500', shortTitle: 'GRE', file: 'GRE_1500.json', level: '留学进阶', accent: '#8c6a58', description: 'GRE 高频核心词，强化学术阅读与表达。' },
  { id: 'gre3000', title: 'GRE 3000', shortTitle: 'GRE3k', file: 'GRE3000_3_T.json', level: '留学进阶', accent: '#8a5a4a', description: 'GRE 扩展词表，覆盖更广的学术与难词。' },
  { id: 'bec2', title: '商务英语 BEC', shortTitle: 'BEC', file: 'BEC_2_T.json', level: '商务英语', accent: '#5f6f4a', description: '商务英语常用词汇，适合职场与商务场景。' },
]

/** 基础向词书：其释义更容易被视为“常用义” */
const foundationalBooks = new Set(['chuzhong', 'zhongkao', 'gaokao', 'cet4', 'cet6'])

const taxonomy = [
  ['cognition', '认知与思维', '感知·理解·记忆', ['think', 'know', 'mind', 'learn', 'understand', 'memory', 'perceive', 'aware', 'recognize', 'consider', 'believe']],
  ['expression', '表达与观点', '语言·观点·交流', ['say', 'speak', 'tell', 'write', 'word', 'voice', 'express', 'opinion', 'communicate', 'explain', 'discuss']],
  ['relation', '因果与关系', '原因·结果·连接', ['cause', 'result', 'reason', 'relate', 'connect', 'depend', 'link', 'effect', 'because', 'consequence']],
  ['change', '变化与发展', '变化·增长·演进', ['change', 'grow', 'develop', 'increase', 'decrease', 'improve', 'decline', 'rise', 'fall', 'evolve', 'transform']],
  ['control', '控制与影响', '控制·管理·影响', ['control', 'manage', 'govern', 'influence', 'lead', 'rule', 'power', 'command', 'direct', 'dominate']],
  ['action', '行动与选择', '行动·选择·执行', ['act', 'action', 'do', 'make', 'choose', 'decide', 'perform', 'move', 'use', 'try', 'create']],
  ['judgment', '判断与评价', '判断·价值·评价', ['judge', 'value', 'good', 'bad', 'right', 'wrong', 'correct', 'evaluate', 'quality', 'important', 'prefer']],
  ['state', '状态与存在', '状态·属性·存在', ['exist', 'remain', 'seem', 'state', 'condition', 'become', 'appear', 'stable', 'available', 'possible']],
  ['society', '社会与个体', '社会·群体·个体', ['people', 'society', 'social', 'family', 'friend', 'person', 'group', 'public', 'community', 'human']],
  ['economy', '经济与资源', '经济·工作·资源', ['money', 'cost', 'price', 'business', 'market', 'work', 'job', 'resource', 'industry', 'trade', 'economic']],
  ['time', '时间与过程', '时间·顺序·过程', ['time', 'day', 'year', 'month', 'begin', 'start', 'end', 'process', 'period', 'early', 'late']],
  ['quantity', '程度·范围·数量', '数量·范围·程度', ['many', 'few', 'number', 'amount', 'degree', 'range', 'much', 'little', 'more', 'less', 'total']],
].map(([id, name, slot, keywords], index) => ({ id, order: index + 1, name, slot, keywords }))

const byWord = new Map()
const bookOrders = {}

function classify(word, meanings) {
  const text = `${word} ${meanings.join(' ')}`.toLowerCase()
  let best = null
  for (const domain of taxonomy) {
    const score = domain.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0)
    if (!best || score > best.score) best = { domain, score }
  }
  if (best && best.score > 0) return { domain: best.domain, confidence: Math.min(0.95, 0.55 + best.score * 0.12), reviewRequired: false }
  const code = [...word].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return { domain: taxonomy[code % taxonomy.length], confidence: 0.2, reviewRequired: true }
}

function normalizeSense(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[；;]+/g, '；')
}

function uniqueMeanings(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const normalized = normalizeSense(item)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** 跨词书统计释义频次，生成“常用义”；基础词书命中加权 */
function computeCommonMeanings(meaningsByBook) {
  const scoreMap = new Map()
  for (const [bookId, list] of Object.entries(meaningsByBook)) {
    const weight = foundationalBooks.has(bookId) ? 2 : 1
    const seenInBook = new Set()
    for (const meaning of list) {
      const key = normalizeSense(meaning).toLowerCase()
      if (!key || seenInBook.has(key)) continue
      seenInBook.add(key)
      const current = scoreMap.get(key) || { sample: normalizeSense(meaning), score: 0, books: 0 }
      current.score += weight
      current.books += 1
      scoreMap.set(key, current)
    }
  }
  const ranked = [...scoreMap.values()].sort((a, b) => b.score - a.score || b.books - a.books)
  const common = ranked.filter((item) => item.books >= 2 || item.score >= 2).map((item) => item.sample)
  if (common.length) return uniqueMeanings(common)
  return uniqueMeanings(ranked.slice(0, 3).map((item) => item.sample))
}

/** 当前词书画像：词书侧重点在前，常用义补齐 */
function meaningsForBook(entry, bookId) {
  const focused = entry.meaningsByBook?.[bookId] || []
  const common = entry.meanings || []
  return uniqueMeanings([...focused, ...common])
}

for (const book of books) {
  const inputPath = path.join(sourceDir, book.file)
  const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  bookOrders[book.id] = []
  for (const row of rows) {
    const word = String(row.name || '').trim().toLowerCase()
    if (!word || bookOrders[book.id].includes(word)) continue
    const meanings = uniqueMeanings(Array.isArray(row.trans) ? row.trans.map(String) : [])
    const existing = byWord.get(word)
    if (existing) {
      if (!existing.bookIds.includes(book.id)) existing.bookIds.push(book.id)
      existing.meaningsByBook[book.id] = meanings
      if (!existing.usphone && row.usphone) existing.usphone = String(row.usphone)
      if (!existing.ukphone && row.ukphone) existing.ukphone = String(row.ukphone)
    } else {
      const semantic = classify(word, meanings)
      byWord.set(word, {
        id: word,
        word,
        meanings: [],
        meaningsByBook: { [book.id]: meanings },
        usphone: String(row.usphone || ''),
        ukphone: String(row.ukphone || ''),
        bookIds: [book.id],
        semanticDomainId: semantic.domain.id,
        semanticPath: `${semantic.domain.name} › ${semantic.domain.slot} › ${word}`,
        semanticConfidence: semantic.confidence,
        reviewRequired: semantic.reviewRequired,
      })
    }
    bookOrders[book.id].push(word)
  }
}

for (const entry of byWord.values()) {
  entry.meanings = computeCommonMeanings(entry.meaningsByBook)
  // 若常用义为空，回退到任意一本画像
  if (!entry.meanings.length) {
    const firstBook = entry.bookIds[0]
    entry.meanings = uniqueMeanings(entry.meaningsByBook[firstBook] || [])
  }
  const semantic = classify(entry.word, [...entry.meanings, ...Object.values(entry.meaningsByBook).flat()])
  entry.semanticDomainId = semantic.domain.id
  entry.semanticPath = `${semantic.domain.name} › ${semantic.domain.slot} › ${entry.word}`
  entry.semanticConfidence = semantic.confidence
  entry.reviewRequired = semantic.reviewRequired
}

const vocabulary = [...byWord.values()]
const enrichedBooks = books.map(({ file, ...book }) => ({ ...book, wordCount: bookOrders[book.id].length, wordIds: bookOrders[book.id] }))
const reviewRows = vocabulary.filter((item) => item.reviewRequired)
const starterLimit = 80
const starterBooks = enrichedBooks.map(({ wordIds, ...book }) => ({ ...book, previewCount: Math.min(starterLimit, wordIds.length) }))
const starterWords = Object.fromEntries(enrichedBooks.map((book) => [
  book.id,
  book.wordIds.slice(0, starterLimit).map((word) => {
    const entry = byWord.get(word)
    return {
      ...entry,
      meanings: meaningsForBook(entry, book.id),
      activeBookId: book.id,
    }
  }),
]))

const ensure = (...parts) => fs.mkdirSync(path.join(root, ...parts), { recursive: true })
ensure('data')
ensure('taxonomy')
ensure('outputs', 'review')
ensure('outputs', 'html')

fs.writeFileSync(path.join(root, 'data', 'vocabulary.json'), `${JSON.stringify(vocabulary, null, 2)}\n`)
fs.writeFileSync(path.join(root, 'data', 'wordbooks.json'), `${JSON.stringify(enrichedBooks, null, 2)}\n`)
fs.writeFileSync(path.join(root, 'taxonomy', 'taxonomy.json'), `${JSON.stringify(taxonomy.map(({ keywords, ...item }) => item), null, 2)}\n`)
ensure('src', 'data')
fs.writeFileSync(
  path.join(root, 'src', 'data', 'catalog.generated.ts'),
  `// 由 scripts/import-open-wordbooks.mjs 自动生成，请勿手工修改。\nexport const starterBooks = ${JSON.stringify(starterBooks, null, 2)} as const\n\nexport const starterWords = ${JSON.stringify(starterWords, null, 2)} as const\n`,
)

const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
const csvHeader = ['word', 'meanings', 'meaningsByBook', 'usphone', 'ukphone', 'bookIds', 'semanticDomainId', 'semanticPath', 'semanticConfidence', 'reviewRequired']
const csvLines = [csvHeader.join(','), ...vocabulary.map((item) => csvHeader.map((key) => {
  if (key === 'meaningsByBook') return csvEscape(JSON.stringify(item.meaningsByBook || {}))
  return csvEscape(Array.isArray(item[key]) ? item[key].join(' | ') : item[key])
}).join(','))]
fs.writeFileSync(path.join(root, 'data', 'vocabulary.csv'), `\ufeff${csvLines.join('\n')}\n`)

const reviewHeader = 'word,meaning,proposed_domain,confidence,reason'
const reviewCsv = [reviewHeader, ...reviewRows.map((item) => [item.word, item.meanings.join(' | '), item.semanticDomainId, item.semanticConfidence, 'keyword rule did not produce a confident match'].map(csvEscape).join(','))]
fs.writeFileSync(path.join(root, 'outputs', 'review', 'needs_review.csv'), `\ufeff${reviewCsv.join('\n')}\n`)

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>知觅英语词汇数据概览</title><style>body{font-family:sans-serif;background:#f8f5e9;color:#1f2421;padding:32px}table{border-collapse:collapse;background:#fff}th,td{padding:10px 14px;border:1px solid #ddd}h1{color:#1f4d3a}</style><h1>知觅英语词汇数据概览</h1><p>总词条：${vocabulary.length}；一词多画像；待人工语义复核：${reviewRows.length}</p><table><tr><th>词书</th><th>级别</th><th>词数</th></tr>${enrichedBooks.map((book) => `<tr><td>${book.title}</td><td>${book.level}</td><td>${book.wordCount}</td></tr>`).join('')}</table></html>`
fs.writeFileSync(path.join(root, 'outputs', 'html', 'vocabulary_map.html'), html)

const multiProfile = vocabulary.filter((item) => Object.keys(item.meaningsByBook || {}).length > 1).length
console.log(JSON.stringify({
  vocabulary: vocabulary.length,
  multiProfile,
  books: enrichedBooks.map(({ id, wordCount }) => ({ id, wordCount })),
  needsReview: reviewRows.length,
}, null, 2))
