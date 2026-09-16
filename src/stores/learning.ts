import { defineStore } from 'pinia'
import { fetchBookWords, getLocalWords, localBooks } from '@/services/catalog'
import type { AuthUser, BookProgress, LearningWord, LoginMethod, OcrCandidate, ScanAddTarget, ScanHistoryRecord, SemanticDomain, VocabularyWord, WordBook } from '@/types/domain'
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

function toLearningWord(word: VocabularyWord, bookId?: string): LearningWord {
  const activeBookId = bookId || word.activeBookId || word.bookIds?.[0] || ''
  const meanings = meaningsForBook(word, activeBookId)
  return {
    id: word.id,
    word: word.word,
    phonetic: word.usphone ? `/${word.usphone}/` : word.ukphone ? `/${word.ukphone}/` : '',
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
    todayTarget: 28,
    remaining: 28,
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
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.authToken),
    exploredCount: (state) => state.domains.filter((item) => item.explored).length,
    progress: (state) => Math.round(((state.todayTarget - state.remaining) / state.todayTarget) * 100),
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
        const learnable = this.learnableWords('custom')
        const first = learnable.find((item) => selected.some((row) => row.normalized === item.id)) || learnable[0]
        if (first) {
          const index = this.personalWords.findIndex((item) => item.id === first.id)
          this.openWord(Math.max(0, index))
        }
        this.remaining += additions.length
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
    markCurrentWord(result: boolean | 'know' | 'fuzzy' | 'forgot' = true) {
      const state = result === true || result === 'know'
        ? 'know'
        : result === 'fuzzy'
          ? 'fuzzy'
          : 'forgot'
      this.currentWord.mastered = state === 'know'
      if (this.remaining > 0) this.remaining -= 1
      const words = this.bookWords[this.selectedBookId] || []
      const progress = this.bookProgress[this.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 }
      progress.learned = Math.min(this.bookTotals[this.selectedBookId] || words.length, progress.learned + 1)
      if (state === 'know') {
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
    },
    persistProgress() {
      uni.setStorageSync('zhimi-book-progress', this.bookProgress)
    },
  },
})
