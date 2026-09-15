<script setup lang="ts">
type NavKey = 'home' | 'semantic' | 'scan' | 'sentence' | 'profile'

const props = defineProps<{ active: NavKey }>()

const items: Array<{ key: NavKey; label: string; icon: string; url: string }> = [
  { key: 'home', label: '首页', icon: '⌂', url: '/pages/home/index' },
  { key: 'semantic', label: '学习', icon: '◫', url: '/pages/semantic/index' },
  { key: 'scan', label: '拍词', icon: '◎', url: '/pages/scan/index' },
  { key: 'sentence', label: '句子', icon: '≡', url: '/pages/sentence/index' },
  { key: 'profile', label: '我的', icon: '○', url: '/pages/profile/index' },
]

function navigate(key: NavKey, url: string) {
  if (key === props.active) return
  uni.redirectTo({ url })
}
</script>

<template>
  <view class="bottom-nav">
    <view
      v-for="item in items"
      :key="item.key"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--active': item.key === active }"
      @tap="navigate(item.key, item.url)"
    >
      <text class="bottom-nav__icon">{{ item.icon }}</text>
      <text class="bottom-nav__label">{{ item.label }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  z-index: 20;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(56px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #fffdf8;
  border-top: 1px solid #e0dccf;
  box-sizing: border-box;
}

.bottom-nav__item {
  flex: 1;
  height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #899087;
}

.bottom-nav__item--active {
  color: #1f4d3a;
}

.bottom-nav__icon {
  font-size: 20px;
  line-height: 22px;
}

.bottom-nav__label {
  margin-top: 2px;
  font-size: 10px;
  line-height: 14px;
}
</style>
