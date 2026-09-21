<script setup lang="ts">
import BottomNav from '@/components/BottomNav.vue'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()

function go(url: string) {
  uni.navigateTo({ url })
}

function continueLearning() {
  const result = store.startTodayLearning()
  if (!result.ok && result.reason === 'no-words') {
    uni.showToast({ title: '当前词书暂无可学新词', icon: 'none' })
    return
  }
  if (!result.ok && result.reason === 'waiting') {
    const sec = 'waitSeconds' in result ? result.waitSeconds : 0
    uni.showToast({
      title: sec ? `约 ${sec} 秒后可继续巩固` : '间隔巩固中，稍候',
      icon: 'none',
    })
  }
  go('/pages/word/index')
}
</script>

<template>
  <view class="screen home-screen">
    <text class="home-greeting">下午好，继续今天的学习</text>
    <text class="home-title">今天，先掌握 {{ store.todayTarget }} 个词</text>
    <view class="home-plan" @tap="go('/pages/learning-plan/index')">
      <text>{{ store.activeBook.shortTitle }} · 调整学习计划</text>
      <image class="home-plan__arrow" src="/static/icons/chevron-right.svg" mode="aspectFit" />
    </view>

    <view class="today-card card">
      <text class="today-card__label">今日计划</text>
      <view class="today-card__main">
        <text class="today-card__number">{{ store.remaining }}</text>
        <text class="today-card__unit">个待巩固</text>
      </view>
      <text class="today-card__review">已初步掌握 {{ store.shortTermStats.graduated }} · 在学 {{ store.shortTermStats.learning }}</text>
      <button class="today-card__button pressable" @tap="continueLearning">继续学习 →</button>
    </view>

    <view class="feature-grid">
      <view class="feature-card card pressable" @tap="go('/pages/semantic/index')">
        <text class="feature-card__title">语义地图</text>
        <text class="feature-card__desc">12 大语义域<br />已探索 {{ store.exploredCount }} 个</text>
        <text class="feature-card__metric">◌ {{ Math.round((store.exploredCount / 12) * 100) }}%</text>
      </view>
      <view class="feature-card card pressable" @tap="go('/pages/books/index')">
        <text class="feature-card__title">我的词书</text>
        <text class="feature-card__desc">{{ store.activeBook.shortTitle }}<br />已学习 {{ store.activeBookProgress.learned }} 词</text>
        <text class="feature-card__metric feature-card__metric--scan">▤</text>
      </view>
    </view>

    <view class="scan-strip card pressable" @tap="go('/pages/scan/index')">
      <view><text class="scan-strip__title">拍照加词</text><text class="scan-strip__desc">拍下不会的词，确认后加入学习计划</text></view>
      <text class="scan-strip__icon">◎</text>
    </view>

    <view class="sentence-card card pressable" @tap="go('/pages/sentence/index')">
      <text class="sentence-card__label">每日一句</text>
      <text class="sentence-card__en">“Small steps still move you forward.”</text>
      <text class="sentence-card__cn">微小的步伐，也在让你向前。</text>
    </view>

    <BottomNav active="home" />
  </view>
</template>

<style scoped lang="scss">
.home-screen {
  padding-top: calc(env(safe-area-inset-top) + 42px);
}

.home-greeting {
  display: block;
  color: #6e786f;
  font-size: 14px;
}

.home-title {
  display: block;
  margin-top: 7px;
  color: #1f2421;
  font-size: 27px;
  line-height: 38px;
  font-weight: 700;
}

.home-plan {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  color: #3d7564;
  font-size: 13px;
  font-weight: 600;
}

.home-plan__arrow {
  width: 16px;
  height: 16px;
  flex: none;
}

.today-card {
  height: 160px;
  margin-top: 20px;
  padding: 20px;
  position: relative;
  background: linear-gradient(135deg, #1f4d3a, #326854);
  border: 0;
  color: #fff;
}

.today-card__label {
  display: block;
  color: #dbe6dc;
  font-size: 13px;
}

.today-card__main {
  margin-top: 3px;
  display: flex;
  align-items: baseline;
}

.today-card__number {
  font-size: 50px;
  line-height: 62px;
  font-weight: 700;
}

.today-card__unit {
  margin-left: 10px;
  color: #eef5ef;
  font-size: 14px;
}

.today-card__review {
  display: block;
  color: #dbe6dc;
  font-size: 12px;
}

.today-card__button {
  position: absolute;
  right: 14px;
  bottom: 14px;
  width: 112px;
  height: 42px;
  line-height: 42px;
  color: #1f4d3a;
  background: #fffdf8;
  border-radius: 15px;
  font-size: 13px;
  font-weight: 600;
}

.feature-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.feature-card {
  height: 126px;
  padding: 16px;
}

.feature-card__title,
.feature-card__desc,
.feature-card__metric {
  display: block;
}

.feature-card__title {
  color: #1f2421;
  font-size: 16px;
  font-weight: 700;
}

.feature-card__desc {
  margin-top: 9px;
  color: #6e786f;
  font-size: 11px;
  line-height: 17px;
}

.feature-card__metric {
  margin-top: 6px;
  color: #3d7564;
  font-size: 18px;
  font-weight: 600;
}

.feature-card__metric--scan {
  font-size: 26px;
}

.sentence-card {
  height: 124px;
  margin-top: 20px;
  padding: 17px;
}

.scan-strip { min-height: 68px; margin-top: 15px; padding: 14px 17px; display: flex; align-items: center; justify-content: space-between; }
.scan-strip__title,.scan-strip__desc { display: block; }
.scan-strip__title { font-size: 14px; font-weight: 700; }
.scan-strip__desc { margin-top: 5px; color: #6e786f; font-size: 10px; }
.scan-strip__icon { color: #3d7564; font-size: 28px; }

.sentence-card__label,
.sentence-card__en,
.sentence-card__cn {
  display: block;
}

.sentence-card__label {
  color: #1f4d3a;
  font-size: 13px;
  font-weight: 700;
}

.sentence-card__en {
  margin-top: 10px;
  color: #1f2421;
  font-size: 14px;
  font-weight: 600;
}

.sentence-card__cn {
  margin-top: 8px;
  color: #6e786f;
  font-size: 12px;
}
</style>
