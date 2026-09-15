<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { loginWithSms, loginWithWechatCode, sendSmsCode, uniLoginWechat } from '@/services/auth'
import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()
const phone = ref('')
const code = ref('')
const sending = ref(false)
const loggingIn = ref(false)
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const canSend = computed(() => /^1\d{10}$/.test(phone.value) && cooldown.value === 0 && !sending.value)
const canSubmit = computed(() => /^1\d{10}$/.test(phone.value) && /^\d{4,8}$/.test(code.value) && !loggingIn.value)
const showWechat = ref(false)
// #ifdef MP-WEIXIN
showWechat.value = true
// #endif

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

async function handleWechatLogin() {
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

function showAgreement(type: 'user' | 'privacy') {
  uni.showModal({
    title: type === 'user' ? '用户使用协议' : '隐私政策',
    content: '当前为前端原型占位内容，接入正式协议页面后可直接替换此处。',
    showCancel: false,
  })
}

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <view class="screen login-screen">
    <view class="brand-orb brand-orb--one" />
    <text class="eyebrow">WELCOME</text>
    <text class="page-title">开始建立你的<br />英语语义地图</text>
    <text class="page-subtitle">支持手机验证码登录；微信登录请在小程序端使用。</text>

    <view class="login-actions">
      <view class="field-card">
        <input v-model="phone" class="field-input" type="number" maxlength="11" placeholder="请输入手机号" />
      </view>
      <view class="field-card field-card--code">
        <input v-model="code" class="field-input" type="number" maxlength="6" placeholder="短信验证码" />
        <text class="code-action" :class="{ 'code-action--disabled': !canSend }" @tap="handleSendCode">
          {{ cooldown > 0 ? `${cooldown}s` : sending ? '发送中' : '获取验证码' }}
        </text>
      </view>

      <button class="primary-button pressable" :disabled="!canSubmit" @tap="handlePhoneLogin">
        {{ loggingIn ? '登录中…' : '手机号登录' }}
      </button>

      <button v-if="showWechat" class="secondary-button pressable" :disabled="loggingIn" @tap="handleWechatLogin">
        微信一键登录
      </button>
      <text v-else class="other-title">微信登录仅在小程序中可用</text>

      <view class="agreement">
        <text>登录/注册即代表同意</text>
        <text class="agreement__link" @tap.stop="showAgreement('user')">《用户使用协议》</text>
        <text>和</text>
        <text class="agreement__link" @tap.stop="showAgreement('privacy')">《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-screen {
  padding-top: calc(env(safe-area-inset-top) + 76px);
}

.login-actions {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: calc(env(safe-area-inset-bottom) + 20px);
}

.field-card {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  margin-bottom: 12px;
  border: 1px solid #e0dccf;
  border-radius: 14px;
  background: #fffdf8;
}

.field-card--code {
  padding-right: 8px;
}

.field-input {
  flex: 1;
  height: 48px;
  font-size: 15px;
  color: #1f4d3a;
}

.code-action {
  flex-shrink: 0;
  padding: 8px 10px;
  color: #1f4d3a;
  font-size: 12px;
  font-weight: 600;
}

.code-action--disabled {
  color: #9aa59b;
}

.secondary-button {
  margin-top: 12px;
}

.other-title {
  display: block;
  margin-top: 14px;
  color: #6e786f;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.agreement {
  margin-top: 16px;
  color: #8a938b;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.agreement__link {
  color: #1f4d3a;
}
</style>
