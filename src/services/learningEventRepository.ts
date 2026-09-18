import type { ShortTermLearningEvent } from '@/types/shortTermLearning'

const STORAGE_KEY = 'zhimi-short-term-events'
const MAX_EVENTS = 5000

function readAll(): ShortTermLearningEvent[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const list = Array.isArray(raw) ? raw : []
    return list.filter((item) => item && item.eventId && item.wordId)
  } catch {
    return []
  }
}

function writeAll(events: ShortTermLearningEvent[]) {
  uni.setStorageSync(STORAGE_KEY, events.slice(0, MAX_EVENTS))
}

export function appendLearningEvent(event: ShortTermLearningEvent): void {
  const all = readAll()
  all.unshift(event)
  writeAll(all)
}

export function listLearningEvents(options?: {
  learningDate?: string
  userId?: string
  wordId?: string
  limit?: number
}): ShortTermLearningEvent[] {
  let list = readAll()
  if (options?.learningDate) {
    list = list.filter((e) => e.learningDate === options.learningDate)
  }
  if (options?.userId) {
    list = list.filter((e) => e.userId === options.userId)
  }
  if (options?.wordId) {
    list = list.filter((e) => e.wordId === options.wordId)
  }
  const limit = options?.limit ?? list.length
  return list.slice(0, limit)
}

export function clearLearningEvents(): void {
  uni.removeStorageSync(STORAGE_KEY)
}

export function createEventId(now = Date.now()): string {
  return `ste-${now}-${Math.random().toString(36).slice(2, 10)}`
}
