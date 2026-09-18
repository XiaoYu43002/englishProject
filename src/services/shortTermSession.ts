import {
  afterCardShown,
  applySessionRating,
  createSessionSnapshot,
  getNextCard,
  localLearningDate,
  longTermSeedAfterGraduate,
} from '@/services/shortTermScheduler'
import { appendLearningEvent, createEventId } from '@/services/learningEventRepository'
import type { LearningRating } from '@/types/shortTermLearning'
import type { ShortTermLearningEvent, ShortTermSessionSnapshot } from '@/types/shortTermLearning'
import { ALGORITHM_VERSION } from '@/types/shortTermLearning'
import type { VocabularyWord } from '@/types/domain'
import { normalizeWordKey } from '@/utils/ocrFilters'

const SESSION_KEY = 'zhimi-short-term-session'
const GRADUATED_KEY = 'zhimi-short-term-graduated'

export type RecallUiRating = 'know' | 'fuzzy' | 'forgot'

const ratingMap: Record<RecallUiRating, LearningRating> = {
  know: 'KNOW',
  fuzzy: 'FUZZY',
  forgot: 'FORGET',
}

export function loadShortTermSession(): ShortTermSessionSnapshot | null {
  try {
    const raw = uni.getStorageSync(SESSION_KEY) as ShortTermSessionSnapshot | ''
    if (!raw || !raw.learningDate || !Array.isArray(raw.cards)) return null
    return raw
  } catch {
    return null
  }
}

export function saveShortTermSession(session: ShortTermSessionSnapshot | null) {
  if (!session) {
    uni.removeStorageSync(SESSION_KEY)
    return
  }
  uni.setStorageSync(SESSION_KEY, session)
}

export function loadGraduatedToday(date: string): string[] {
  try {
    const raw = (uni.getStorageSync(GRADUATED_KEY) || {}) as Record<string, string[]>
    return Array.isArray(raw[date]) ? raw[date] : []
  } catch {
    return []
  }
}

export function saveGraduatedToday(date: string, wordIds: string[]) {
  const raw = (uni.getStorageSync(GRADUATED_KEY) || {}) as Record<string, string[]>
  raw[date] = Array.from(new Set(wordIds))
  // 只保留近 14 天
  const keys = Object.keys(raw).sort()
  if (keys.length > 14) {
    keys.slice(0, keys.length - 14).forEach((k) => {
      delete raw[k]
    })
  }
  uni.setStorageSync(GRADUATED_KEY, raw)
}

export function pickNewWordIds(input: {
  words: VocabularyWord[]
  koWords: string[]
  graduatedToday: string[]
  dailyTarget: number
}): string[] {
  const ko = new Set(input.koWords.map(normalizeWordKey))
  const done = new Set(input.graduatedToday.map(normalizeWordKey))
  const ids: string[] = []
  for (const word of input.words) {
    const key = normalizeWordKey(word.word || word.id)
    if (!key || ko.has(key) || done.has(key)) continue
    ids.push(key)
    if (ids.length >= input.dailyTarget) break
  }
  return ids
}

export function resolveVocabulary(
  words: VocabularyWord[],
  wordId: string,
): VocabularyWord | undefined {
  const key = normalizeWordKey(wordId)
  return words.find((w) => normalizeWordKey(w.word || w.id) === key)
}

export interface RateCardContext {
  userId: string
  shownAt: number
  answerRevealedAt?: number
  audioPlayed?: boolean
  hintUsed?: boolean
  now?: number
}

export function rateShortTermCard(
  session: ShortTermSessionSnapshot,
  wordId: string,
  uiRating: RecallUiRating,
  ctx: RateCardContext,
): {
  session: ShortTermSessionSnapshot
  event: ShortTermLearningEvent
  graduated: boolean
  longTermSeed?: ReturnType<typeof longTermSeedAfterGraduate>
  nextWordId: string | null
} {
  const now = ctx.now ?? Date.now()
  const rating = ratingMap[uiRating]
  const beforeCard = session.cards.find((c) => c.wordId === wordId)
  if (!beforeCard) {
    throw new Error(`card not found: ${wordId}`)
  }
  const lastShownAt = beforeCard.lastShownAt ?? ctx.shownAt
  const lastRatedAt = beforeCard.lastRatedAt
  const lastSeenSequence = beforeCard.lastSeenSequence

  const secondsSinceLastSeen =
    lastRatedAt === undefined ? -1 : Math.max(0, Math.round((now - lastRatedAt) / 1000))
  const cardsSinceLastSeen =
    lastSeenSequence === undefined
      ? -1
      : Math.max(0, session.sequence - lastSeenSequence)

  const { snapshot, cardBefore, cardAfter } = applySessionRating(
    session,
    wordId,
    rating,
    now,
  )

  const enteredHard =
    cardAfter.state === 'HARD' && cardBefore.state !== 'HARD'

  const event: ShortTermLearningEvent = {
    eventId: createEventId(now),
    userId: ctx.userId || 'anonymous',
    wordId,
    learningDate: snapshot.learningDate,
    bookId: snapshot.bookId,
    rating,
    stateBefore: cardBefore.state,
    stateAfter: cardAfter.state,
    shownAt: lastShownAt || ctx.shownAt,
    answerRevealedAt: ctx.answerRevealedAt,
    ratedAt: now,
    recallTimeMs:
      ctx.answerRevealedAt !== undefined
        ? Math.max(0, now - ctx.answerRevealedAt)
        : undefined,
    secondsSinceLastSeen,
    cardsSinceLastSeen,
    sequence: snapshot.sequence,
    exposureCountToday: cardAfter.exposureCountToday,
    forgetCountToday: cardAfter.forgetCountToday,
    downgradeCountToday: cardAfter.downgradeCountToday,
    enteredHard,
    graduatedAt: cardAfter.graduatedAt,
    audioPlayed: Boolean(ctx.audioPlayed),
    hintUsed: Boolean(ctx.hintUsed),
    algorithmVersion: ALGORITHM_VERSION,
  }

  appendLearningEvent(event)

  let nextSession = snapshot
  if (cardAfter.state === 'GRADUATED') {
    const graduated = [
      ...loadGraduatedToday(snapshot.learningDate),
      wordId,
    ]
    saveGraduatedToday(snapshot.learningDate, graduated)
  }

  const pick = getNextCard(nextSession.cards, now, nextSession.sequence, {
    consecutiveNewCount: nextSession.consecutiveNewCount,
    newWordsPaused: nextSession.newWordsPaused,
    introducedLimit: nextSession.introducedLimit,
    lastWordId: wordId,
  })

  if (pick.introducedLimit && pick.introducedLimit > nextSession.introducedLimit) {
    nextSession = {
      ...nextSession,
      introducedLimit: pick.introducedLimit,
    }
  }

  return {
    session: nextSession,
    event,
    graduated: cardAfter.state === 'GRADUATED',
    longTermSeed:
      cardAfter.state === 'GRADUATED'
        ? longTermSeedAfterGraduate(cardAfter)
        : undefined,
    nextWordId: pick.card?.wordId ?? null,
  }
}

export function markCardShown(
  session: ShortTermSessionSnapshot,
  wordId: string,
  shownAt = Date.now(),
): ShortTermSessionSnapshot {
  return afterCardShown(session, wordId, shownAt)
}

export function startOrResumeSession(input: {
  bookId: string
  words: VocabularyWord[]
  koWords: string[]
  dailyTarget: number
  now?: number
}): ShortTermSessionSnapshot {
  const now = input.now ?? Date.now()
  const date = localLearningDate(now)
  const existing = loadShortTermSession()
  if (
    existing
    && existing.learningDate === date
    && existing.bookId === input.bookId
    && existing.cards.length
  ) {
    return existing
  }

  const graduatedToday = loadGraduatedToday(date)
  const wordIds = pickNewWordIds({
    words: input.words,
    koWords: input.koWords,
    graduatedToday,
    dailyTarget: input.dailyTarget,
  })

  const session = createSessionSnapshot({
    learningDate: date,
    bookId: input.bookId,
    dailyTarget: input.dailyTarget,
    wordIds,
  })
  saveShortTermSession(session)
  return session
}

export function sessionStats(session: ShortTermSessionSnapshot | null) {
  if (!session) {
    return { total: 0, graduated: 0, remaining: 0, learning: 0, hard: 0 }
  }
  const graduated = session.cards.filter((c) => c.state === 'GRADUATED').length
  const learning = session.cards.filter(
    (c) => c.state === 'LEARNING_1' || c.state === 'LEARNING_2',
  ).length
  const hard = session.cards.filter((c) => c.state === 'HARD').length
  const remaining = session.cards.length - graduated
  return {
    total: session.cards.length,
    graduated,
    remaining,
    learning,
    hard,
  }
}
