<script setup lang="ts">
type NavKey = 'home' | 'semantic' | 'scan' | 'sentence' | 'profile'

const props = defineProps<{ active: NavKey }>()

const items: Array<{
  key: NavKey
  label: string
  glyph?: string
  icon?: string
  iconStyle?: { width: string; height: string }
  url: string
}> = [
  { key: 'home', label: '首页', glyph: '⌂', url: '/pages/home/index' },
  { key: 'semantic', label: '学习', glyph: '◫', url: '/pages/semantic/index' },
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
    iconStyle: { width: '15px', height: '11px' },
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
      <view class="bottom-nav__icon-slot">
        <view
          v-if="item.icon"
          class="bottom-nav__glyph"
          :style="{
            width: item.iconStyle?.width,
            height: item.iconStyle?.height,
            '-webkit-mask-image': `url(${item.icon})`,
            'mask-image': `url(${item.icon})`,
          }"
        />
        <text v-else class="bottom-nav__icon">{{ item.glyph }}</text>
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

.bottom-nav__icon {
  width: 18px;
  height: 18px;
  font-size: 18px;
  line-height: 18px;
  text-align: center;
}

.bottom-nav__glyph {
  flex: none;
  background-color: #6b6e66;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.bottom-nav__item--active .bottom-nav__glyph {
  background-color: #1f4d3a;
}

.bottom-nav__label {
  margin-top: 2px;
  font-size: 10px;
  line-height: 14px;
}
</style>
