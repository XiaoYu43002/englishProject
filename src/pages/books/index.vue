<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import BottomNav from '@/components/BottomNav.vue'
import PageHeader from '@/components/PageHeader.vue'
import { BOOK_CATEGORIES, booksInCategory } from '@/data/bookCategories'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const query = ref('')
const expandedIds = ref<string[]>(['primary'])
const selecting = ref(false)
const fromOnboarding = ref(false)

onLoad((options) => {
  fromOnboarding.value = String(options?.from || '') === 'onboarding'
})

const filteredCategories = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return BOOK_CATEGORIES.map((category) => {
    const books = booksInCategory(category, store.books).filter((book) => {
      if (!keyword) return true
      return `${book.title} ${book.shortTitle} ${category.label}`
        .toLowerCase()
        .includes(keyword)
    })
    return { ...category, books }
  }).filter((category) => {
    if (!keyword) return true
    return category.books.length > 0 || category.label.toLowerCase().includes(keyword)
  })
})

const visibleExpanded = computed(() => {
  const keyword = query.value.trim()
  if (!keyword) return new Set(expandedIds.value)
  return new Set(filteredCategories.value.map((item) => item.id))
})

const learnedCount = computed(() => store.activeBookProgress.learned || 0)

function isExpanded(id: string) {
  return visibleExpanded.value.has(id)
}

function toggleCategory(id: string) {
  if (expandedIds.value.includes(id) && !query.value.trim()) {
    expandedIds.value = expandedIds.value.filter((item) => item !== id)
    return
  }
  if (!expandedIds.value.includes(id)) {
    expandedIds.value = [...expandedIds.value, id]
  }
}

function learnedOf(bookId: string) {
  return store.bookProgress[bookId]?.learned || 0
}

function totalOf(bookId: string, fallback: number) {
  return store.bookTotals[bookId] || fallback || 0
}

async function pickBook(bookId: string) {
  if (selecting.value) return
  selecting.value = true
  try {
    await store.selectBook(bookId)
    if (fromOnboarding.value) {
      uni.showToast({ title: '已选择词书', icon: 'none' })
      setTimeout(() => {
        uni.redirectTo({ url: '/pages/home/index' })
      }, 350)
      return
    }
    uni.navigateTo({ url: `/pages/book-detail/index?id=${bookId}` })
  } finally {
    selecting.value = false
  }
}

function back() {
  if (fromOnboarding.value) {
    uni.redirectTo({ url: '/pages/home/index' })
    return
  }
  uni.navigateBack()
}
</script>

<template>
  <view class="screen books-screen" :class="{ 'books-screen--onboarding': fromOnboarding }">
    <PageHeader v-if="fromOnboarding" title="选择词书" @back="back" />

    <view v-else class="books-header">
      <text class="eyebrow">WORD BOOKS</text>
    </view>

    <view class="search-box">
      <image class="search-box__icon" src="/static/icons/search.svg" mode="aspectFit" />
      <input
        v-model="query"
        class="search-box__input"
        placeholder="搜索 CET-4、高考、小学…"
        placeholder-class="search-placeholder"
      />
    </view>

    <view class="active-summary card">
      <view class="active-summary__main">
        <text class="active-summary__label">当前学习</text>
        <text class="active-summary__title">{{ store.activeBook.title }}</text>
      </view>
      <view class="active-summary__badge" :class="{ 'active-summary__badge--zero': learnedCount === 0 }">
        <text class="active-summary__badge-num">{{ learnedCount }}</text>
        <text class="active-summary__badge-unit">已学</text>
      </view>
    </view>

    <view class="category-panel card">
      <view
        v-for="category in filteredCategories"
        :key="category.id"
        class="category-block"
      >
        <view class="category-row pressable" @tap="toggleCategory(category.id)">
          <view class="category-row__letter">
            <text class="category-row__letter-text">{{ category.letter }}</text>
          </view>
          <view class="category-row__main">
            <text class="category-row__title">{{ category.label }}</text>
            <text class="category-row__count">({{ category.books.length }})</text>
          </view>
          <image
            class="category-row__chevron"
            :class="{ 'category-row__chevron--open': isExpanded(category.id) }"
            src="/static/icons/chevron-down.svg"
            mode="aspectFit"
          />
        </view>

        <view v-if="isExpanded(category.id)" class="book-list">
          <view v-if="!category.books.length" class="book-empty">
            <text class="book-empty__text">暂无词书，后续会陆续补充</text>
          </view>
          <view
            v-for="book in category.books"
            :key="book.id"
            class="book-row pressable"
            :class="{ 'book-row--active': store.selectedBookId === book.id }"
            @tap="pickBook(book.id)"
          >
            <view class="book-row__bullet" />
            <text class="book-row__title">{{ book.title }}</text>
            <view class="book-row__progress">
              <text
                class="book-row__learned"
                :class="{ 'book-row__learned--zero': learnedOf(book.id) === 0 }"
              >{{ learnedOf(book.id) }}</text>
              <text class="book-row__slash">/</text>
              <text class="book-row__total">{{ totalOf(book.id, book.wordCount) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <BottomNav v-if="!fromOnboarding" active="semantic" />
  </view>
</template>

<style scoped lang="scss">
.books-screen {
  padding-top: calc(env(safe-area-inset-top) + 28px);
  padding-bottom: 116px;
  overflow: visible;
}

.books-screen--onboarding {
  padding-top: calc(env(safe-area-inset-top) + 18px);
  padding-bottom: calc(env(safe-area-inset-bottom) + 28px);
}

.books-header {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.eyebrow {
  display: block;
  color: #1f4d3a;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-align: center;
}

.search-box {
  height: 48px;
  margin-top: 14px;
  padding: 0 14px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  background: #fffdf8;
  border: 1px solid #e0dccf;
  border-radius: 16px;
  box-sizing: border-box;
}

.search-box__icon {
  width: 18px;
  height: 18px;
  flex: none;
  opacity: 0.85;
}

.search-box__input {
  flex: 1;
  height: 48px;
  color: #1f2421;
  font-size: 13px;
}

.search-placeholder {
  color: #9ca39b;
}

.active-summary {
  margin-top: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #eef1e8;
}

.active-summary__main {
  min-width: 0;
  flex: 1;
}

.active-summary__label,
.active-summary__title {
  display: block;
}

.active-summary__label {
  color: #6e786f;
  font-size: 11px;
}

.active-summary__title {
  margin-top: 4px;
  color: #1f4d3a;
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-summary__badge {
  flex: none;
  min-width: 54px;
  padding: 7px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #1f4d3a;
  border-radius: 12px;
}

.active-summary__badge--zero {
  color: #5f7468;
  background: #dce6df;
}

.active-summary__badge-num {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.active-summary__badge-unit {
  margin-top: 2px;
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
}

.category-panel {
  margin-top: 14px;
  padding: 2px 0;
  overflow: hidden;
}

.category-block + .category-block {
  border-top: 1px solid #efece3;
}

.category-row {
  min-height: 48px;
  padding: 8px 14px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
}

.category-row__letter {
  width: 32px;
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef3ef;
  border-radius: 50%;
}

.category-row__letter-text {
  color: #1f4d3a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.category-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.category-row__title {
  color: #1f2421;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.category-row__count {
  color: #8b938b;
  font-size: 13px;
  line-height: 22px;
}

.category-row__chevron {
  width: 18px;
  height: 18px;
  flex: none;
  opacity: 0.55;
  transition: transform 180ms ease;
}

.category-row__chevron--open {
  transform: rotate(180deg);
}

.book-list {
  padding: 0 12px 6px 20px;
}

.book-empty {
  padding: 4px 0 8px 28px;
}

.book-empty__text {
  color: #9ca39b;
  font-size: 12px;
  line-height: 18px;
}

.book-row {
  min-height: 32px;
  padding: 4px 2px 4px 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  box-sizing: border-box;
}

.book-row--active .book-row__title {
  color: #1f4d3a;
  font-weight: 700;
}

.book-row__bullet {
  width: 5px;
  height: 5px;
  flex: none;
  margin-left: 20px;
  background: #b6beb6;
  border-radius: 50%;
}

.book-row--active .book-row__bullet {
  background: #1f4d3a;
}

.book-row__title {
  flex: 1;
  min-width: 0;
  color: #3a403c;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
}

.book-row__progress {
  flex: none;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: flex-end;
  min-width: 58px;
  font-variant-numeric: tabular-nums;
}

.book-row__learned {
  color: #1f4d3a;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.book-row__learned--zero {
  color: #b0b7af;
  font-weight: 500;
}

.book-row__slash {
  color: #c5cbc3;
  font-size: 11px;
  line-height: 1;
  margin: 0 1px;
}

.book-row__total {
  color: #6e786f;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}
</style>
