<script setup lang="ts">
import BottomNav from '@/components/BottomNav.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const menus = ['学习档案', '我的词书', '发音设置', '拍词记录', '学习目标', '设置']

function openMenu(name: string) {
  if (name === '我的词书') {
    uni.navigateTo({ url: '/pages/books/index' })
    return
  }
  if (name === '发音设置') {
    uni.navigateTo({ url: '/pages/pronunciation-settings/index' })
    return
  }
  if (name === '拍词记录') {
    uni.navigateTo({ url: '/pages/scan-history/index' })
    return
  }
  uni.showToast({ title: `${name}待接入`, icon: 'none' })
}
</script>

<template>
  <view class="screen profile-screen">
    <text class="page-title profile-title">我的</text>
    <text class="page-subtitle">学习档案与个人设置</text>

    <view class="profile-head">
      <BrandLogo :size="58" />
      <view class="profile-head__text">
        <text class="profile-head__name">英语学习者</text>
        <text class="profile-head__goal">当前目标：考研英语 · 四六级词汇</text>
      </view>
    </view>

    <view class="stats-card card">
      <view class="stat-item">
        <text class="stat-item__value">{{ store.masteredCount }}</text>
        <text class="stat-item__label">已掌握</text>
      </view>
      <view class="stat-divider" />
      <view class="stat-item">
        <text class="stat-item__value">{{ store.streakDays }}</text>
        <text class="stat-item__label">连续天数</text>
      </view>
      <view class="stat-divider" />
      <view class="stat-item">
        <text class="stat-item__value">{{ store.exploredCount }}/12</text>
        <text class="stat-item__label">语义域</text>
      </view>
    </view>

    <view class="menu-list">
      <view v-for="menu in menus" :key="menu" class="menu-row card pressable" @tap="openMenu(menu)">
        <text>{{ menu }}</text>
        <text class="menu-row__arrow">›</text>
      </view>
    </view>

    <BottomNav active="profile" />
  </view>
</template>

<style scoped lang="scss">
.profile-screen {
  padding-top: calc(env(safe-area-inset-top) + 38px);
}

.profile-title {
  margin-top: 0;
}

.profile-head {
  margin-top: 26px;
  display: flex;
  align-items: center;
}

.profile-head__text {
  margin-left: 16px;
  display: flex;
  flex-direction: column;
}

.profile-head__name {
  color: #1f2421;
  font-size: 18px;
  font-weight: 700;
}

.profile-head__goal {
  margin-top: 6px;
  color: #6e786f;
  font-size: 11px;
}

.stats-card {
  height: 112px;
  margin-top: 28px;
  padding: 20px 16px;
  display: grid;
  grid-template-columns: 1fr 1px 1fr 1px 1fr;
  align-items: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-item__value {
  color: #1f4d3a;
  font-size: 23px;
  font-weight: 700;
}

.stat-item__label {
  margin-top: 7px;
  color: #6e786f;
  font-size: 10px;
}

.stat-divider {
  width: 1px;
  height: 44px;
  background: #e0dccf;
}

.menu-list {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-row {
  height: 54px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #1f2421;
  font-size: 14px;
  font-weight: 600;
}

.menu-row__arrow {
  color: #8b938b;
  font-size: 22px;
}
</style>
