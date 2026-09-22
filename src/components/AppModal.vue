<script setup lang="ts">
withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    content?: string
    confirmText?: string
    cancelText?: string
    showCancel?: boolean
    closeOnMask?: boolean
  }>(),
  {
    title: '提示',
    content: '',
    confirmText: '确认',
    cancelText: '取消',
    showCancel: true,
    closeOnMask: false,
  },
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
  cancel: []
}>()

function close() {
  emit('update:visible', false)
}

function onMask() {
  if (!closeOnMask) return
  emit('cancel')
  close()
}

function onCancel() {
  emit('cancel')
  close()
}

function onConfirm() {
  emit('confirm')
  close()
}
</script>

<template>
  <view v-if="visible" class="app-modal" @tap="onMask">
    <view class="app-modal__panel" @tap.stop>
      <text class="app-modal__title">{{ title }}</text>
      <text class="app-modal__body">{{ content }}</text>
      <view class="app-modal__actions" :class="{ 'app-modal__actions--single': !showCancel }">
        <view
          v-if="showCancel"
          class="app-modal__btn app-modal__btn--ghost pressable"
          @tap="onCancel"
        >
          <text class="app-modal__btn-text">{{ cancelText }}</text>
        </view>
        <view class="app-modal__btn app-modal__btn--solid pressable" @tap="onConfirm">
          <text class="app-modal__btn-text app-modal__btn-text--solid">{{ confirmText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-modal {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: rgba(31, 36, 33, 0.42);
  box-sizing: border-box;
}

.app-modal__panel {
  width: 100%;
  max-width: 320px;
  padding: 22px 20px 16px;
  background: #fffdf8;
  border: 1px solid #e0dccf;
  border-radius: 18px;
  box-shadow: 0 16px 40px rgba(31, 77, 58, 0.16);
}

.app-modal__title {
  display: block;
  color: #1f2421;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}

.app-modal__body {
  display: block;
  margin-top: 14px;
  color: #5c635e;
  font-size: 14px;
  line-height: 1.65;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

.app-modal__actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.app-modal__actions--single .app-modal__btn {
  flex: 1;
}

.app-modal__btn {
  flex: 1;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.app-modal__btn--ghost {
  background: #f1eee6;
  border: 1px solid #ddd7ca;
}

.app-modal__btn--solid {
  background: #1f4d3a;
  border: 1px solid #1f4d3a;
}

.app-modal__btn-text {
  color: #315444;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.app-modal__btn-text--solid {
  color: #fffdf8;
}
</style>
