<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import BottomNav from '@/components/BottomNav.vue'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const query = ref('')

onLoad(async (options) => {
  const id = String(options?.id || store.selectedBookId)
  await store.selectBook(id)
})

const filteredWords = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return store.activeWords
  return store.activeWords.filter((item) => item.word.includes(keyword) || item.meanings.some((meaning) => meaning.includes(keyword)))
})

const progressPercent = computed(() => {
  const total = store.bookTotals[store.selectedBookId] || 1
  return Math.min(100, Math.round((store.activeBookProgress.learned / total) * 100))
})

function back() { uni.navigateBack() }
function startLearning() {
  store.openWord(store.activeBookProgress.currentIndex)
  uni.navigateTo({ url: '/pages/word/index' })
}
function openWord(wordId: string) {
  const index = store.activeWords.findIndex((item) => item.id === wordId)
  store.openWord(Math.max(0, index))
  uni.navigateTo({ url: '/pages/word/index' })
}
</script>

<template>
  <view class="screen book-detail-screen">
    <view class="topbar">
      <view class="topbar__back pressable" @tap="back">‹</view>
      <text class="topbar__label">词书详情</text>
      <view class="topbar__space" />
    </view>

    <view class="book-hero" :style="{ background: store.activeBook.accent }">
      <text class="book-hero__eyebrow">{{ store.activeBook.level }}</text>
      <text class="book-hero__title">{{ store.activeBook.title }}</text>
      <text class="book-hero__desc">{{ store.activeBook.description }}</text>
      <view class="book-hero__stats">
        <view><text class="book-hero__number">{{ store.bookTotals[store.selectedBookId] }}</text><text class="book-hero__unit">总词数</text></view>
        <view><text class="book-hero__number">{{ store.activeBookProgress.learned }}</text><text class="book-hero__unit">已学习</text></view>
        <view><text class="book-hero__number">{{ store.activeBookProgress.mastered }}</text><text class="book-hero__unit">已掌握</text></view>
      </view>
    </view>

    <view class="progress-card card">
      <view class="progress-card__line"><text>学习进度</text><text>{{ progressPercent }}%</text></view>
      <view class="progress-card__bar"><view class="progress-card__fill" :style="{ width: `${progressPercent}%`, background: store.activeBook.accent }" /></view>
      <button class="primary-button progress-card__button pressable" @tap="startLearning">{{ store.activeBookProgress.learned ? '继续学习' : '开始学习' }}</button>
    </view>

    <view class="word-section">
      <view class="word-section__heading"><text class="section-title">词汇预览</text><text>{{ filteredWords.length }} 个已载入</text></view>
      <view class="search-box"><text>⌕</text><input v-model="query" placeholder="搜索英文或中文释义" placeholder-class="search-placeholder" /></view>
      <view v-if="store.loadingBook" class="empty-state">正在加载词书…</view>
      <view v-else class="word-list card">
        <view v-for="word in filteredWords" :key="word.id" class="word-row pressable" @tap="openWord(word.id)">
          <view class="word-row__main"><text class="word-row__word">{{ word.word }}</text><text class="word-row__meaning">{{ word.meanings[0] || '待补充释义' }}</text></view>
          <image class="word-row__arrow" src="/static/icons/chevron-right.svg" mode="aspectFit" />
        </view>
      </view>
    </view>

    <BottomNav active="semantic" />
  </view>
</template>

<style scoped lang="scss">
.book-detail-screen {
  padding-top: calc(env(safe-area-inset-top) + 18px);
  padding-bottom: 116px;
  overflow: visible;
}
.topbar { height: 42px; display: flex; align-items: center; justify-content: space-between; }
.topbar__back, .topbar__space { width: 34px; }
.topbar__back { color: #1f4d3a; font-size: 34px; line-height: 34px; }
.topbar__label { font-size: 14px; font-weight: 700; }
.book-hero { margin-top: 12px; padding: 24px 22px 20px; border-radius: 24px; color: #fff; box-shadow: 0 15px 32px rgba(31,77,58,.18); }
.book-hero__eyebrow, .book-hero__title, .book-hero__desc { display: block; }
.book-hero__eyebrow { font-size: 10px; letter-spacing: 1px; opacity: .72; }
.book-hero__title { margin-top: 8px; font-size: 25px; font-weight: 700; }
.book-hero__desc { margin-top: 10px; font-size: 11px; line-height: 18px; opacity: .78; }
.book-hero__stats { margin-top: 22px; display: grid; grid-template-columns: repeat(3,1fr); }
.book-hero__stats > view { display: flex; flex-direction: column; }
.book-hero__number { font-size: 18px; font-weight: 700; }
.book-hero__unit { margin-top: 3px; font-size: 9px; opacity: .7; }
.progress-card { margin-top: 16px; padding: 17px; }
.progress-card__line { display: flex; justify-content: space-between; color: #6e786f; font-size: 11px; }
.progress-card__bar { height: 7px; margin-top: 11px; overflow: hidden; background: #ece9df; border-radius: 99px; }
.progress-card__fill { height: 100%; border-radius: 99px; }
.progress-card__button { height: 46px; margin-top: 15px; line-height: 46px; border-radius: 15px; }
.word-section { margin-top: 26px; }
.word-section__heading { display: flex; align-items: center; justify-content: space-between; color: #879087; font-size: 10px; }
.search-box { height: 44px; margin-top: 13px; padding: 0 14px; display: flex; align-items: center; background: #fffdf8; border: 1px solid #e0dccf; border-radius: 14px; color: #3d7564; }
.search-box input { flex: 1; height: 44px; margin-left: 9px; color: #1f2421; font-size: 12px; }
.search-placeholder { color: #9ca39b; }
.word-list { margin-top: 12px; overflow: hidden; }
.word-row { min-height: 59px; padding: 11px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eeeae0; }
.word-row:last-child { border-bottom: 0; }
.word-row__main { min-width: 0; display: flex; flex-direction: column; }
.word-row__word { color: #1f2421; font-size: 15px; font-weight: 700; }
.word-row__meaning { max-width: 250px; margin-top: 4px; overflow: hidden; color: #788079; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.word-row__arrow { width: 18px; height: 18px; flex: none; }
.empty-state { padding: 32px 0; color: #7f897f; text-align: center; }
</style>
