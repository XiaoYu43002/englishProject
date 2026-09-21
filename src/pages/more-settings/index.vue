<script setup lang="ts">
import BottomNav from '@/components/BottomNav.vue'
import {
  DISPLAY_SIZE_PRESETS,
  usePronunciationStore,
  type DisplaySize,
} from '@/stores/pronunciation'

const pronunciation = usePronunciationStore()
const sizeOptions = (Object.keys(DISPLAY_SIZE_PRESETS) as DisplaySize[]).map((id) => ({
  id,
  label: DISPLAY_SIZE_PRESETS[id].label,
}))

function back() {
  uni.navigateBack()
}
</script>

<template>
  <view class="screen settings-screen">
    <view class="settings-header">
      <view class="settings-header__back pressable" @tap="back">‹</view>
      <text class="settings-header__title">更多设置</text>
      <view class="settings-header__space" />
    </view>

    <view class="setting-row card">
      <text class="setting-row__label">发音显示</text>
      <view class="segment">
        <view
          class="segment__item"
          :class="{ 'segment__item--on': !pronunciation.accentTagVisible }"
          @tap="pronunciation.setAccentTagVisible(false)"
        >
          <text>隐藏</text>
        </view>
        <view
          class="segment__item"
          :class="{ 'segment__item--on': pronunciation.accentTagVisible }"
          @tap="pronunciation.setAccentTagVisible(true)"
        >
          <text>显示</text>
        </view>
      </view>
    </view>

    <view class="setting-row card" :class="{ 'setting-row--dim': !pronunciation.accentTagVisible }">
      <text class="setting-row__label">英文简称</text>
      <view class="segment">
        <view
          class="segment__item"
          :class="{ 'segment__item--on': pronunciation.accentTagStyle !== 'en' }"
          @tap="pronunciation.setAccentTagStyle('zh')"
        >
          <text>隐藏</text>
        </view>
        <view
          class="segment__item"
          :class="{ 'segment__item--on': pronunciation.accentTagStyle === 'en' }"
          @tap="pronunciation.setAccentTagStyle('en')"
        >
          <text>显示</text>
        </view>
      </view>
    </view>

    <view class="setting-row card">
      <text class="setting-row__label">字号大小</text>
      <view class="segment">
        <view
          v-for="item in sizeOptions"
          :key="item.id"
          class="segment__item"
          :class="{ 'segment__item--on': pronunciation.displaySize === item.id }"
          @tap="pronunciation.setDisplaySize(item.id)"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>
    </view>

    <BottomNav active="profile" />
  </view>
</template>

<style scoped lang="scss">
.settings-screen {
  padding-top: calc(env(safe-area-inset-top) + 18px);
  padding-bottom: 116px;
}

.settings-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-header__back,
.settings-header__space {
  width: 36px;
  height: 36px;
  flex: none;
}

.settings-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f4d3a;
  font-size: 28px;
  line-height: 1;
  padding-bottom: 2px;
}

.settings-header__title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  line-height: 36px;
  color: #1f2421;
}

.setting-row {
  margin-top: 16px;
  min-height: 56px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setting-row--dim {
  opacity: 0.45;
}

.setting-row__label {
  color: #3a403c;
  font-size: 15px;
  font-weight: 500;
}

.segment {
  flex: none;
  display: flex;
  align-items: center;
  padding: 3px;
  background: #eceae4;
  border-radius: 10px;
}

.segment__item {
  min-width: 52px;
  height: 30px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #5c635e;
  font-size: 13px;
}

.segment__item--on {
  color: #1f2421;
  background: #fff;
  box-shadow: 0 1px 3px rgba(31, 36, 33, 0.12);
  font-weight: 600;
}
</style>
