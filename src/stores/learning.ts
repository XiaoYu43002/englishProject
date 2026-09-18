import { defineStore } from 'pinia'
import { fetchBookWords, getLocalWords, localBooks } from '@/services/catalog'
import { createSessionSnapshot, getEarliestDueInfo, getNextCard, localLearningDate } from '@/services/shortTermScheduler'
import {
  loadShortTermSession,
  markCardShown,
  rateShortTermCard,
  resolveVocabulary,
  saveShortTermSession,
  sessionStats,
  startOrResumeSession,
  type RecallUiRating,
} from '@/services/shortTermSession'
import type { AuthUser, BookProgress, LearningWord, LoginMethod, OcrCandidate, ScanAddTarget, ScanHistoryRecord, SemanticDomain, VocabularyWord, WordBook } from '@/types/domain'
import type { ShortTermSessionSnapshot } from '@/types/shortTermLearning'
import { meaningsForBook } from '@/utils/meanings'
import { isOcrStopword, normalizeWordKey } from '@/utils/ocrFilters'

interface LearningState {
  loginMethod: LoginMethod | null
  authToken: string
  authUser: AuthUser | null
  todayTarget: number
  remaining: number
  reviewCount: number
  masteredCount: number
  streakDays: number
  selectedWords: string[]
  scanCandidates: OcrCandidate[]
  /** 当前这次拍词会话 id，加入生词时回写 */
  currentScanRecordId: string
  scanHistory: ScanHistoryRecord[]
  personalWords: VocabularyWord[]
  /** 用户标记为「熟」的词：学习计划与拍词结果中排除 */
  koWords: string[]
  domains: SemanticDomain[]
  books: WordBook[]
  selectedBookId: string
  bookWords: Record<string, VocabularyWord[]>
  bookTotals: Record<string, number>
  bookProgress: Record<string, BookProgress>
  currentWord: LearningWord
  loadingBook: boolean
  /** 当天短时学习会话（FSM） */
  shortTermSession: ShortTermSessionSnapshot | null
  /** 当前词展示时间（埋点） */
  currentShownAt: number
  currentAudioPlayed: boolean
  /** 短时队列暂无到期词时的等待提示 */
  sessionWaiting: boolean
  nextDueInSeconds: number
}

const domains: SemanticDomain[] = [
  { id: 1, icon: '◉', name: '认知与思维', explored: true },
  { id: 2, icon: '◌', name: '表达与观点', explored: true },
  { id: 3, icon: '⌁', name: '因果与关系', explored: true },
  { id: 4, icon: '↗', name: '变化与发展', explored: true },
  { id: 5, icon: '◇', name: '控制与影响', explored: false },
  { id: 6, icon: '◎', name: '行动与选择', explored: false },
  { id: 7, icon: '△', name: '判断与评价', explored: false },
  { id: 8, icon: '□', name: '状态与存在', explored: false },
  { id: 9, icon: '◫', name: '社会与个体', explored: false },
  { id: 10, icon: '◈', name: '经济与资源', explored: false },
  { id: 11, icon: '◷', name: '时间与过程', explored: false },
  { id: 12, icon: '∞', name: '程度·范围·数量', explored: false },
]

const customBook: WordBook = {
  id: 'custom',
  title: '我的生词',
  shortTitle: '生词本',
  level: '个人词书',
  accent: '#6f806f',
  description: '由拍照识词和手动收藏积累的个人词汇。',
  wordCount: 0,
}
const storedPersonalWords = (uni.getStorageSync('zhimi-personal-words') || []) as VocabularyWord[]
customBook.wordCount = storedPersonalWords.length
const allBooks = [...localBooks, customBook]
const initialProgress = Object.fromEntries(allBooks.map((book) => [book.id, { learned: 0, mastered: 0, currentIndex: 0 }]))
const storedProgress = uni.getStorageSync('zhimi-book-progress') as Record<string, BookProgress> | ''
const storedBookId = String(uni.getStorageSync('zhimi-selected-book') || 'cet4')
const storedBookWords = storedBookId === 'custom' ? storedPersonalWords : getLocalWords(storedBookId)
const firstWord = storedBookWords[0] || getLocalWords('cet4')[0]
const storedAuthToken = String(uni.getStorageSync('zhimi-auth-token') || '')
const storedAuthUser = (uni.getStorageSync('zhimi-auth-user') || null) as AuthUser | null
const storedLoginMethod = (uni.getStorageSync('zhimi-login-method') || null) as LoginMethod | null
const storedKoWords = ((uni.getStorageSync('zhimi-ko-words') || []) as string[])
  .map((item) => normalizeWordKey(item))
  .filter(Boolean)
const storedScanHistory = ((uni.getStorageSync('zhimi-scan-history') || []) as ScanHistoryRecord[])
  .filter((item) => item && item.id && Array.isArray(item.words))
  .slice(0, 100)
const storedShortTermSession = loadShortTermSession()
const storedTodayTargetRaw = Number(uni.getStorageSync('zhimi-today-target') || 0)
const initialTodayTarget =
  (storedTodayTargetRaw > 0 ? storedTodayTargetRaw : 0)
  || storedShortTermSession?.dailyTarget
  || 20
const initialRemaining = storedShortTermSession
  ? sessionStats(storedShortTermSession).remaining
  : initialTodayTarget

function toLearningWord(word: VocabularyWord, bookId?: string): LearningWord {
  const activeBookId = bookId || word.activeBookId || word.bookIds?.[0] || ''
  const meanings = meaningsForBook(word, activeBookId)
  return {
    id: word.id,
    word: word.word,
    phonetic: word.usphone
      ? `/${word.usphone}/`
      : word.ukphone
        ? `/${word.ukphone}/`
        : word.phonetic
          ? `/${String(word.phonetic).replace(/^\/|\/$/g, '')}/`
          : '',
    meaning: meanings.join('；'),
    meanings,
    meaningsByBook: word.meaningsByBook,
    usphone: word.usphone,
    ukphone: word.ukphone,
    path: word.semanticPath,
    semanticDomainId: word.semanticDomainId,
    bookIds: word.bookIds,
    activeBookId,
    mastered: false,
  }
}

export const useLearningStore = defineStore('learning', {
  state: (): LearningState => ({
    loginMethod: storedLoginMethod,
    authToken: storedAuthToken,
    authUser: storedAuthUser,
    todayTarget: initialTodayTarget,
    remaining: initialRemaining,
    reviewCount: 12,
    masteredCount: 326,
    streakDays: 18,
    selectedWords: [],
    scanCandidates: [],
    currentScanRecordId: '',
    scanHistory: storedScanHistory,
    personalWords: storedPersonalWords,
    koWords: storedKoWords,
    domains,
    books: allBooks,
    selectedBookId: allBooks.some((book) => book.id === storedBookId) ? storedBookId : 'cet4',
    bookWords: { [storedBookId]: storedBookWords, custom: storedPersonalWords },
    bookTotals: Object.fromEntries(allBooks.map((book) => [book.id, book.wordCount])),
    bookProgress: { ...initialProgress, ...(storedProgress || {}) },
    currentWord: toLearningWord(firstWord, storedBookId === 'custom' ? 'custom' : storedBookId),
    loadingBook: false,
    shortTermSession: storedShortTermSession,
    currentShownAt: 0,
    currentAudioPlayed: false,
    sessionWaiting: false,
    nextDueInSeconds: 0,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.authToken),
    exploredCount: (state) => state.domains.filter((item) => item.explored).length,
    progress: (state) => {
      if (!state.todayTarget) return 0
      return Math.round(((state.todayTarget - state.remaining) / state.todayTarget) * 100)
    },
    activeBook: (state) => state.books.find((book) => book.id === state.selectedBookId) || state.books[0],
    activeWords: (state) => {
      const ko = new Set(state.koWords)
      return (state.bookWords[state.selectedBookId] || []).filter((item) => !ko.has(normalizeWordKey(item.word || item.id)))
    },
    activeBookProgress: (state) => state.bookProgress[state.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 },
    isCurrentWordKo: (state) => {
      const key = normalizeWordKey(state.currentWord.word || state.currentWord.id || '')
      return Boolean(key) && state.koWords.includes(key)
    },
    shortTermStats: (state) => sessionStats(state.shortTermSession),
  },
  actions: {
    persistKoWords() {
      uni.setStorageSync('zhimi-ko-words', this.koWords)
    },
    isKoWord(word: string) {
      return this.koWords.includes(normalizeWordKey(word))
    },
    filterScanCandidates(candidates: OcrCandidate[]) {
      return candidates.filter((item) => {
        const key = normalizeWordKey(item.normalized || item.word)
        if (!key) return false
        if (isOcrStopword(key)) return false
        if (this.koWords.includes(key)) return false
        return true
      })
    },
    learnableWords(bookId = this.selectedBookId) {
      const ko = new Set(this.koWords)
      return (this.bookWords[bookId] || []).filter((item) => !ko.has(normalizeWordKey(item.word || item.id)))
    },
    findNextLearnableIndex(fromIndex: number, bookId = this.selectedBookId) {
      const words = this.bookWords[bookId] || []
      if (!words.length) return -1
      const ko = new Set(this.koWords)
      for (let step = 1; step <= words.length; step += 1) {
        const index = (fromIndex + step) % words.length
        const key = normalizeWordKey(words[index].word || words[index].id)
        if (!ko.has(key)) return index
      }
      return -1
    },
    markCurrentWordAsKo() {
      const key = normalizeWordKey(this.currentWord.word || this.currentWord.id || '')
      if (!key) return { ok: false as const, reason: 'empty' as const }
      if (!this.koWords.includes(key)) {
        this.koWords = [...this.koWords, key]
        this.persistKoWords()
        this.masteredCount += 1
      }
      const progress = this.bookProgress[this.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 }
      progress.mastered += 1
      const nextIndex = this.findNextLearnableIndex(progress.currentIndex)
      if (nextIndex >= 0) {
        progress.currentIndex = nextIndex
        this.setCurrentWord((this.bookWords[this.selectedBookId] || [])[nextIndex])
      }
      this.bookProgress[this.selectedBookId] = progress
      this.persistProgress()
      if (this.scanCandidates.length) {
        this.scanCandidates = this.filterScanCandidates(this.scanCandidates)
        this.selectedWords = this.selectedWords.filter((word) =>
          this.scanCandidates.some((item) => item.normalized === word),
        )
      }
      return { ok: true as const, word: key }
    },
    login(method: LoginMethod, payload?: { token?: string; user?: AuthUser | null }) {
      this.loginMethod = method
      uni.setStorageSync('zhimi-login-method', method)
      if (payload?.token) {
        this.authToken = payload.token
        uni.setStorageSync('zhimi-auth-token', payload.token)
      }
      if (payload?.user) {
        this.authUser = payload.user
        uni.setStorageSync('zhimi-auth-user', payload.user)
      }
    },
    logout() {
      this.loginMethod = null
      this.authToken = ''
      this.authUser = null
      uni.removeStorageSync('zhimi-login-method')
      uni.removeStorageSync('zhimi-auth-token')
      uni.removeStorageSync('zhimi-auth-user')
    },
    toggleWord(word: string) {
      this.selectedWords = this.selectedWords.includes(word)
        ? this.selectedWords.filter((item) => item !== word)
        : [...this.selectedWords, word]
    },
    setScanCandidates(candidates: OcrCandidate[], options?: { record?: boolean }) {
      const filtered = this.filterScanCandidates(candidates)
      this.scanCandidates = filtered
      this.selectedWords = filtered.map((item) => item.normalized)
      if (!filtered.length) {
        this.currentScanRecordId = ''
        return
      }
      if (!options?.record) return
      const record: ScanHistoryRecord = {
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        candidateCount: filtered.length,
        words: filtered.map((item) => item.normalized),
        meanings: Object.fromEntries(
          filtered.map((item) => [item.normalized, item.meanings?.[0] || '']),
        ),
        addedWords: [],
        target: null,
      }
      this.currentScanRecordId = record.id
      this.scanHistory = [record, ...this.scanHistory].slice(0, 100)
      this.persistScanHistory()
    },
    persistScanHistory() {
      uni.setStorageSync('zhimi-scan-history', this.scanHistory)
    },
    clearScanHistory() {
      this.scanHistory = []
      this.currentScanRecordId = ''
      uni.removeStorageSync('zhimi-scan-history')
    },
    removeScanHistory(id: string) {
      this.scanHistory = this.scanHistory.filter((item) => item.id !== id)
      if (this.currentScanRecordId === id) this.currentScanRecordId = ''
      this.persistScanHistory()
    },
    selectAllScanWords() {
      this.selectedWords = this.scanCandidates.map((item) => item.normalized)
    },
    clearScanWords() {
      this.selectedWords = []
    },
    addScannedWords(target: ScanAddTarget) {
      const selected = this.scanCandidates.filter((item) => this.selectedWords.includes(item.normalized))
      const existing = new Set(this.personalWords.map((item) => item.id))
      const additions: VocabularyWord[] = selected
        .filter((item) => !existing.has(item.normalized))
        .filter((item) => !this.isKoWord(item.normalized))
        .map((item) => ({
          id: item.normalized,
          word: item.normalized,
          meanings: item.meanings.length ? item.meanings : ['释义待通过有道词典补充'],
          usphone: item.usphone,
          ukphone: item.ukphone,
          bookIds: ['custom'],
          semanticDomainId: item.semanticDomainId,
          semanticPath: item.semanticPath,
          semanticConfidence: item.known ? 0.8 : 0.2,
          reviewRequired: item.reviewRequired,
        }))
      this.personalWords = [...this.personalWords, ...additions]
      this.bookWords.custom = this.personalWords
      this.bookTotals.custom = this.personalWords.length
      const custom = this.books.find((book) => book.id === 'custom')
      if (custom) custom.wordCount = this.personalWords.length
      uni.setStorageSync('zhimi-personal-words', this.personalWords)

      if (this.currentScanRecordId) {
        this.scanHistory = this.scanHistory.map((item) => {
          if (item.id !== this.currentScanRecordId) return item
          const merged = Array.from(new Set([...item.addedWords, ...selected.map((row) => row.normalized)]))
          return { ...item, addedWords: merged, target }
        })
        this.persistScanHistory()
      }

      if (target === 'today' && selected.length) {
        this.selectedBookId = 'custom'
        uni.setStorageSync('zhimi-selected-book', 'custom')
        const selectedIds = selected.map((row) => row.normalized)
        const session = createSessionSnapshot({
          learningDate: localLearningDate(),
          bookId: 'custom',
          dailyTarget: selectedIds.length,
          wordIds: selectedIds,
        })
        this.shortTermSession = session
        this.todayTarget = selectedIds.length
        this.syncRemainingFromSession()
        saveShortTermSession(session)
        this.showNextShortTermCard()
      }
      return { selected: selected.length, added: additions.length }
    },
    async selectBook(bookId: string) {
      this.selectedBookId = bookId
      uni.setStorageSync('zhimi-selected-book', bookId)
      if (!this.bookWords[bookId]?.length) await this.loadBook(bookId)
      const progress = this.bookProgress[bookId] || { learned: 0, mastered: 0, currentIndex: 0 }
      const words = this.bookWords[bookId] || []
      if (!words.length) return
      const currentKey = normalizeWordKey(words[progress.currentIndex % words.length]?.word || '')
      if (this.koWords.includes(currentKey)) {
        const nextIndex = this.findNextLearnableIndex(progress.currentIndex - 1, bookId)
        if (nextIndex >= 0) {
          progress.currentIndex = nextIndex
          this.bookProgress[bookId] = progress
          this.setCurrentWord(words[nextIndex])
          this.persistProgress()
          return
        }
      }
      this.setCurrentWord(words[progress.currentIndex % words.length])
    },
    async loadBook(bookId: string) {
      if (bookId === 'custom') {
        this.bookWords.custom = this.personalWords
        this.bookTotals.custom = this.personalWords.length
        return
      }
      this.loadingBook = true
      const result = await fetchBookWords(bookId)
      this.bookWords[bookId] = result.items
      this.bookTotals[bookId] = result.total || this.books.find((book) => book.id === bookId)?.wordCount || result.items.length
      this.loadingBook = false
    },
    setCurrentWord(word: VocabularyWord) {
      this.currentWord = toLearningWord(word, this.selectedBookId)
      this.currentShownAt = Date.now()
      this.currentAudioPlayed = false
      if (this.shortTermSession) {
        const wordId = normalizeWordKey(word.word || word.id)
        this.shortTermSession = markCardShown(this.shortTermSession, wordId, this.currentShownAt)
        saveShortTermSession(this.shortTermSession)
      }
    },
    openWord(index: number) {
      const words = this.bookWords[this.selectedBookId] || []
      if (!words.length) return
      const progress = this.bookProgress[this.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 }
      progress.currentIndex = Math.max(0, Math.min(index, words.length - 1))
      this.bookProgress[this.selectedBookId] = progress
      this.setCurrentWord(words[progress.currentIndex])
      this.persistProgress()
    },
    noteAudioPlayed() {
      this.currentAudioPlayed = true
    },
    syncRemainingFromSession() {
      if (!this.shortTermSession) return
      const stats = sessionStats(this.shortTermSession)
      this.remaining = stats.remaining
    },
    persistTodayTarget() {
      uni.setStorageSync('zhimi-today-target', this.todayTarget)
    },
    async setLearningPlan(input: {
      bookId: string
      dailyTarget: number
      restartToday?: boolean
    }) {
      const dailyTarget = Math.min(200, Math.max(1, Math.round(Number(input.dailyTarget) || 20)))
      this.todayTarget = dailyTarget
      this.persistTodayTarget()

      if (input.bookId && input.bookId !== this.selectedBookId) {
        await this.selectBook(input.bookId)
      } else if (input.bookId === this.selectedBookId && !this.bookWords[input.bookId]?.length) {
        await this.loadBook(input.bookId)
      }

      const restart = input.restartToday !== false
      if (restart) {
        this.ensureShortTermSession({ dailyTarget, forceRestart: true })
      } else {
        this.remaining = dailyTarget
      }

      return {
        bookId: this.selectedBookId,
        dailyTarget: this.todayTarget,
        restarted: restart,
      }
    },
    ensureShortTermSession(options?: { dailyTarget?: number; forceRestart?: boolean }) {
      const dailyTarget = options?.dailyTarget ?? this.todayTarget ?? 20
      if (options?.forceRestart) {
        saveShortTermSession(null)
        this.shortTermSession = null
      }
      const words = this.learnableWords(this.selectedBookId)
      const session = startOrResumeSession({
        bookId: this.selectedBookId,
        words,
        koWords: this.koWords,
        dailyTarget,
      })
      this.shortTermSession = session
      this.syncRemainingFromSession()
      saveShortTermSession(session)
      return session
    },
    showNextShortTermCard(preferredWordId?: string | null) {
      if (!this.shortTermSession) return false
      const now = Date.now()
      const pick = preferredWordId
        ? { card: this.shortTermSession.cards.find((c) => c.wordId === preferredWordId) || null }
        : getNextCard(
          this.shortTermSession.cards,
          now,
          this.shortTermSession.sequence,
          {
            consecutiveNewCount: this.shortTermSession.consecutiveNewCount,
            newWordsPaused: this.shortTermSession.newWordsPaused,
            introducedLimit: this.shortTermSession.introducedLimit,
            lastWordId: this.shortTermSession.lastWordId,
          },
        )
      if (
        pick
        && 'introducedLimit' in pick
        && typeof pick.introducedLimit === 'number'
        && pick.introducedLimit > this.shortTermSession.introducedLimit
      ) {
        this.shortTermSession = {
          ...this.shortTermSession,
          introducedLimit: pick.introducedLimit,
        }
        saveShortTermSession(this.shortTermSession)
      }
      const nextId = pick.card?.wordId
      if (!nextId) {
        const due = getEarliestDueInfo(
          this.shortTermSession.cards,
          now,
          this.shortTermSession.sequence,
        )
        this.sessionWaiting = true
        this.nextDueInSeconds = due?.waitSeconds ?? 0
        return false
      }
      const vocab = resolveVocabulary(
        this.bookWords[this.shortTermSession.bookId] || this.learnableWords(this.selectedBookId),
        nextId,
      )
      if (!vocab) return false
      const words = this.bookWords[this.selectedBookId] || []
      const index = words.findIndex(
        (item) => normalizeWordKey(item.word || item.id) === nextId,
      )
      if (index >= 0) {
        const progress = this.bookProgress[this.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 }
        progress.currentIndex = index
        this.bookProgress[this.selectedBookId] = progress
        this.persistProgress()
      }
      this.sessionWaiting = false
      this.nextDueInSeconds = 0
      this.setCurrentWord(vocab)
      return true
    },
    /** 等待结束后再取下一张；返回是否已恢复 */
    tryResumeShortTermSession() {
      if (!this.shortTermSession) return false
      const shown = this.showNextShortTermCard()
      if (shown) return true
      const due = getEarliestDueInfo(
        this.shortTermSession.cards,
        Date.now(),
        this.shortTermSession.sequence,
      )
      this.sessionWaiting = true
      this.nextDueInSeconds = due?.waitSeconds ?? 0
      return false
    },
    startTodayLearning(dailyTarget?: number) {
      const session = this.ensureShortTermSession({
        dailyTarget: dailyTarget ?? this.todayTarget,
      })
      if (!session.cards.length) {
        this.sessionWaiting = false
        return { ok: false as const, reason: 'no-words' as const }
      }
      const shown = this.showNextShortTermCard()
      return shown
        ? { ok: true as const }
        : { ok: false as const, reason: 'waiting' as const, waitSeconds: this.nextDueInSeconds }
    },
    markCurrentWord(
      result: boolean | 'know' | 'fuzzy' | 'forgot' = true,
      meta?: { answerRevealedAt?: number; hintUsed?: boolean },
    ) {
      const uiRating: RecallUiRating = result === true || result === 'know'
        ? 'know'
        : result === 'fuzzy'
          ? 'fuzzy'
          : 'forgot'

      // 短时会话优先：当天新词 FSM
      if (this.shortTermSession?.cards?.length) {
        const wordId = normalizeWordKey(this.currentWord.word || this.currentWord.id || '')
        if (!wordId) return

        const rated = rateShortTermCard(this.shortTermSession, wordId, uiRating, {
          userId: this.authUser?.id || 'anonymous',
          shownAt: this.currentShownAt || Date.now(),
          answerRevealedAt: meta?.answerRevealedAt,
          audioPlayed: this.currentAudioPlayed,
          hintUsed: meta?.hintUsed,
        })

        this.shortTermSession = rated.session
        saveShortTermSession(rated.session)
        this.syncRemainingFromSession()

        const progress = this.bookProgress[this.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 }
        progress.learned = Math.min(
          this.bookTotals[this.selectedBookId] || progress.learned + 1,
          progress.learned + 1,
        )
        if (rated.graduated) {
          progress.mastered += 1
          this.masteredCount += 1
        } else if (uiRating !== 'know') {
          this.reviewCount += 1
        }
        this.bookProgress[this.selectedBookId] = progress
        this.persistProgress()

        let shown = false
        if (rated.nextWordId) {
          shown = this.showNextShortTermCard(rated.nextWordId)
        }
        if (!shown) {
          shown = this.showNextShortTermCard()
        }
        if (!shown) {
          const due = getEarliestDueInfo(
            rated.session.cards,
            Date.now(),
            rated.session.sequence,
          )
          this.sessionWaiting = true
          this.nextDueInSeconds = due?.waitSeconds ?? 0
        }

        return {
          mode: 'short-term' as const,
          graduated: rated.graduated,
          nextWordId: rated.nextWordId,
          longTermSeed: rated.longTermSeed,
          waiting: !shown,
          waitSeconds: this.nextDueInSeconds,
        }
      }

      // 兼容：无短时会话时仍按旧顺序翻词
      this.sessionWaiting = false
      this.currentWord.mastered = uiRating === 'know'
      if (this.remaining > 0) this.remaining -= 1
      const words = this.bookWords[this.selectedBookId] || []
      const progress = this.bookProgress[this.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 }
      progress.learned = Math.min(this.bookTotals[this.selectedBookId] || words.length, progress.learned + 1)
      if (uiRating === 'know') {
        progress.mastered += 1
        this.masteredCount += 1
      } else {
        this.reviewCount += 1
      }
      if (words.length) {
        const nextIndex = this.findNextLearnableIndex(progress.currentIndex)
        progress.currentIndex = nextIndex >= 0 ? nextIndex : (progress.currentIndex + 1) % words.length
        this.setCurrentWord(words[progress.currentIndex])
      }
      this.bookProgress[this.selectedBookId] = progress
      this.persistProgress()
      return { mode: 'legacy' as const }
    },
    persistProgress() {
      uni.setStorageSync('zhimi-book-progress', this.bookProgress)
    },
  },
})
