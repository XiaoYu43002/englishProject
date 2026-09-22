<script setup lang="ts">
import { ref } from 'vue'
import AppModal from '@/components/AppModal.vue'
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

const previewVisible = ref(false)

function back() {
  uni.navigateBack()
}

function openPreview() {
  previewVisible.value = true
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

    <view class="setting-row card pressable" @tap="openPreview">
      <text class="setting-row__label">弹窗模板预览</text>
      <text class="setting-row__arrow">›</text>
    </view>

    <AppModal
      v-model:visible="previewVisible"
      title="请确认"
      content="请确认阅读并同意用户协议与隐私政策。这是统一弹窗模板预览：标题居中，正文左对齐，底部为取消 / 确认。"
      confirm-text="确认"
      cancel-text="取消"
    />

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
  margin-top: 5px;
  min-height: 44px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 12px;
}

.setting-row:first-of-type {
  margin-top: 12px;
}

.setting-row--dim {
  opacity: 0.45;
}

.setting-row__label {
  color: #3a403c;
  font-size: 14px;
  font-weight: 500;
}

.setting-row__arrow {
  color: #9aa39b;
  font-size: 18px;
  line-height: 1;
}

.segment {
  flex: none;
  display: flex;
  align-items: center;
  padding: 2px;
  background: #eceae4;
  border-radius: 9px;
}

.segment__item {
  min-width: 48px;
  height: 26px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: #5c635e;
  font-size: 12px;
}

.segment__item--on {
  color: #1f2421;
  background: #fff;
  box-shadow: 0 1px 3px rgba(31, 36, 33, 0.12);
  font-weight: 600;
}
</style>
