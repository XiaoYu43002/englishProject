<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useLearningStore } from '@/stores/learning'

const PRESETS = [10, 20, 30, 50, 100]

const store = useLearningStore()
const bookId = ref(store.selectedBookId)
const dailyTarget = ref(store.todayTarget || 20)
const saving = ref(false)

const selectedBook = computed(
  () => store.books.find((book) => book.id === bookId.value) || store.activeBook,
)

const previewText = computed(
  () => `${selectedBook.value.shortTitle} · 每日新学 ${dailyTarget.value} 词`,
)

function back() {
  uni.navigateBack()
}

function selectBook(id: string) {
  bookId.value = id
}

function selectPreset(n: number) {
  dailyTarget.value = n
}

function bump(delta: number) {
  dailyTarget.value = Math.min(200, Math.max(1, dailyTarget.value + delta))
}

function onInputTarget(event: { detail?: { value?: string } }) {
  const raw = Number(event.detail?.value || dailyTarget.value)
  if (!Number.isFinite(raw)) return
  dailyTarget.value = Math.min(200, Math.max(1, Math.round(raw)))
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const result = await store.setLearningPlan({
      bookId: bookId.value,
      dailyTarget: dailyTarget.value,
      restartToday: true,
    })
    uni.showToast({
      title: `已保存：每日 ${result.dailyTarget} 词`,
      icon: 'none',
    })
    setTimeout(() => uni.navigateBack(), 450)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="screen plan-screen">
    <PageHeader title="学习计划" @back="back" />

    <text class="plan-lead">选择当前词书，并设定今天希望新学的单词数量。</text>

    <view class="preview-card card">
      <text class="preview-card__label">当前计划</text>
      <text class="preview-card__value">{{ previewText }}</text>
    </view>

    <text class="section-label">学习词书</text>
    <scroll-view scroll-y class="book-scroll" :show-scrollbar="false">
      <view
        v-for="book in store.books"
        :key="book.id"
        class="book-row card pressable"
        :class="{ 'book-row--on': bookId === book.id }"
        @tap="selectBook(book.id)"
      >
        <view class="book-row__mark" :style="{ background: book.accent }" />
        <view class="book-row__body">
          <text class="book-row__title">{{ book.title }}</text>
          <text class="book-row__meta">{{ book.level }} · {{ book.wordCount }} 词</text>
        </view>
        <text class="book-row__check">{{ bookId === book.id ? '✓' : '' }}</text>
      </view>
    </scroll-view>

    <text class="section-label">今日新学单词数</text>
    <view class="preset-row">
      <view
        v-for="n in PRESETS"
        :key="n"
        class="preset-chip pressable"
        :class="{ 'preset-chip--on': dailyTarget === n }"
        @tap="selectPreset(n)"
      >
        <text>{{ n }}</text>
      </view>
    </view>

    <view class="stepper card">
      <view class="stepper__btn pressable" @tap="bump(-5)">−5</view>
      <view class="stepper__btn pressable" @tap="bump(-1)">−</view>
      <input
        class="stepper__input"
        type="number"
        :value="String(dailyTarget)"
        @input="onInputTarget"
      />
      <view class="stepper__btn pressable" @tap="bump(1)">+</view>
      <view class="stepper__btn pressable" @tap="bump(5)">+5</view>
    </view>
    <text class="hint">保存后将按新计划重新生成今日短时学习队列（1–200）。</text>

    <button class="save-button pressable" :disabled="saving" @tap="save">
      {{ saving ? '保存中…' : '保存学习计划' }}
    </button>

    <BottomNav active="profile" />
  </view>
</template>

<style scoped lang="scss">
.plan-screen {
  padding-top: calc(env(safe-area-inset-top) + 18px);
  padding-bottom: 116px;
}

.plan-lead {
  display: block;
  margin-top: 14px;
  color: #6e786f;
  font-size: 13px;
  line-height: 1.6;
}

.preview-card {
  margin-top: 16px;
  padding: 14px 16px;
}

.preview-card__label {
  display: block;
  color: #3d7564;
  font-size: 12px;
  font-weight: 700;
}

.preview-card__value {
  display: block;
  margin-top: 6px;
  color: #1f2421;
  font-size: 18px;
  font-weight: 700;
}

.section-label {
  display: block;
  margin-top: 22px;
  margin-bottom: 10px;
  color: #1f2421;
  font-size: 14px;
  font-weight: 700;
}

.book-scroll {
  max-height: 240px;
}

.book-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  border: 1.5px solid transparent;
}

.book-row--on {
  border-color: rgba(31, 77, 58, 0.35);
  background: #f3f8f4;
}

.book-row__mark {
  flex: none;
  width: 10px;
  height: 36px;
  border-radius: 999px;
}

.book-row__body {
  flex: 1;
  min-width: 0;
}

.book-row__title {
  display: block;
  color: #1f2421;
  font-size: 14px;
  font-weight: 700;
}

.book-row__meta {
  display: block;
  margin-top: 2px;
  color: #6e786f;
  font-size: 12px;
}

.book-row__check {
  flex: none;
  width: 20px;
  color: #1f4d3a;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-chip {
  min-width: 52px;
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #315444;
  background: #f8f5ec;
  border: 1px solid #d8d7ca;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
}

.preset-chip--on {
  color: #fffdf5;
  background: #285c48;
  border-color: #285c48;
}

.stepper {
  margin-top: 12px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stepper__btn {
  flex: none;
  min-width: 44px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f4d3a;
  background: #eef3ee;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
}

.stepper__input {
  flex: 1;
  height: 40px;
  text-align: center;
  color: #1f2421;
  font-size: 20px;
  font-weight: 800;
}

.hint {
  display: block;
  margin-top: 10px;
  color: #8b9288;
  font-size: 12px;
  line-height: 1.5;
}

.save-button {
  margin-top: 22px;
  height: 48px;
  color: #fff;
  background: #1f4d3a;
  border: 0;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  line-height: 48px;
  box-shadow: 0 8px 18px rgba(31, 77, 58, 0.18);
}

.save-button::after {
  border: 0;
}

.save-button[disabled] {
  opacity: 0.6;
}
</style>
