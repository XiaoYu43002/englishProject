<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { useLearningStore } from '@/stores/learning'

const sloganChars = ['让', '单', '词', '有', '迹', '可', '循']

let timer: ReturnType<typeof setTimeout> | undefined

function enter() {
  if (timer) clearTimeout(timer)
  const store = useLearningStore()
  uni.redirectTo({ url: store.isLoggedIn ? '/pages/home/index' : '/pages/login/index' })
}

onMounted(() => {
  timer = setTimeout(enter, 1800)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <view class="splash" @tap="enter">
    <view class="splash__hero">
      <view class="trace">
        <!-- 上方：轨迹起点，线向下描出 -->
        <view class="trace__head">
          <view class="trace__cap" />
          <view class="trace__stem">
            <view class="trace__stem-fill" />
            <view class="trace__bead" />
          </view>
        </view>

        <view class="trace__chars">
          <text
            v-for="(char, index) in sloganChars"
            :key="`${char}-${index}`"
            class="trace__char"
          >{{ char }}</text>
        </view>

        <!-- 下方：落点 / 足迹节点 -->
        <view class="trace__foot">
          <view class="trace__tail" />
          <view class="trace__node">
            <view class="trace__ring" />
            <view class="trace__dot" />
          </view>
        </view>
      </view>

      <text class="splash__tagline">循迹而学 · 向知而行</text>
    </view>

    <view class="splash__brand">
      <BrandLogo :size="54" />
      <view class="splash__wordmark">
        <text class="splash__name">知觅英语</text>
        <text class="splash__english">ZHIMI ENGLISH</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.splash {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: #f8f5e9;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.splash__hero {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 36px;
}

.trace {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.trace__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 14px;
}

.trace__cap {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c4a35a;
  opacity: 0;
  animation: cap-in 420ms ease forwards 80ms;
}

.trace__stem {
  position: relative;
  width: 2px;
  height: 36px;
  margin-top: 4px;
  overflow: hidden;
}

.trace__stem-fill {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #c4a35a 0%, rgba(196, 163, 90, 0.35) 100%);
  transform-origin: top center;
  transform: scaleY(0);
  animation: stem-draw 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards 180ms;
}

.trace__bead {
  position: absolute;
  left: 50%;
  top: -4px;
  width: 5px;
  height: 5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background: #d4b56a;
  opacity: 0;
  animation: bead-fall 900ms cubic-bezier(0.33, 1, 0.68, 1) forwards 220ms;
}

.trace__chars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.trace__char {
  color: #1f2421;
  font-size: 28px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: 0;
}

.trace__foot {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.trace__tail {
  width: 2px;
  height: 16px;
  background: linear-gradient(180deg, rgba(196, 163, 90, 0.45), rgba(196, 163, 90, 0.15));
  transform-origin: top center;
  transform: scaleY(0);
  animation: stem-draw 420ms ease forwards 320ms;
}

.trace__node {
  position: relative;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trace__ring {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid rgba(196, 163, 90, 0.55);
  opacity: 0;
  animation: ring-pulse 1.8s ease-out infinite 520ms;
}

.trace__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c4a35a;
  opacity: 0;
  transform: scale(0.4);
  animation: node-in 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards 400ms;
}

.splash__tagline {
  margin-top: 28px;
  color: #8a9188;
  font-size: 12px;
  letter-spacing: 2px;
}

.splash__brand {
  width: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom) + 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.splash__wordmark {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.splash__name {
  color: #1f2421;
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
}

.splash__english {
  margin-top: 2px;
  color: #9aa19a;
  font-size: 9px;
  line-height: 14px;
  letter-spacing: 1.6px;
}

@keyframes stem-draw {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

@keyframes bead-fall {
  0% { opacity: 0; top: -4px; }
  18% { opacity: 1; }
  100% { opacity: 0; top: 34px; }
}

@keyframes cap-in {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes node-in {
  to { opacity: 1; transform: scale(1); }
}

@keyframes ring-pulse {
  0% { opacity: 0.7; transform: scale(1); }
  70% { opacity: 0; transform: scale(2.4); }
  100% { opacity: 0; transform: scale(2.4); }
}
</style>
