<script setup lang="ts">
import BottomNav from '@/components/BottomNav.vue'
</script>

<template>
  <view class="screen sentence-screen">
    <text class="page-title sentence-title">每日一句</text>
    <text class="page-subtitle">今天 · 考研长难句</text>
    <text class="day-chip">DAY 018</text>

    <text class="sentence-hero">The ability to perceive change often matters more than the speed at which we react to it.</text>

    <view class="parse-card card">
      <text class="parse-card__title">拆句理解</text>
      <view class="parse-item">
        <text class="parse-item__en">① The ability to perceive change</text>
        <text class="parse-item__cn">感知变化的能力</text>
      </view>
      <view class="parse-item">
        <text class="parse-item__en">② often matters more than</text>
        <text class="parse-item__cn">往往比……更重要</text>
      </view>
      <view class="parse-item">
        <text class="parse-item__en">③ the speed at which we react to it</text>
        <text class="parse-item__cn">我们对此作出反应的速度</text>
      </view>
    </view>

    <text class="more-sentences">查看其他句子 →</text>
    <BottomNav active="sentence" />
  </view>
</template>

<style scoped lang="scss">
.sentence-screen {
  padding-top: calc(env(safe-area-inset-top) + 38px);
}

.sentence-title {
  margin-top: 0;
}

.day-chip {
  display: inline-flex;
  margin-top: 28px;
  padding: 9px 12px;
  color: #1f4d3a;
  background: #eef1e8;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
}

.sentence-hero {
  display: block;
  margin-top: 20px;
  color: #1f2421;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 24px;
  line-height: 1.45;
  font-weight: 600;
}

.parse-card {
  margin-top: 44px;
  padding: 20px;
}

.parse-card__title {
  display: block;
  font-size: 16px;
  font-weight: 700;
}

.parse-item {
  margin-top: 16px;
}

.parse-item__en,
.parse-item__cn {
  display: block;
}

.parse-item__en {
  color: #1f2421;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.parse-item__cn {
  margin-top: 4px;
  color: #6e786f;
  font-size: 11px;
}

.more-sentences {
  display: block;
  margin-top: 24px;
  color: #3d7564;
  font-size: 13px;
  text-align: right;
}
</style>
