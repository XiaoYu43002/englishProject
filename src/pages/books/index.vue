<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const query = ref('')

const filteredBooks = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return store.books
  return store.books.filter((book) => `${book.title} ${book.shortTitle} ${book.level}`.toLowerCase().includes(keyword))
})

function progressFor(bookId: string) {
  const progress = store.bookProgress[bookId]
  const total = store.bookTotals[bookId] || 1
  return Math.min(100, Math.round(((progress?.learned || 0) / total) * 100))
}

async function openBook(bookId: string) {
  await store.selectBook(bookId)
  uni.navigateTo({ url: `/pages/book-detail/index?id=${bookId}` })
}
</script>

<template>
  <view class="screen books-screen">
    <view class="books-header">
      <text class="eyebrow">WORD BOOKS</text>
      <text class="page-title">选择你的词书</text>
      <text class="page-subtitle">按考试与学习阶段积累词汇，并把每个词放进语义位置。</text>
    </view>

    <view class="search-box">
      <text class="search-box__icon">⌕</text>
      <input v-model="query" class="search-box__input" placeholder="搜索 CET-4、高考、GRE…" placeholder-class="search-placeholder" />
    </view>

    <view class="active-summary card">
      <view>
        <text class="active-summary__label">当前学习</text>
        <text class="active-summary__title">{{ store.activeBook.title }}</text>
      </view>
      <view class="active-summary__badge">{{ store.activeBookProgress.learned }} 词</view>
    </view>

    <view class="book-list">
      <view v-for="book in filteredBooks" :key="book.id" class="book-card card pressable" @tap="openBook(book.id)">
        <view class="book-card__cover" :style="{ background: book.accent }">
          <text class="book-card__cover-mark">知</text>
          <text class="book-card__cover-title">{{ book.shortTitle }}</text>
        </view>
        <view class="book-card__body">
          <view class="book-card__heading">
            <view>
              <text class="book-card__title">{{ book.title }}</text>
              <text class="book-card__meta">{{ book.level }} · {{ book.wordCount }} 词</text>
            </view>
            <text v-if="store.selectedBookId === book.id" class="book-card__current">学习中</text>
          </view>
          <text class="book-card__desc">{{ book.description }}</text>
          <view class="book-card__progress">
            <view class="book-card__progress-fill" :style="{ width: `${progressFor(book.id)}%`, background: book.accent }" />
          </view>
          <text class="book-card__progress-text">已完成 {{ progressFor(book.id) }}%</text>
        </view>
      </view>
    </view>

    <BottomNav active="semantic" />
  </view>
</template>

<style scoped lang="scss">
.books-screen { padding-top: calc(env(safe-area-inset-top) + 38px); overflow: visible; }
.books-header { position: relative; }
.search-box { height: 48px; margin-top: 22px; padding: 0 15px; display: flex; align-items: center; background: #fffdf8; border: 1px solid #e0dccf; border-radius: 16px; }
.search-box__icon { color: #3d7564; font-size: 22px; }
.search-box__input { flex: 1; height: 48px; margin-left: 10px; color: #1f2421; font-size: 13px; }
.search-placeholder { color: #9ca39b; }
.active-summary { margin-top: 16px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; background: #eef1e8; }
.active-summary__label, .active-summary__title { display: block; }
.active-summary__label { color: #6e786f; font-size: 10px; }
.active-summary__title { margin-top: 4px; color: #1f4d3a; font-size: 15px; font-weight: 700; }
.active-summary__badge { padding: 7px 10px; color: #fff; background: #1f4d3a; border-radius: 12px; font-size: 10px; }
.book-list { margin-top: 18px; display: flex; flex-direction: column; gap: 13px; }
.book-card { min-height: 154px; padding: 14px; display: flex; }
.book-card__cover { width: 88px; min-height: 126px; padding: 13px 10px; display: flex; flex-direction: column; justify-content: space-between; border-radius: 14px; color: #fff; box-shadow: 0 9px 18px rgba(31,77,58,.15); }
.book-card__cover-mark { font-family: serif; font-size: 25px; opacity: .9; }
.book-card__cover-title { font-size: 15px; font-weight: 700; }
.book-card__body { min-width: 0; flex: 1; margin-left: 15px; }
.book-card__heading { display: flex; justify-content: space-between; gap: 8px; }
.book-card__title, .book-card__meta, .book-card__desc, .book-card__progress-text { display: block; }
.book-card__title { color: #1f2421; font-size: 15px; font-weight: 700; }
.book-card__meta { margin-top: 5px; color: #7a837b; font-size: 10px; }
.book-card__current { flex: none; color: #3d7564; font-size: 10px; font-weight: 700; }
.book-card__desc { margin-top: 11px; color: #6e786f; font-size: 10px; line-height: 16px; }
.book-card__progress { height: 5px; margin-top: 13px; overflow: hidden; background: #ece9df; border-radius: 99px; }
.book-card__progress-fill { height: 100%; border-radius: 99px; }
.book-card__progress-text { margin-top: 5px; color: #8b938b; font-size: 9px; text-align: right; }
</style>
