<script setup lang="ts">
defineProps<{
  title: string
}>()

const emit = defineEmits<{
  back: []
}>()

function onBack() {
  emit('back')
}
</script>

<template>
  <view class="page-header">
    <view class="page-header__back pressable" @tap="onBack">
      <text class="page-header__back-icon">‹</text>
    </view>
    <text class="page-header__title">{{ title }}</text>
    <view class="page-header__right">
      <slot name="right">
        <view class="page-header__space" />
      </slot>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page-header {
  position: relative;
  height: 44px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.page-header__back,
.page-header__space {
  width: 36px;
  height: 36px;
  flex: none;
}

.page-header__back {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding-bottom: 2px;
}

.page-header__back-icon {
  color: #1f4d3a;
  font-size: 28px;
  line-height: 1;
}

.page-header__title {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  line-height: 44px;
  color: #1f2421;
  pointer-events: none;
}

.page-header__right {
  z-index: 1;
  min-width: 36px;
  height: 36px;
  flex: none;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
