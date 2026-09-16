<script setup lang="ts">
import { computed, ref } from 'vue'
import { loginWithWechatCode, uniLoginWechat } from '@/services/auth'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const agreed = ref(false)
const loggingIn = ref(false)

const checkboxSrc = computed(() =>
  agreed.value ? '/static/icons/checkbox-checked.svg' : '/static/icons/checkbox-empty.svg',
)
const checkboxStyle = { width: '11px', height: '11px' }
const otherIconStyle = { width: '30px', height: '30px' }
const loginIconStyle = { width: '22px', height: '22px' }

function toggleAgree() {
  agreed.value = !agreed.value
}

function ensureAgreed() {
  if (agreed.value) return true
  uni.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' })
  return false
}

function goPhoneLogin() {
  uni.navigateTo({ url: '/pages/login-phone/index' })
}

async function handleWechatLogin() {
  if (!ensureAgreed() || loggingIn.value) return

  // #ifndef MP-WEIXIN
  uni.showToast({ title: '微信登录请在小程序中使用', icon: 'none' })
  return
  // #endif

  loggingIn.value = true
  try {
    const jsCode = await uniLoginWechat()
    const result = await loginWithWechatCode(jsCode)
    store.login('wechat', { token: result.token, user: result.user })
    uni.redirectTo({ url: '/pages/home/index' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '微信登录失败', icon: 'none' })
  } finally {
    loggingIn.value = false
  }
}

function handleOther(type: 'qq' | 'more') {
  if (!ensureAgreed()) return
  uni.showToast({
    title: type === 'qq' ? 'QQ 登录即将开放' : '更多登录方式即将开放',
    icon: 'none',
  })
}

function showAgreement(type: 'user' | 'privacy') {
  uni.showModal({
    title: type === 'user' ? '用户协议' : '隐私政策',
    content: '当前为前端原型占位内容，接入正式协议页面后可直接替换此处。',
    showCancel: false,
  })
}
</script>

<template>
  <view class="screen login-screen">
    <view class="login-hero">
      <text class="eyebrow">WELCOME</text>
      <text class="page-title">开始建立你的<br />英语语义地图</text>
      <text class="page-subtitle">面向四六级与考研词汇，也支持拍照加入自己的生词。</text>
    </view>

    <view class="login-actions">
      <view class="login-button login-button--wechat pressable" @tap="handleWechatLogin">
        <view class="login-button__row">
          <view class="login-button__icon-slot">
            <image class="login-button__icon" src="/static/icons/wechat.svg" mode="aspectFit" :style="loginIconStyle" />
          </view>
          <text class="login-button__text login-button__text--light">{{ loggingIn ? '登录中…' : '微信登录' }}</text>
        </view>
      </view>

      <view class="login-button login-button--phone pressable" @tap="goPhoneLogin">
        <view class="login-button__row">
          <view class="login-button__icon-slot">
            <image class="login-button__icon" src="/static/icons/phone.svg" mode="aspectFit" :style="loginIconStyle" />
          </view>
          <text class="login-button__text">手机号登录</text>
        </view>
      </view>

      <view class="other-methods">
        <view class="other-methods__item pressable" @tap="handleOther('qq')">
          <image class="other-methods__icon" src="/static/icons/qq.svg" mode="aspectFit" :style="otherIconStyle" />
        </view>
        <view class="other-methods__item pressable" @tap="handleOther('more')">
          <image class="other-methods__icon" src="/static/icons/more.svg" mode="aspectFit" :style="otherIconStyle" />
        </view>
      </view>

      <view class="agreement" @tap="toggleAgree">
        <image class="agreement__check" :src="checkboxSrc" mode="aspectFit" :style="checkboxStyle" />
        <text class="agreement__text">
          登录即表示同意
          <text class="agreement__link" @tap.stop="showAgreement('user')">用户协议</text>
          与
          <text class="agreement__link" @tap.stop="showAgreement('privacy')">隐私政策</text>
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-screen {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 76px) 28px calc(env(safe-area-inset-bottom) + 24px);
  display: flex;
  flex-direction: column;
  background: #f8f6f1;
}

.login-hero {
  flex: 1;
}

.login-hero :deep(.page-title) {
  color: #1f211f;
  font-size: 32px;
}

.login-hero :deep(.page-subtitle) {
  max-width: 280px;
  color: #6b6e66;
}

.login-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.login-button {
  height: 52px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-button--wechat {
  background: #3d7566;
}

.login-button--phone {
  margin-top: 12px;
  background: #fffefb;
  border: 1px solid #e0dbcf;
}

.login-button__row {
  width: 120px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-button__icon-slot {
  width: 22px;
  height: 22px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-button__icon {
  display: block;
  flex: none;
}

.login-button__text {
  color: #1f211f;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
}

.login-button__text--light {
  color: #fff;
}

.other-methods {
  margin-top: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.other-methods__item {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.other-methods__icon {
  width: 30px;
  height: 30px;
  display: block;
  flex: none;
}

.agreement {
  margin-top: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.agreement__check {
  width: 11px;
  height: 11px;
  display: block;
  flex: none;
}

.agreement__text,
.agreement__link {
  color: #6b6e66;
  font-size: 11px;
  line-height: 11px;
}

.agreement__link {
  color: #1f211f;
}
</style>
