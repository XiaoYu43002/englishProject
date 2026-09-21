<script setup lang="ts">
import { computed } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const menus = ['学习档案', '我的词书', '发音设置', '拍词记录', '学习计划', '更多设置']

const displayName = computed(() => {
  const user = store.authUser
  return user?.nickname || user?.phone || (store.isLoggedIn ? '已登录用户' : '英语学习者')
})

const loginHint = computed(() => {
  if (!store.isLoggedIn) return '未登录'
  if (store.loginMethod === 'wechat') return '微信登录'
  if (store.loginMethod === 'phone') return '手机号登录'
  return '已登录'
})

const planHint = computed(
  () => `${store.activeBook.shortTitle} · 每日新学 ${store.todayTarget} 词`,
)

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
  if (name === '学习计划' || name === '学习目标') {
    uni.navigateTo({ url: '/pages/learning-plan/index' })
    return
  }
  if (name === '更多设置') {
    uni.navigateTo({ url: '/pages/more-settings/index' })
    return
  }
  uni.showToast({ title: `${name}待接入`, icon: 'none' })
}

function handleLogout() {
  if (!store.isLoggedIn) {
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号吗？本地学习进度仍会保留在本机。',
    success: (res) => {
      if (!res.confirm) return
      store.logout()
      uni.redirectTo({ url: '/pages/login/index' })
    },
  })
}
</script>

<template>
  <view class="screen profile-screen">
    <text class="page-title profile-title">我的</text>
    <text class="page-subtitle">学习档案与个人设置</text>

    <view class="profile-head">
      <BrandLogo :size="58" />
      <view class="profile-head__text">
        <text class="profile-head__name">{{ displayName }}</text>
        <text class="profile-head__goal">{{ loginHint }} · {{ planHint }}</text>
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
        <image class="menu-row__arrow" src="/static/icons/chevron-right.svg" mode="aspectFit" />
      </view>
      <view class="menu-row card pressable menu-row--logout" @tap="handleLogout">
        <text>{{ store.isLoggedIn ? '退出登录' : '去登录' }}</text>
        <image class="menu-row__arrow" src="/static/icons/chevron-right.svg" mode="aspectFit" />
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
  width: 18px;
  height: 18px;
  flex: none;
}

.menu-row--logout {
  color: #9a6b5c;
}
</style>
