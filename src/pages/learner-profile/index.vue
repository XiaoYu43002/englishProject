<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import { onLoad, onReady } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader.vue'
import { useLearnerProfileStore } from '@/stores/learnerProfile'
import {
  GOAL_OPTIONS,
  IDENTITY_OPTIONS,
  IMPROVE_OPTIONS,
  examsForIdentity,
  type ExamTarget,
  type ImproveFocus,
  type LearnerGoal,
  type LearnerIdentity,
} from '@/types/learnerProfile'

const profile = useLearnerProfileStore()
const instance = getCurrentInstance()
const step = ref(0)
const fromMenu = ref(false)
const swiperHeightPx = ref(520)

const progressPercent = computed(() => Math.round(((step.value + 1) / 3) * 100))
const examOptions = computed(() => examsForIdentity(profile.identity))
const step3Title = computed(() =>
  profile.goal === 'self-improve' ? '你想提升的方向是？' : '你希望通过的考试是？',
)
const step3Options = computed(() =>
  profile.goal === 'self-improve' ? IMPROVE_OPTIONS : examOptions.value,
)
const step3Selected = computed(() =>
  profile.goal === 'self-improve' ? profile.improveFocus : profile.examTarget,
)

function measureSwiper() {
  const sys = uni.getSystemInfoSync()
  const fallback = Math.max(420, sys.windowHeight - 90)
  swiperHeightPx.value = fallback

  nextTick(() => {
    const query = uni.createSelectorQuery()
    // #ifndef H5
    query.in(instance?.proxy as any)
    // #endif
    query
      .select('.profile-flow__stage')
      .boundingClientRect((rect) => {
        const box = Array.isArray(rect) ? rect[0] : rect
        if (box?.height && box.height > 200) {
          swiperHeightPx.value = Math.floor(box.height)
        }
      })
      .exec()
  })
}

onLoad((options) => {
  fromMenu.value = String(options?.from || '') === 'menu'
  if (profile.identity) step.value = Math.max(step.value, 1)
  if (profile.goal) step.value = Math.max(step.value, 2)
  measureSwiper()
})

onReady(() => {
  measureSwiper()
  setTimeout(measureSwiper, 50)
})

function onSwiperChange(event: { detail?: { current?: number } }) {
  step.value = Number(event.detail?.current || 0)
}

function goStep(index: number) {
  step.value = Math.max(0, Math.min(2, index))
}

function finish(mode: 'home' | 'books' | 'back' = 'home') {
  if (mode === 'back') {
    uni.navigateBack()
    return
  }
  if (mode === 'books') {
    uni.redirectTo({ url: '/pages/books/index?from=onboarding' })
    return
  }
  uni.redirectTo({ url: '/pages/home/index' })
}

function back() {
  if (step.value > 0) {
    goStep(step.value - 1)
    return
  }
  if (fromMenu.value) {
    uni.navigateBack()
    return
  }
  uni.redirectTo({ url: '/pages/home/index' })
}

function skip() {
  profile.markSkipped()
  finish(fromMenu.value ? 'back' : 'home')
}

function selectIdentity(id: LearnerIdentity) {
  profile.setIdentity(id)
  setTimeout(() => goStep(1), 180)
}

function selectGoal(id: LearnerGoal) {
  profile.setGoal(id)
  setTimeout(() => goStep(2), 180)
}

function selectStep3(id: string) {
  if (profile.goal === 'self-improve') {
    profile.setImproveFocus(id as ImproveFocus)
  } else {
    if (!profile.goal) profile.setGoal('exam')
    profile.setExamTarget(id as ExamTarget)
  }
  profile.markCompleted()
  setTimeout(() => finish(fromMenu.value ? 'back' : 'books'), 220)
}
</script>

<template>
  <view class="profile-flow">
    <view class="profile-flow__header">
      <PageHeader title="学习档案" @back="back">
        <template #right>
          <view class="profile-flow__skip pressable" @tap="skip">
            <text class="profile-flow__skip-text">跳过</text>
          </view>
        </template>
      </PageHeader>
    </view>

    <view class="profile-flow__progress">
      <view class="profile-flow__progress-fill" :style="{ width: `${progressPercent}%` }" />
    </view>

    <view class="profile-flow__stage">
      <swiper
        class="profile-flow__swiper"
        :style="{ height: `${swiperHeightPx}px` }"
        :current="step"
        :duration="280"
        @change="onSwiperChange"
      >
        <swiper-item>
          <scroll-view
            scroll-y
            class="profile-flow__scroll"
            :style="{ height: `${swiperHeightPx}px` }"
            :show-scrollbar="false"
          >
            <view class="profile-flow__page">
              <text class="profile-flow__question">你目前的身份是？</text>
              <view class="chip-wrap chip-wrap--stack">
                <view
                  v-for="item in IDENTITY_OPTIONS"
                  :key="item.id"
                  class="chip chip--block pressable"
                  :class="{ 'chip--on': profile.identity === item.id }"
                  @tap="selectIdentity(item.id)"
                >
                  <text class="chip__text">{{ item.label }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </swiper-item>

        <swiper-item>
          <scroll-view
            scroll-y
            class="profile-flow__scroll"
            :style="{ height: `${swiperHeightPx}px` }"
            :show-scrollbar="false"
          >
            <view class="profile-flow__page">
              <text class="profile-flow__question">你目前的学习目标是？</text>
              <view class="chip-wrap chip-wrap--stack">
                <view
                  v-for="item in GOAL_OPTIONS"
                  :key="item.id"
                  class="chip chip--block pressable"
                  :class="{ 'chip--on': profile.goal === item.id }"
                  @tap="selectGoal(item.id)"
                >
                  <text class="chip__text">{{ item.label }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </swiper-item>

        <swiper-item>
          <scroll-view
            scroll-y
            class="profile-flow__scroll"
            :style="{ height: `${swiperHeightPx}px` }"
            :show-scrollbar="false"
          >
            <view class="profile-flow__page">
              <text class="profile-flow__question">{{ step3Title }}</text>
              <view class="chip-wrap chip-wrap--tags">
                <view
                  v-for="item in step3Options"
                  :key="item.id"
                  class="chip chip--tag pressable"
                  :class="{ 'chip--on': step3Selected === item.id }"
                  @tap="selectStep3(item.id)"
                >
                  <text class="chip__text">{{ item.label }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </swiper-item>
      </swiper>
    </view>
  </view>
</template>

<style scoped lang="scss">
.profile-flow {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #e7f2ec 0%, #f3f6ef 42%, #f8f5e9 100%);
  box-sizing: border-box;
  overflow: hidden;
}

.profile-flow__header {
  flex: none;
  padding: calc(env(safe-area-inset-top) + 10px) 16px 10px;
}

.profile-flow__skip {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.profile-flow__skip-text {
  padding: 6px 12px;
  color: #6e786f;
  background: rgba(255, 253, 248, 0.88);
  border: 1px solid #e0dccf;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.profile-flow__progress {
  flex: none;
  height: 3px;
  margin: 0 0 4px;
  background: rgba(31, 77, 58, 0.12);
  overflow: hidden;
}

.profile-flow__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1f4d3a, #3d7564);
  transition: width 240ms ease;
}

.profile-flow__stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}

.profile-flow__swiper {
  width: 100%;
}

.profile-flow__scroll {
  width: 100%;
}

.profile-flow__page {
  padding: 28px 24px calc(env(safe-area-inset-bottom) + 48px);
  box-sizing: border-box;
}

.profile-flow__question {
  display: block;
  color: #1f2421;
  font-size: 26px;
  line-height: 36px;
  font-weight: 800;
}

.chip-wrap {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip-wrap--stack {
  flex-direction: column;
  flex-wrap: nowrap;
}

.chip-wrap--tags {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 10px;
}

.chip {
  min-height: 42px;
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  background: #fffdf8;
  border: 1px solid #e4e0d4;
  border-radius: 999px;
  box-sizing: border-box;
  box-shadow: 0 3px 10px rgba(31, 77, 58, 0.05);
}

.chip--block {
  width: 100%;
  justify-content: flex-start;
  border-radius: 14px;
  padding: 14px 16px;
}

.chip--tag {
  width: auto;
  max-width: 100%;
  justify-content: center;
  border-radius: 999px;
  padding: 11px 18px;
}

.chip--on {
  background: #1f4d3a;
  border-color: #1f4d3a;
}

.chip__text {
  color: #4a524c;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.chip--on .chip__text {
  color: #fffdf8;
}
</style>
