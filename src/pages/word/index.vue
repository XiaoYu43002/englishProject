<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomNav from '@/components/BottomNav.vue'
import { lookupWord, playWordAudio } from '@/services/dictionary'
import { useLearningStore } from '@/stores/learning'
import { usePronunciationStore } from '@/stores/pronunciation'
import { buildMeaningBlocks } from '@/utils/meaningBlocks'
import type { DictionaryResult } from '@/types/domain'

type RecallState = 'know' | 'fuzzy' | 'forgot'

const store = useLearningStore()
const pronunciation = usePronunciationStore()
const dictionary = ref<DictionaryResult | null>(null)
const loading = ref(false)
const playing = ref(false)
const revealed = ref(false)

const displayPhonetic = computed(() => {
  if (pronunciation.accent === 'uk' && store.currentWord.ukphone) return `/${store.currentWord.ukphone}/`
  if (pronunciation.accent === 'us' && store.currentWord.usphone) return `/${store.currentWord.usphone}/`
  return dictionary.value?.phonetic || store.currentWord.phonetic || ''
})

const rawMeanings = computed(() => {
  const fromStore = store.currentWord.meanings?.length
    ? store.currentWord.meanings
    : store.currentWord.meaning
      ? [store.currentWord.meaning]
      : []
  if (fromStore.length) return fromStore
  return dictionary.value?.meanings?.length ? dictionary.value.meanings : []
})

const meaningBlocks = computed(() => buildMeaningBlocks(rawMeanings.value))

watch(
  () => store.currentWord.word,
  () => {
    revealed.value = false
  },
)

async function loadDictionary() {
  const source = store.activeWords.find((item) => item.id === store.currentWord.id)
  if (!source) return
  loading.value = true
  revealed.value = false
  dictionary.value = await lookupWord(source, store.selectedBookId)
  loading.value = false
}

onShow(loadDictionary)

async function pronounce() {
  const word = dictionary.value?.word || store.currentWord.word
  playing.value = true
  const result = await playWordAudio(word)
  playing.value = false
  if (!result.ok) uni.showToast({ title: '发音失败', icon: 'none' })
}

function revealAnswer() {
  if (!revealed.value) revealed.value = true
}

async function mark(state: RecallState) {
  if (!revealed.value) return
  const tips = { know: '已掌握', fuzzy: '稍后再遇', forgot: '已加入复习' }
  store.markCurrentWord(state)
  revealed.value = false
  uni.showToast({ title: tips[state], icon: 'none' })
  await loadDictionary()
}

async function markAsKo() {
  if (store.isCurrentWordKo) {
    uni.showToast({ title: '已标记为熟词', icon: 'none' })
    return
  }
  const result = store.markCurrentWordAsKo()
  if (!result.ok) return
  revealed.value = false
  uni.showToast({ title: '已标记为熟，后续不再出现', icon: 'none' })
  await loadDictionary()
}
</script>

<template>
  <view class="word-page" :class="{ 'word-page--revealed': revealed }">
    <view class="word-topbar">
      <view
        class="ko-btn pressable"
        :class="{ 'ko-btn--on': store.isCurrentWordKo }"
        @tap.stop="markAsKo"
      >
        <text class="ko-btn__label">{{ store.isCurrentWordKo ? '已熟' : '熟' }}</text>
      </view>
    </view>

    <view class="word-hero">
      <view class="word-hero__cluster">
        <text class="word-hero__word">{{ store.currentWord.word }}</text>
        <view
          class="word-hero__sound pressable"
          :class="{ 'word-hero__sound--loading': playing || loading, 'word-hero__sound--playing': playing }"
          @tap.stop="pronounce"
        >
          <view class="wifi-wave">
            <view class="wifi-wave__arc wifi-wave__arc--1" />
            <view class="wifi-wave__arc wifi-wave__arc--2" />
            <view class="wifi-wave__arc wifi-wave__arc--3" />
          </view>
        </view>
      </view>
      <text class="word-hero__phonetic">{{ displayPhonetic || '音标待补充' }}</text>
    </view>

    <view class="word-body" @tap="revealAnswer">
      <scroll-view v-if="revealed" scroll-y class="word-body__scroll">
        <view v-for="block in meaningBlocks" :key="block.pos" class="pos-block">
          <text class="pos-block__label">{{ block.pos }}</text>
          <view class="pos-block__senses">
            <view
              v-for="(sense, index) in block.senses"
              :key="`${block.pos}-${index}`"
              class="pos-sense"
            >
              <view class="pos-sense__badge">
                <text class="pos-sense__num">{{ index + 1 }}</text>
              </view>
              <text class="pos-sense__text">{{ sense.text }}</text>
            </view>
          </view>
        </view>
        <text v-if="!meaningBlocks.length" class="word-body__empty">暂无释义</text>
      </scroll-view>

      <view v-else class="word-mask">
        <text class="word-mask__title">回忆单词发音和释义</text>
        <text class="word-mask__hint">点击屏幕显示答案</text>
      </view>
    </view>

    <view v-if="revealed" class="recall-dock">
      <view class="recall-btn recall-btn--know" @tap="mark('know')">
        <text class="recall-btn__label">认识</text>
      </view>
      <view class="recall-btn recall-btn--fuzzy" @tap="mark('fuzzy')">
        <text class="recall-btn__label">模糊</text>
      </view>
      <view class="recall-btn recall-btn--forgot" @tap="mark('forgot')">
        <text class="recall-btn__label">忘记</text>
      </view>
    </view>

    <BottomNav active="semantic" />
  </view>
</template>

<style scoped lang="scss">
$paper: #f8f5e9;
$paper-light: #fffdf8;
$ink: #1f2421;
$green: #1f4d3a;
$green-soft: #3d7564;
$muted: #6e786f;
$mask: #d5e8df;

.word-page {
  height: 100vh;
  background: $paper;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  position: relative;
  /* 只留底部导航高度，遮罩一直铺到导航上方 */
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
}

.word-page--revealed {
  /* 显示答案后：三态按钮 + 底部导航 */
  padding-bottom: calc(112px + env(safe-area-inset-bottom));
}

.word-topbar {
  position: absolute;
  z-index: 5;
  top: calc(env(safe-area-inset-top) + 12px);
  right: 16px;
}

.ko-btn {
  min-width: 40px;
  height: 32px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #e4efe8;
  border: 1px solid #b7cfc2;
}

.ko-btn--on {
  background: #1f4d3a;
  border-color: #1f4d3a;
}

.ko-btn__label {
  color: #1f4d3a;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.ko-btn--on .ko-btn__label {
  color: #fffdf8;
}

.word-hero {
  padding: calc(env(safe-area-inset-top) + 48px) 28px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: $paper;
  position: relative;
}

.word-hero__cluster {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.word-hero__word {
  color: $ink;
  font-size: 42px;
  line-height: 50px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-align: center;
}

.word-hero__sound {
  position: absolute;
  left: calc(100% + 7px);
  top: 50%;
  /* 略往下，与单词视觉中线对齐 */
  transform: translateY(calc(-50% + 5px));
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 朝右三层波浪：短 → 长 */
.wifi-wave {
  position: relative;
  width: 26px;
  height: 24px;
}

.wifi-wave__arc {
  position: absolute;
  top: 50%;
  left: 0;
  border: 2.5px solid $green;
  border-color: transparent $green transparent transparent;
  border-radius: 50%;
  box-sizing: border-box;
  transform: translateY(-50%);
}

.wifi-wave__arc--1 {
  width: 12px;
  height: 12px;
}

.wifi-wave__arc--2 {
  width: 19px;
  height: 19px;
}

.wifi-wave__arc--3 {
  width: 26px;
  height: 26px;
}

.word-hero__sound--loading {
  opacity: 0.55;
}

.word-hero__sound--playing .wifi-wave__arc--2,
.word-hero__sound--playing .wifi-wave__arc--3 {
  animation: wifi-ripple 1s ease-in-out infinite;
}

.word-hero__sound--playing .wifi-wave__arc--3 {
  animation-delay: 0.15s;
}

@keyframes wifi-ripple {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.word-hero__phonetic {
  margin-top: 12px;
  color: #8a9188;
  font-size: 16px;
  line-height: 22px;
  text-align: center;
}

.word-body {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.word-body__scroll {
  flex: 1;
  height: 100%;
  padding: 28px 24px 16px;
  box-sizing: border-box;
  background: $paper-light;
}

.pos-block {
  margin-bottom: 16px;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 10px;
}

.pos-block:last-child {
  margin-bottom: 0;
}

.pos-block__label {
  flex: none;
  height: 26px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  color: #fffdf8;
  background: $green;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 1px;
  white-space: nowrap;
}

.pos-block__senses {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.pos-sense {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  max-width: 100%;
}

.pos-sense__badge {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e4efe8;
  border: 1px solid #b7cfc2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pos-sense__num {
  color: $green;
  font-size: 12px;
  line-height: 12px;
  font-weight: 700;
}

.pos-sense__text {
  color: $ink;
  font-size: 16px;
  line-height: 26px;
  font-weight: 600;
  word-break: break-word;
}

.word-body__empty {
  display: block;
  margin-top: 10px;
  color: $muted;
  font-size: 12px;
  line-height: 18px;
}

.word-mask {
  flex: 1;
  width: 100%;
  height: 100%;
  background: $mask;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.word-mask__title {
  color: #2f5a4a;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.word-mask__hint {
  margin-top: 10px;
  color: #6e8f82;
  font-size: 13px;
}

.recall-dock {
  position: fixed;
  z-index: 15;
  left: 0;
  right: 0;
  bottom: calc(56px + env(safe-area-inset-bottom));
  display: flex;
  gap: 0;
  padding: 0;
  background: $paper;
}

.recall-btn {
  flex: 1;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recall-btn__label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
}

.recall-btn--know {
  color: #1f4d3a;
  background: #d7e5dc;
}

.recall-btn--fuzzy {
  color: #7a6230;
  background: #efe2c4;
}

.recall-btn--forgot {
  color: #7a3d3d;
  background: #f0d9d4;
}
</style>
