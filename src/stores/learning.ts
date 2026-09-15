import { defineStore } from 'pinia'
import { fetchBookWords, getLocalWords, localBooks } from '@/services/catalog'
import type { AuthUser, BookProgress, LearningWord, LoginMethod, OcrCandidate, ScanAddTarget, SemanticDomain, VocabularyWord, WordBook } from '@/types/domain'
import { meaningsForBook } from '@/utils/meanings'

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
  personalWords: VocabularyWord[]
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
    personalWords: storedPersonalWords,
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
    activeWords: (state) => state.bookWords[state.selectedBookId] || [],
    activeBookProgress: (state) => state.bookProgress[state.selectedBookId] || { learned: 0, mastered: 0, currentIndex: 0 },
  },
  actions: {
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
    setScanCandidates(candidates: OcrCandidate[]) {
      this.scanCandidates = candidates
      this.selectedWords = candidates.map((item) => item.normalized)
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
      if (target === 'today' && selected.length) {
        this.selectedBookId = 'custom'
        uni.setStorageSync('zhimi-selected-book', 'custom')
        const firstSelectedIndex = this.personalWords.findIndex((item) => item.id === selected[0].normalized)
        this.openWord(Math.max(0, firstSelectedIndex))
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
      if (words.length) this.setCurrentWord(words[progress.currentIndex % words.length])
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
        progress.currentIndex = (progress.currentIndex + 1) % words.length
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
