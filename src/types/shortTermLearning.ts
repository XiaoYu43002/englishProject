/** 短时学习调度器 V1（当天新词） */

export type ShortTermState =
  | 'NEW'
  | 'LEARNING_1'
  | 'LEARNING_2'
  | 'HARD'
  | 'GRADUATED'

export type LearningRating = 'KNOW' | 'FUZZY' | 'FORGET'

export interface IntervalRule {
  minCards: number
  minSeconds: number
  maxSeconds: number
}

export interface ShortTermWord {
  wordId: string
  bookId: string
  state: ShortTermState
  intervalRule?: IntervalRule
  lastRatedAt?: number
  lastSeenSequence?: number
  lastShownAt?: number
  exposureCountToday: number
  forgetCountToday: number
  /** L2 → L1 退回次数 */
  downgradeCountToday: number
  hintUsed: boolean
  nextDueAt?: number
  hardDueAt?: number
  firstRating?: LearningRating
  enteredHardToday: boolean
  graduatedAt?: number
}

/**
 * 用户行为日志（原始事件，不只存最终状态）
 * 字段覆盖产品要求 + 调度文档 §10
 */
export interface ShortTermLearningEvent {
  eventId: string
  userId: string
  wordId: string
  /** YYYY-MM-DD（本地日） */
  learningDate: string
  bookId: string
  rating: LearningRating
  stateBefore: ShortTermState
  stateAfter: ShortTermState
  /** 本次出现时间 */
  shownAt: number
  answerRevealedAt?: number
  ratedAt: number
  recallTimeMs?: number
  /** 距离上次出现的秒数；首次为 -1 */
  secondsSinceLastSeen: number
  /** 中间间隔了多少张卡；首次为 -1 */
  cardsSinceLastSeen: number
  sequence: number
  exposureCountToday: number
  forgetCountToday: number
  downgradeCountToday: number
  enteredHard: boolean
  /** 若本次毕业则写入毕业时间 */
  graduatedAt?: number
  audioPlayed: boolean
  hintUsed: boolean
  algorithmVersion: 'short-term-v1'
}

export interface ShortTermSessionSnapshot {
  learningDate: string
  bookId: string
  dailyTarget: number
  sequence: number
  consecutiveNewCount: number
  newWordsPaused: boolean
  introducedLimit: number
  lastWordId: string | null
  cards: ShortTermWord[]
  /** 待引入的词 id（分批） */
  pendingWordIds: string[]
}

export const ALGORITHM_VERSION = 'short-term-v1' as const

export const BATCH_SIZE = 10
export const PAUSE_NEW_AT = 15
export const RESUME_NEW_AT = 10
export const MAX_CONSECUTIVE_NEW = 5
export const HARD_COOLDOWN_MS = 30 * 60 * 1000
/** 卡数已够时的防连点底线（秒）；连续学习不靠「干等」拉开间隔 */
export const ANTI_TAP_SECONDS = 2
