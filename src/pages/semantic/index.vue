<script setup lang="ts">
import BottomNav from '@/components/BottomNav.vue'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()

function openDomain(name: string) {
  uni.showToast({ title: `进入：${name}`, icon: 'none' })
}

function go(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="screen semantic-screen">
    <text class="page-title semantic-title">语义地图</text>
    <text class="page-subtitle">用“位置”记住单词，而不是孤立地背诵</text>
    <text class="semantic-path">一级大类 → 二级方向 → 三级语义槽 → 单词</text>

    <view class="learning-tools">
      <view class="learning-tool learning-tool--book card pressable" @tap="go('/pages/books/index')">
        <view>
          <text class="learning-tool__tag">当前词书</text>
          <text class="learning-tool__title">{{ store.activeBook.title }}</text>
          <text class="learning-tool__desc">{{ store.activeBookProgress.learned }} / {{ store.bookTotals[store.selectedBookId] }} 词</text>
        </view>
        <view class="learning-tool__icon">▤</view>
      </view>
      <view class="learning-tool card pressable" @tap="go('/pages/books/index')">
        <text class="learning-tool__title">我的词书</text>
        <text class="learning-tool__desc">4 本 · 可切换学习</text>
      </view>
      <view class="learning-tool card pressable" @tap="go('/pages/word/index')">
        <text class="learning-tool__title">复习中心</text>
        <text class="learning-tool__desc">{{ store.reviewCount }} 个待复习</text>
      </view>
    </view>

    <text class="section-title domain-section-title">12 大语义域</text>

    <view class="domain-list">
      <view
        v-for="domain in store.domains"
        :key="domain.id"
        class="domain-row pressable"
        :class="{ 'domain-row--locked': !domain.explored }"
        @tap="openDomain(domain.name)"
      >
        <view class="domain-row__main">
          <text class="domain-row__icon">{{ domain.icon }}</text>
          <text class="domain-row__name">{{ domain.name }}</text>
        </view>
        <text class="domain-row__status">{{ domain.explored ? '已探索' : '未开始' }}</text>
      </view>
    </view>

    <BottomNav active="semantic" />
  </view>
</template>

<style scoped lang="scss">
.semantic-screen {
  padding-top: calc(env(safe-area-inset-top) + 38px);
  overflow-x: hidden;
}

.semantic-title {
  margin-top: 0;
}

.semantic-path {
  display: block;
  margin-top: 18px;
  color: #3d7564;
  font-size: 11px;
  line-height: 18px;
}

.learning-tools { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.learning-tool { min-height: 86px; padding: 15px; display: flex; flex-direction: column; justify-content: center; }
.learning-tool--book { grid-column: 1 / -1; min-height: 105px; flex-direction: row; align-items: center; justify-content: space-between; color: #fff; background: linear-gradient(135deg,#1f4d3a,#3d7564); border: 0; }
.learning-tool__tag,.learning-tool__title,.learning-tool__desc { display: block; }
.learning-tool__tag { color: #d7e2d9; font-size: 9px; }
.learning-tool__title { font-size: 14px; font-weight: 700; }
.learning-tool--book .learning-tool__title { margin-top: 6px; font-size: 18px; }
.learning-tool__desc { margin-top: 7px; color: #79827a; font-size: 10px; }
.learning-tool--book .learning-tool__desc { color: #d7e2d9; }
.learning-tool__icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: #1f4d3a; background: #fffdf8; border-radius: 16px; font-size: 24px; }
.domain-section-title { margin-top: 27px; }

.domain-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.domain-row {
  height: 42px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fffdf8;
  border: 1px solid #e0dccf;
  border-radius: 14px;
}

.domain-row--locked {
  background: rgba(255, 253, 248, 0.5);
}

.domain-row__main {
  display: flex;
  align-items: center;
}

.domain-row__icon {
  width: 25px;
  color: #3d7564;
  font-size: 17px;
  text-align: center;
}

.domain-row__name {
  margin-left: 8px;
  color: #1f2421;
  font-size: 13px;
  font-weight: 600;
}

.domain-row__status {
  color: #7f897f;
  font-size: 10px;
}

.domain-row:not(.domain-row--locked) .domain-row__status {
  color: #3d7564;
}
</style>
