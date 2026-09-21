<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
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
const answerRevealedAt = ref(0)
const waitLeft = ref(0)
let waitTimer: ReturnType<typeof setInterval> | null = null

const displayPhonetic = computed(() => {
  if (pronunciation.accent === 'uk' && store.currentWord.ukphone) return `/${store.currentWord.ukphone}/`
  if (pronunciation.accent === 'us' && store.currentWord.usphone) return `/${store.currentWord.usphone}/`
  if (store.currentWord.ukphone) return `/${store.currentWord.ukphone}/`
  if (store.currentWord.usphone) return `/${store.currentWord.usphone}/`
  const general = store.currentWord.phonetic || dictionary.value?.phonetic || ''
  if (!general) return ''
  return general.startsWith('/') ? general : `/${general}/`
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

const sessionProgress = computed(() => {
  const stats = store.shortTermStats
  const total = stats.total || store.todayTarget || 0
  const done = stats.graduated || 0
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return { done, total, percent, learning: stats.learning }
})

const waitLabel = computed(() => {
  const s = waitLeft.value
  if (s <= 0) return '可以继续了'
  if (s < 60) return `${s} 秒后继续`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} 分 ${r} 秒后继续` : `${m} 分钟后继续`
})

function clearWaitTimer() {
  if (waitTimer) {
    clearInterval(waitTimer)
    waitTimer = null
  }
}

function startWaitCountdown(seconds: number) {
  clearWaitTimer()
  waitLeft.value = Math.max(0, seconds)
  if (waitLeft.value <= 0) {
    store.tryResumeShortTermSession()
    return
  }
  waitTimer = setInterval(() => {
    waitLeft.value = Math.max(0, waitLeft.value - 1)
    if (waitLeft.value > 0) return
    clearWaitTimer()
    const ok = store.tryResumeShortTermSession()
    if (ok) {
      loadDictionary()
    } else {
      waitLeft.value = store.nextDueInSeconds
      if (waitLeft.value > 0) startWaitCountdown(waitLeft.value)
    }
  }, 1000)
}

watch(
  () => store.currentWord.word,
  () => {
    revealed.value = false
    answerRevealedAt.value = 0
  },
)

async function loadDictionary() {
  if (store.sessionWaiting) return
  const source = store.activeWords.find((item) => item.id === store.currentWord.id)
    || store.activeWords.find((item) => item.word === store.currentWord.word)
  if (!source) return
  loading.value = true
  revealed.value = false
  answerRevealedAt.value = 0
  dictionary.value = await lookupWord(source, store.selectedBookId)
  loading.value = false
}

onShow(async () => {
  if (!store.shortTermSession?.cards?.length) {
    store.startTodayLearning()
  } else if (store.sessionWaiting) {
    store.tryResumeShortTermSession()
    if (store.sessionWaiting) startWaitCountdown(store.nextDueInSeconds)
  } else if (!store.currentWord?.word) {
    store.showNextShortTermCard()
  }
  await loadDictionary()
})

onUnmounted(clearWaitTimer)

async function pronounce() {
  const word = dictionary.value?.word || store.currentWord.word
  playing.value = true
  const result = await playWordAudio(word)
  playing.value = false
  if (!result.ok) {
    uni.showToast({ title: '发音失败', icon: 'none' })
    return
  }
  store.noteAudioPlayed()
}

function revealAnswer() {
  if (!revealed.value) {
    revealed.value = true
    answerRevealedAt.value = Date.now()
  }
}

async function mark(state: RecallState) {
  if (!revealed.value) return
  const tips = { know: '已记录', fuzzy: '稍后验证', forgot: '重新记忆' }
  const result = store.markCurrentWord(state, {
    answerRevealedAt: answerRevealedAt.value || Date.now(),
  })
  revealed.value = false
  answerRevealedAt.value = 0

  if (result?.mode === 'short-term' && result.waiting) {
    startWaitCountdown(result.waitSeconds || store.nextDueInSeconds)
  } else if (result?.mode === 'short-term' && result.graduated) {
    uni.showToast({ title: '今日初步掌握', icon: 'none' })
  } else {
    uni.showToast({ title: tips[state], icon: 'none' })
  }
  if (!store.sessionWaiting) await loadDictionary()
}

function resumeNow() {
  const ok = store.tryResumeShortTermSession()
  if (ok) {
    clearWaitTimer()
    loadDictionary()
  } else {
    startWaitCountdown(store.nextDueInSeconds)
    uni.showToast({ title: '还没到复习时间', icon: 'none' })
  }
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
  <view class="word-page" :class="{ 'word-page--revealed': revealed && !store.sessionWaiting }">
    <view class="word-topbar">
      <view v-if="store.shortTermSession" class="session-progress">
        <view class="session-progress__track">
          <view class="session-progress__fill" :style="{ width: `${sessionProgress.percent}%` }" />
          <text class="session-progress__text">{{ sessionProgress.done }}/{{ sessionProgress.total }}</text>
        </view>
      </view>
      <view
        class="ko-btn pressable"
        :class="{ 'ko-btn--on': store.isCurrentWordKo }"
        @tap.stop="markAsKo"
      >
        <text class="ko-btn__label">{{ store.isCurrentWordKo ? '已熟' : '熟' }}</text>
      </view>
    </view>

    <view v-if="store.sessionWaiting" class="wait-panel">
      <text class="wait-panel__title">本轮词都在间隔中</text>
      <text class="wait-panel__desc">
        今日目标里的词都学过一遍了，正在等巩固间隔。一般只有全部词都冷却完才会停一下。
      </text>
      <text class="wait-panel__clock">{{ waitLabel }}</text>
      <text class="wait-panel__meta">
        在学 {{ store.shortTermStats.learning }} · 已掌握 {{ store.shortTermStats.graduated }}
      </text>
      <button class="wait-panel__btn pressable" @tap="resumeNow">到点后点此继续</button>
    </view>

    <template v-else>
      <view class="word-hero">
        <view class="word-hero__word-anchor">
          <text
            class="word-hero__word"
            :style="{
              fontSize: `${pronunciation.displayMetrics.word}px`,
              lineHeight: `${pronunciation.displayMetrics.word}px`,
            }"
          >{{ store.currentWord.word }}</text>
          <view
            class="word-hero__sound pressable"
            :class="{ 'word-hero__sound--loading': playing || loading, 'word-hero__sound--playing': playing }"
            :style="{
              width: `${pronunciation.displayMetrics.icon}px`,
              height: `${pronunciation.displayMetrics.icon}px`,
            }"
            @tap.stop="pronounce"
          >
            <view
              class="wifi-wave"
              :style="{
                width: `${pronunciation.displayMetrics.icon}px`,
                height: `${pronunciation.displayMetrics.icon}px`,
              }"
            >
              <view class="wifi-wave__arc wifi-wave__arc--1" />
              <view class="wifi-wave__arc wifi-wave__arc--2" />
              <view class="wifi-wave__arc wifi-wave__arc--3" />
            </view>
          </view>
        </view>
        <view class="word-hero__phonetic-anchor">
          <text
            class="word-hero__phonetic"
            :style="{ fontSize: `${pronunciation.displayMetrics.phonetic}px` }"
          >{{ displayPhonetic || '音标待补充' }}</text>
          <text class="word-hero__accent">{{ pronunciation.accentTag }}</text>
        </view>
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
    </template>

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
  padding-bottom: calc(52px + env(safe-area-inset-bottom));
}

.word-page--revealed {
  /* 显示答案后：三态按钮 + 底部导航（52 + 56） */
  padding-bottom: calc(108px + env(safe-area-inset-bottom));
}

.word-topbar {
  position: absolute;
  z-index: 5;
  top: calc(env(safe-area-inset-top) + 28px);
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.session-progress {
  margin-right: auto;
  display: flex;
  align-items: center;
}

.session-progress__track {
  position: relative;
  width: 112px;
  height: 28px;
  overflow: hidden;
  border: 1.5px solid rgba(31, 77, 58, 0.35);
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.92);
}

.session-progress__fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, #d7e5dc, #9fbfab);
  border-radius: 999px;
  transition: width 220ms ease;
}

.session-progress__text {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #1f4d3a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.wait-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(env(safe-area-inset-top) + 72px) 28px 40px;
  box-sizing: border-box;
}

.wait-panel__title {
  color: #1f4d3a;
  font-size: 22px;
  font-weight: 800;
}

.wait-panel__desc {
  margin-top: 12px;
  color: #6e786f;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.wait-panel__clock {
  margin-top: 28px;
  color: #1f2421;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.wait-panel__meta {
  margin-top: 10px;
  color: #8b9288;
  font-size: 12px;
}

.wait-panel__btn {
  margin-top: 28px;
  width: 100%;
  max-width: 260px;
  height: 46px;
  color: #fff;
  background: #1f4d3a;
  border: 0;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  line-height: 46px;
}

.wait-panel__btn::after {
  border: 0;
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
  padding: calc(env(safe-area-inset-top) + 72px) 28px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: $paper;
  position: relative;
}

.word-hero__word-anchor {
  position: relative;
  display: inline-block;
}

.word-hero__word {
  display: block;
  color: $ink;
  font-size: 28px;
  line-height: 28px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-align: center;
}

.word-hero__sound {
  position: absolute;
  left: 100%;
  top: 50%;
  margin-left: 6px;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 朝右三层波浪：短 → 长，按容器比例居中 */
.wifi-wave {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wifi-wave__arc {
  position: absolute;
  top: 50%;
  left: 8%;
  border-style: solid;
  border-color: transparent $green transparent transparent;
  border-radius: 50%;
  box-sizing: border-box;
  transform: translateY(-50%);
}

.wifi-wave__arc--1 {
  width: 38%;
  height: 38%;
  border-width: 2px;
}

.wifi-wave__arc--2 {
  width: 62%;
  height: 62%;
  border-width: 2px;
}

.wifi-wave__arc--3 {
  width: 86%;
  height: 86%;
  border-width: 2.5px;
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

.word-hero__phonetic-anchor {
  position: relative;
  margin-top: 2px;
  display: inline-block;
}

.word-hero__accent {
  position: absolute;
  left: 100%;
  top: 50%;
  margin-left: 6px;
  transform: translateY(-50%);
  height: 20px;
  padding: 0 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f4d3a;
  background: rgba(31, 77, 58, 0.1);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.word-hero__phonetic {
  display: block;
  color: #8a9188;
  font-size: 15px;
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
  align-items: flex-start;
  gap: 6px;
  min-height: 26px;
  max-width: 100%;
}

.pos-sense__badge {
  flex: none;
  width: 22px;
  height: 22px;
  /* 与释义首行（line-height:26）视觉居中对齐 */
  margin-top: 2px;
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
  /* 紧贴底部导航（52px），消除中间空隙 */
  bottom: calc(52px + env(safe-area-inset-bottom));
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
