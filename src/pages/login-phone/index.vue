<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { loginWithSms, sendSmsCode } from '@/services/auth'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const phone = ref('')
const code = ref('')
const sending = ref(false)
const loggingIn = ref(false)
const agreed = ref(false)
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const canSend = computed(() => /^1\d{10}$/.test(phone.value) && cooldown.value === 0 && !sending.value)
const canSubmit = computed(() => /^1\d{10}$/.test(phone.value) && /^\d{4,8}$/.test(code.value) && !loggingIn.value)
const checkboxSrc = computed(() =>
  agreed.value ? '/static/icons/checkbox-checked.svg' : '/static/icons/checkbox-empty.svg',
)
const checkboxStyle = { width: '11px', height: '11px' }

function startCooldown(seconds = 60) {
  cooldown.value = seconds
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) {
      cooldown.value = 0
      clearInterval(timer)
    }
  }, 1000)
}

function toggleAgree() {
  agreed.value = !agreed.value
}

function back() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.redirectTo({ url: '/pages/login/index' })
}

async function handleSendCode() {
  if (!canSend.value) return
  sending.value = true
  try {
    const result = await sendSmsCode(phone.value, 'login')
    startCooldown(result.cooldownSec || 60)
    uni.showToast({
      title: result.debugCode ? `调试验证码 ${result.debugCode}` : '验证码已发送',
      icon: 'none',
    })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '发送失败', icon: 'none' })
  } finally {
    sending.value = false
  }
}

async function handlePhoneLogin() {
  if (!canSubmit.value) return
  if (!agreed.value) {
    uni.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' })
    return
  }
  loggingIn.value = true
  try {
    const result = await loginWithSms(phone.value, code.value)
    store.login('phone', { token: result.token, user: result.user })
    uni.redirectTo({ url: '/pages/home/index' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '登录失败', icon: 'none' })
  } finally {
    loggingIn.value = false
  }
}

function showAgreement(type: 'user' | 'privacy') {
  uni.showModal({
    title: type === 'user' ? '用户协议' : '隐私政策',
    content: '当前为前端原型占位内容，接入正式协议页面后可直接替换此处。',
    showCancel: false,
  })
}

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <view class="screen phone-login-screen">
    <view class="topbar">
      <view class="topbar__back pressable" @tap="back">‹</view>
      <text class="topbar__label">手机号登录</text>
      <view class="topbar__space" />
    </view>

    <text class="eyebrow">WELCOME</text>
    <text class="page-title">用手机号继续</text>
    <text class="page-subtitle">输入手机号获取验证码，登录后即可建立你的英语语义地图。</text>

    <view class="login-form">
      <view class="field-card">
        <input v-model="phone" class="field-input" type="number" maxlength="11" placeholder="请输入手机号" />
      </view>
      <view class="field-card field-card--code">
        <input v-model="code" class="field-input" type="number" maxlength="6" placeholder="短信验证码" />
        <text class="code-action" :class="{ 'code-action--disabled': !canSend }" @tap="handleSendCode">
          {{ cooldown > 0 ? `${cooldown}s` : sending ? '发送中' : '获取验证码' }}
        </text>
      </view>
    </view>

    <view class="login-actions">
      <view
        class="login-button pressable"
        :class="{ 'login-button--disabled': !canSubmit }"
        @tap="handlePhoneLogin"
      >
        <text class="login-button__text">{{ loggingIn ? '登录中…' : '登录' }}</text>
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
.phone-login-screen {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 18px) 28px calc(env(safe-area-inset-bottom) + 24px);
  display: flex;
  flex-direction: column;
  background: #f8f6f1;
}

.topbar {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topbar__back,
.topbar__space {
  width: 34px;
}

.topbar__back {
  color: #1f4d3a;
  font-size: 34px;
  line-height: 34px;
}

.topbar__label {
  color: #1f211f;
  font-size: 16px;
  font-weight: 700;
}

.eyebrow {
  margin-top: 28px;
}

.login-form {
  margin-top: 28px;
}

.field-card {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 16px;
  margin-bottom: 12px;
  border: 1px solid #e0dbcf;
  border-radius: 18px;
  background: #fffefb;
}

.field-card--code {
  padding-right: 8px;
}

.field-input {
  flex: 1;
  height: 52px;
  font-size: 15px;
  color: #1f211f;
}

.code-action {
  flex-shrink: 0;
  padding: 8px 10px;
  color: #3d7566;
  font-size: 12px;
  font-weight: 600;
}

.code-action--disabled {
  color: #9aa59b;
}

.login-actions {
  margin-top: auto;
}

.login-button {
  height: 52px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3d7566;
}

.login-button--disabled {
  opacity: 0.45;
}

.login-button__text {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
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
