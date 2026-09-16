export type LoginMethod = 'phone' | 'wechat' | 'qq' | 'more'

export interface AuthUser {
  id: string
  phone?: string
  nickname?: string
  avatar?: string
  loginMethods?: string[]
  createdAt?: string
}

export interface SemanticDomain {
  id: number
  icon: string
  name: string
  explored: boolean
}

export interface LearningWord {
  id?: string
  word: string
  phonetic: string
  meaning: string
  path: string
  mastered: boolean
  meanings?: string[]
  meaningsByBook?: Record<string, string[]>
  usphone?: string
  ukphone?: string
  audioUrl?: string
  semanticDomainId?: string
  bookIds?: string[]
  activeBookId?: string
}

export interface VocabularyWord {
  id: string
  word: string
  /** 跨词书统计出的常用义 */
  meanings: string[]
  /** 各词书侧重点释义 */
  meaningsByBook?: Record<string, string[]>
  usphone: string
  ukphone: string
  bookIds: string[]
  semanticDomainId: string
  semanticPath: string
  semanticConfidence: number
  reviewRequired: boolean
  audioUrl?: string
  activeBookId?: string
}

export interface WordBook {
  id: string
  title: string
  shortTitle: string
  level: string
  accent: string
  description: string
  wordCount: number
  previewCount?: number
}

export interface BookProgress {
  learned: number
  mastered: number
  currentIndex: number
}

export interface DictionaryResult {
  word: string
  phonetic: string
  meanings: string[]
  meaningsByBook?: Record<string, string[]>
  activeBookId?: string
  audioUrl?: string
  audioUrlUk?: string
  audioFallbackUrl?: string
  audioFallbackUrlUk?: string
  source: 'local' | 'youdao'
}

export interface OcrCandidate {
  id: string
  word: string
  normalized: string
  confidence: number
  lineText: string
  lineIndex: number
  box?: number[][] | null
  known: boolean
  meanings: string[]
  usphone: string
  ukphone: string
  semanticDomainId: string
  semanticPath: string
  reviewRequired: boolean
}

export interface OcrResult {
  engine: string
  elapsedMs: number
  lineCount: number
  candidates: OcrCandidate[]
}

export type ScanAddTarget = 'today' | 'notebook'

/** 一次拍词识别记录 */
export interface ScanHistoryRecord {
  id: string
  createdAt: number
  candidateCount: number
  words: string[]
  meanings: Record<string, string>
  addedWords: string[]
  target?: ScanAddTarget | null
}

