import type {
  IntervalRule,
  LearningRating,
  ShortTermSessionSnapshot,
  ShortTermState,
  ShortTermWord,
} from '../types/shortTermLearning'
import {
  ANTI_TAP_SECONDS,
  BATCH_SIZE,
  HARD_COOLDOWN_MS,
  MAX_CONSECUTIVE_NEW,
  PAUSE_NEW_AT,
  RESUME_NEW_AT,
} from '../types/shortTermLearning'

/** 与 docs §4 一致 */
export const INTERVAL_RULES = {
  NEW_FORGET: { minCards: 2, minSeconds: 30, maxSeconds: 60 },
  NEW_FUZZY: { minCards: 4, minSeconds: 45, maxSeconds: 120 },
  L1_KNOW: { minCards: 5, minSeconds: 60, maxSeconds: 360 },
  L1_FUZZY: { minCards: 3, minSeconds: 120, maxSeconds: 180 },
  L1_FORGET: { minCards: 2, minSeconds: 30, maxSeconds: 90 },
  L2_FUZZY: { minCards: 5, minSeconds: 120, maxSeconds: 300 },
  L2_FORGET: { minCards: 2, minSeconds: 45, maxSeconds: 120 },
} satisfies Record<string, IntervalRule>

export function createEmptyCard(wordId: string, bookId: string): ShortTermWord {
  return {
    wordId,
    bookId,
    state: 'NEW',
    exposureCountToday: 0,
    forgetCountToday: 0,
    downgradeCountToday: 0,
    hintUsed: false,
    enteredHardToday: false,
  }
}

export function localLearningDate(now = Date.now()): string {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function schedule(
  card: ShortTermWord,
  state: ShortTermState,
  rule: IntervalRule,
  now: number,
): ShortTermWord {
  return {
    ...card,
    state,
    intervalRule: rule,
    nextDueAt: now + rule.minSeconds * 1000,
  }
}

export function graduate(card: ShortTermWord, now: number): ShortTermWord {
  return {
    ...card,
    state: 'GRADUATED',
    intervalRule: undefined,
    nextDueAt: undefined,
    hardDueAt: undefined,
    graduatedAt: now,
  }
}

export function shouldEnterHard(card: ShortTermWord): boolean {
  return (
    card.forgetCountToday >= 3
    || card.exposureCountToday >= 5
    || card.downgradeCountToday >= 2
  )
}

export function enterHardState(card: ShortTermWord, now: number): ShortTermWord {
  return {
    ...card,
    state: 'HARD',
    intervalRule: undefined,
    nextDueAt: undefined,
    hardDueAt: now + HARD_COOLDOWN_MS,
    enteredHardToday: true,
  }
}

export function applyRating(
  card: ShortTermWord,
  rating: LearningRating,
  now: number,
  currentSequence: number,
): ShortTermWord {
  const updated: ShortTermWord = {
    ...card,
    exposureCountToday: card.exposureCountToday + 1,
    forgetCountToday: card.forgetCountToday + (rating === 'FORGET' ? 1 : 0),
    lastRatedAt: now,
    lastSeenSequence: currentSequence,
    firstRating: card.firstRating ?? (card.state === 'NEW' ? rating : undefined),
  }

  let next: ShortTermWord

  switch (card.state) {
    case 'NEW':
      if (rating === 'KNOW') return graduate(updated, now)
      next = rating === 'FUZZY'
        ? schedule(updated, 'LEARNING_2', INTERVAL_RULES.NEW_FUZZY, now)
        : schedule(updated, 'LEARNING_1', INTERVAL_RULES.NEW_FORGET, now)
      break

    case 'LEARNING_1':
      if (rating === 'KNOW') {
        next = schedule(updated, 'LEARNING_2', INTERVAL_RULES.L1_KNOW, now)
      } else if (rating === 'FUZZY') {
        next = schedule(updated, 'LEARNING_1', INTERVAL_RULES.L1_FUZZY, now)
      } else {
        next = schedule(updated, 'LEARNING_1', INTERVAL_RULES.L1_FORGET, now)
      }
      break

    case 'LEARNING_2':
      if (rating === 'KNOW') return graduate(updated, now)
      if (rating === 'FUZZY') {
        next = schedule(updated, 'LEARNING_2', INTERVAL_RULES.L2_FUZZY, now)
      } else {
        updated.downgradeCountToday += 1
        next = schedule(updated, 'LEARNING_1', INTERVAL_RULES.L2_FORGET, now)
      }
      break

    case 'HARD':
      if (rating === 'KNOW') {
        next = schedule(updated, 'LEARNING_2', INTERVAL_RULES.L1_KNOW, now)
      } else if (rating === 'FUZZY') {
        next = enterHardState(updated, now)
      } else {
        next = enterHardState(updated, now)
      }
      break

    case 'GRADUATED':
      return updated

    default:
      return updated
  }

  if (next.state !== 'GRADUATED' && shouldEnterHard(next)) {
    return enterHardState(next, now)
  }
  return next
}

export function isEligible(
  card: ShortTermWord,
  now: number,
  currentSequence: number,
): boolean {
  if (card.state === 'GRADUATED') return false
  if (card.state === 'NEW') return true

  if (card.state === 'HARD') {
    return card.hardDueAt !== undefined && now >= card.hardDueAt
  }

  if (
    !card.intervalRule
    || card.lastRatedAt === undefined
    || card.lastSeenSequence === undefined
  ) {
    return false
  }

  const elapsedSeconds = (now - card.lastRatedAt) / 1000
  const cardsSinceLastSeen = currentSequence - card.lastSeenSequence

  // 连续学习：间隔主要靠「隔开其他卡」；时间只防连点，或最长等待兜底
  return (
    (cardsSinceLastSeen >= card.intervalRule.minCards
      && elapsedSeconds >= ANTI_TAP_SECONDS)
    || elapsedSeconds >= card.intervalRule.maxSeconds
  )
}

export function isMaxWaitForced(
  card: ShortTermWord,
  now: number,
): boolean {
  if (!card.intervalRule || card.lastRatedAt === undefined) return false
  if (card.state === 'NEW' || card.state === 'GRADUATED' || card.state === 'HARD') return false
  return now - card.lastRatedAt >= card.intervalRule.maxSeconds * 1000
}

export function countActiveLearning(cards: ShortTermWord[]): number {
  return cards.filter(
    (card) => card.state === 'LEARNING_1' || card.state === 'LEARNING_2',
  ).length
}

export function updateNewWordsPaused(
  paused: boolean,
  activeCount: number,
): boolean {
  if (activeCount >= PAUSE_NEW_AT) return true
  if (activeCount <= RESUME_NEW_AT) return false
  return paused
}

export interface PickNextOptions {
  consecutiveNewCount: number
  newWordsPaused: boolean
  introducedLimit: number
  lastWordId: string | null
}

export interface PickNextResult {
  card: ShortTermWord | null
  reason:
    | 'forced-max-wait'
    | 'learning-1'
    | 'learning-2'
    | 'hard-due'
    | 'new'
    | 'new-keep-flow'
    | 'none'
  /** 选卡后建议抬高的 introducedLimit（keep-flow 扩批） */
  introducedLimit?: number
}

export function getNextCard(
  cards: ShortTermWord[],
  now: number,
  currentSequence: number,
  options: PickNextOptions,
): PickNextResult {
  const eligible = cards.filter((card) => isEligible(card, now, currentSequence))

  const notSameAsLast = (list: ShortTermWord[]) => {
    if (!options.lastWordId) return list
    const filtered = list.filter((c) => c.wordId !== options.lastWordId)
    return filtered.length ? filtered : list
  }

  const forced = notSameAsLast(
    eligible
      .filter((card) => isMaxWaitForced(card, now))
      .sort((a, b) => (a.lastRatedAt ?? 0) - (b.lastRatedAt ?? 0)),
  )
  if (forced[0]) return { card: forced[0], reason: 'forced-max-wait' }

  const learning1 = notSameAsLast(
    eligible
      .filter((card) => card.state === 'LEARNING_1')
      .sort((a, b) => (a.nextDueAt ?? 0) - (b.nextDueAt ?? 0)),
  )
  if (learning1[0]) return { card: learning1[0], reason: 'learning-1' }

  const learning2 = notSameAsLast(
    eligible
      .filter((card) => card.state === 'LEARNING_2')
      .sort((a, b) => (a.nextDueAt ?? 0) - (b.nextDueAt ?? 0)),
  )
  if (learning2[0]) return { card: learning2[0], reason: 'learning-2' }

  const hardDue = notSameAsLast(
    eligible
      .filter((card) => card.state === 'HARD')
      .sort((a, b) => (a.hardDueAt ?? 0) - (b.hardDueAt ?? 0)),
  )
  if (hardDue[0]) return { card: hardDue[0], reason: 'hard-due' }

  const activeCount = countActiveLearning(cards)
  const paused = updateNewWordsPaused(options.newWordsPaused, activeCount)
  const canAddNewPolitely =
    !paused
    && activeCount < PAUSE_NEW_AT
    && (options.consecutiveNewCount < MAX_CONSECUTIVE_NEW || activeCount === 0)

  if (canAddNewPolitely) {
    const openedNew = pickOpenedNewCards(cards, options.introducedLimit)
    const pick = notSameAsLast(openedNew)[0] ?? null
    if (pick) return { card: pick, reason: 'new' }
  }

  // 保底：只要今日目标里还有 NEW，就继续学，绝不因冷却弹等待打断 50 词连续学习
  const anyNew = notSameAsLast(cards.filter((c) => c.state === 'NEW'))
  if (anyNew[0]) {
    const index = cards.findIndex((c) => c.wordId === anyNew[0].wordId)
    const nextLimit = Math.max(options.introducedLimit, index + 1)
    return {
      card: anyNew[0],
      reason: 'new-keep-flow',
      introducedLimit: nextLimit,
    }
  }

  return { card: null, reason: 'none' }
}

/** 下一张最早可学的时间（用于「暂无到期」倒计时） */
export function getEarliestDueInfo(
  cards: ShortTermWord[],
  now: number,
  currentSequence: number,
): { wordId: string; dueAt: number; waitSeconds: number; state: ShortTermState } | null {
  let best: { wordId: string; dueAt: number; state: ShortTermState } | null = null

  for (const card of cards) {
    if (card.state === 'GRADUATED' || card.state === 'NEW') continue

    let dueAt: number | undefined
    if (card.state === 'HARD') {
      dueAt = card.hardDueAt
    } else if (card.intervalRule && card.lastRatedAt !== undefined) {
      const byMaxWait = card.lastRatedAt + card.intervalRule.maxSeconds * 1000
      const cardsGap = currentSequence - (card.lastSeenSequence ?? currentSequence)
      // 卡数已够：只需防连点；卡数不够：等最长等待兜底
      dueAt = cardsGap >= card.intervalRule.minCards
        ? card.lastRatedAt + ANTI_TAP_SECONDS * 1000
        : byMaxWait
    }
    if (dueAt === undefined) continue
    if (!best || dueAt < best.dueAt) {
      best = { wordId: card.wordId, dueAt, state: card.state }
    }
  }

  if (!best) return null
  return {
    ...best,
    waitSeconds: Math.max(0, Math.ceil((best.dueAt - now) / 1000)),
  }
}

function countNonNewProgress(cards: ShortTermWord[]): number {
  return cards.filter((c) => c.state !== 'NEW').length
}

/** 已开放批次内的 NEW 卡：按数组顺序，最多开放 introducedLimit 个「非 pending」名额 */
export function pickOpenedNewCards(
  cards: ShortTermWord[],
  introducedLimit: number,
): ShortTermWord[] {
  const openIds = new Set(
    cards.slice(0, introducedLimit).map((c) => c.wordId),
  )
  return cards.filter((c) => c.state === 'NEW' && openIds.has(c.wordId))
}

export function buildSessionCards(
  wordIds: string[],
  bookId: string,
): ShortTermWord[] {
  return wordIds.map((id) => createEmptyCard(id, bookId))
}

export function createSessionSnapshot(input: {
  learningDate: string
  bookId: string
  dailyTarget: number
  wordIds: string[]
}): ShortTermSessionSnapshot {
  const cards = buildSessionCards(input.wordIds, input.bookId)
  return {
    learningDate: input.learningDate,
    bookId: input.bookId,
    dailyTarget: input.dailyTarget,
    sequence: 0,
    consecutiveNewCount: 0,
    newWordsPaused: false,
    introducedLimit: Math.min(BATCH_SIZE, cards.length),
    lastWordId: null,
    cards,
    pendingWordIds: [],
  }
}

export function afterCardShown(
  snapshot: ShortTermSessionSnapshot,
  wordId: string,
  shownAt: number,
): ShortTermSessionSnapshot {
  return {
    ...snapshot,
    cards: snapshot.cards.map((card) =>
      card.wordId === wordId ? { ...card, lastShownAt: shownAt } : card,
    ),
    lastWordId: wordId,
  }
}

export function applySessionRating(
  snapshot: ShortTermSessionSnapshot,
  wordId: string,
  rating: LearningRating,
  now: number,
): { snapshot: ShortTermSessionSnapshot; cardBefore: ShortTermWord; cardAfter: ShortTermWord } {
  const index = snapshot.cards.findIndex((c) => c.wordId === wordId)
  if (index < 0) {
    throw new Error(`card not found: ${wordId}`)
  }
  const cardBefore = snapshot.cards[index]
  const sequence = snapshot.sequence + 1
  const cardAfter = applyRating(cardBefore, rating, now, sequence)
  const cards = snapshot.cards.slice()
  cards[index] = cardAfter

  const wasNew = cardBefore.state === 'NEW'
  const consecutiveNewCount = wasNew
    ? snapshot.consecutiveNewCount + 1
    : 0

  const activeCount = countActiveLearning(cards)
  let newWordsPaused = updateNewWordsPaused(snapshot.newWordsPaused, activeCount)
  let introducedLimit = snapshot.introducedLimit

  // 批次推进：在学词回落后可开放下一批
  if (!newWordsPaused && introducedLimit < cards.length) {
    const graduatedOrPast = cards.filter((c) => c.state === 'GRADUATED').length
    const nextBatchFloor = Math.floor(graduatedOrPast / BATCH_SIZE) * BATCH_SIZE + BATCH_SIZE
    introducedLimit = Math.min(cards.length, Math.max(introducedLimit, nextBatchFloor))
    // 同时：当 active 降到 RESUME 且还有 NEW，至少保持 BATCH 窗口
    if (activeCount <= RESUME_NEW_AT) {
      introducedLimit = Math.min(
        cards.length,
        Math.max(introducedLimit, countNonNewProgress(cards) + BATCH_SIZE),
      )
    }
  }

  return {
    cardBefore,
    cardAfter,
    snapshot: {
      ...snapshot,
      cards,
      sequence,
      consecutiveNewCount,
      newWordsPaused,
      introducedLimit,
      lastWordId: wordId,
    },
  }
}

/** 临时跨天复习种子（SSP-MMC 接入前） */
export function longTermSeedAfterGraduate(card: ShortTermWord): {
  firstReviewInDays: number
  difficulty: 'easy' | 'medium' | 'hard' | 'very-hard'
} {
  if (card.enteredHardToday) return { firstReviewInDays: 1, difficulty: 'very-hard' }
  if (card.firstRating === 'FORGET') return { firstReviewInDays: 1, difficulty: 'hard' }
  if (card.firstRating === 'FUZZY') return { firstReviewInDays: 2, difficulty: 'medium' }
  return { firstReviewInDays: 3, difficulty: 'easy' }
}

export { PAUSE_NEW_AT, RESUME_NEW_AT, BATCH_SIZE, MAX_CONSECUTIVE_NEW, HARD_COOLDOWN_MS, ANTI_TAP_SECONDS }
