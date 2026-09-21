<script setup lang="ts">
type NavKey = 'home' | 'semantic' | 'scan' | 'sentence' | 'profile'

const props = defineProps<{ active: NavKey }>()

const items: Array<{
  key: NavKey
  label: string
  icon: string
  iconStyle: { width: string; height: string }
  url: string
}> = [
  {
    key: 'home',
    label: '首页',
    icon: '/static/icons/nav-home.svg',
    iconStyle: { width: '18px', height: '18px' },
    url: '/pages/home/index',
  },
  {
    key: 'semantic',
    label: '学习',
    icon: '/static/icons/nav-books.svg',
    iconStyle: { width: '14px', height: '14px' },
    url: '/pages/semantic/index',
  },
  {
    key: 'scan',
    label: '拍词',
    icon: '/static/icons/nav-scan.svg',
    iconStyle: { width: '18px', height: '18px' },
    url: '/pages/scan/index',
  },
  {
    key: 'sentence',
    label: '句子',
    icon: '/static/icons/nav-sentence.svg',
    iconStyle: { width: '14px', height: '14px' },
    url: '/pages/sentence/index',
  },
  {
    key: 'profile',
    label: '我的',
    icon: '/static/icons/nav-profile.svg',
    iconStyle: { width: '18px', height: '18px' },
    url: '/pages/profile/index',
  },
]

function currentRoute() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as { route?: string } | undefined
  return current?.route ? `/${current.route}` : ''
}

function navigate(url: string) {
  const route = currentRoute()
  if (route === url) return

  const pages = getCurrentPages()
  const target = url.replace(/^\//, '')
  const index = pages.findIndex((page) => page.route === target)
  if (index >= 0 && index < pages.length - 1) {
    uni.navigateBack({ delta: pages.length - 1 - index })
    return
  }
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
      @tap="navigate(item.url)"
    >
      <view class="bottom-nav__icon-slot">
        <image
          class="bottom-nav__image"
          :class="{ 'bottom-nav__image--active': item.key === active }"
          :src="item.icon"
          :style="item.iconStyle"
          mode="aspectFit"
        />
      </view>
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
  height: calc(52px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  background: #fffdf8;
  border-top: 1px solid #e0dccf;
  box-sizing: border-box;
}

.bottom-nav__item {
  width: 62px;
  height: 52px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b6e66;
}

.bottom-nav__item--active {
  color: #1f4d3a;
}

.bottom-nav__icon-slot {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav__image {
  flex: none;
  opacity: 0.72;
}

.bottom-nav__image--active {
  opacity: 1;
}

.bottom-nav__label {
  margin-top: 2px;
  font-size: 10px;
  line-height: 14px;
}
</style>
