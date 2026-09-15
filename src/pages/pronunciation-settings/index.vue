<script setup lang="ts">
import { computed } from 'vue'
import { playWordAudio } from '@/services/dictionary'
import {
  usePronunciationStore,
  VOICE_OPTIONS,
  type AudioAccent,
} from '@/stores/pronunciation'

const store = usePronunciationStore()
const currentVoices = computed(() => VOICE_OPTIONS[store.accent])

function selectAccent(accent: AudioAccent) {
  store.setAccent(accent)
}

function selectVoice(voiceId: string) {
  store.setVoice(store.accent, voiceId)
}

async function preview() {
  uni.showToast({ title: '试听中…', icon: 'none', duration: 800 })
  const result = await playWordAudio('hello')
  uni.showToast({
    title: result.ok ? `${store.accentLabel} · ${store.activeVoiceOption.name}` : '试听失败',
    icon: 'none',
  })
}

function back() {
  uni.navigateBack()
}
</script>

<template>
  <view class="screen settings-screen">
    <view class="settings-header">
      <view class="settings-header__back pressable" @tap="back">‹</view>
      <text class="settings-header__title">发音设置</text>
      <view class="settings-header__space" />
    </view>

    <text class="section-label">默认口音</text>
    <view class="option-row">
      <view
        class="option-card pressable"
        :class="{ 'option-card--active': store.accent === 'uk' }"
        @tap="selectAccent('uk')"
      >
        <text class="option-card__title">英式</text>
        <text class="option-card__desc">默认推荐</text>
      </view>
      <view
        class="option-card pressable"
        :class="{ 'option-card--active': store.accent === 'us' }"
        @tap="selectAccent('us')"
      >
        <text class="option-card__title">美式</text>
        <text class="option-card__desc">通用美音</text>
      </view>
    </view>

    <text class="section-label">音色（{{ store.accentLabel }} · 三选一）</text>
    <view class="voice-list">
      <view
        v-for="voice in currentVoices"
        :key="voice.id"
        class="voice-row card pressable"
        :class="{ 'voice-row--active': store.activeVoice === voice.id }"
        @tap="selectVoice(voice.id)"
      >
        <view class="voice-row__main">
          <text class="voice-row__name">{{ voice.name }}</text>
          <text class="voice-row__desc">{{ voice.desc }}</text>
        </view>
        <text class="voice-row__check">{{ store.activeVoice === voice.id ? '✓' : '' }}</text>
      </view>
    </view>

    <view class="hint card">
      <text class="hint__title">关于缓存</text>
      <text class="hint__text">每个「口音 + 音色 + 单词」只合成一次，之后直接播本地缓存，不会每次重跑 TTS。</text>
    </view>

    <button class="preview-button pressable" @tap="preview">试听 hello</button>
  </view>
</template>

<style scoped lang="scss">
.settings-screen { padding-top: calc(env(safe-area-inset-top) + 18px); }
.settings-header { height: 44px; display: flex; align-items: center; justify-content: space-between; }
.settings-header__back,.settings-header__space { width: 34px; }
.settings-header__back { color: #1f4d3a; font-size: 34px; line-height: 34px; }
.settings-header__title { font-size: 16px; font-weight: 700; color: #1f2421; }
.section-label { display: block; margin-top: 28px; color: #3d7564; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.option-row { margin-top: 12px; display: flex; gap: 10px; }
.option-card {
  flex: 1;
  padding: 14px 12px;
  background: #eef1e8;
  border-radius: 14px;
  border: 1px solid transparent;
}
.option-card--active { background: #dce8e1; border-color: #3d7564; }
.option-card__title { display: block; color: #1f4d3a; font-size: 15px; font-weight: 700; }
.option-card__desc { display: block; margin-top: 4px; color: #6e786f; font-size: 10px; }
.voice-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.voice-row {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid transparent;
}
.voice-row--active { border-color: #3d7564; background: #f3f6ef; }
.voice-row__main { display: flex; flex-direction: column; }
.voice-row__name { color: #1f2421; font-size: 14px; font-weight: 700; }
.voice-row__desc { margin-top: 4px; color: #6e786f; font-size: 11px; }
.voice-row__check { color: #2f6652; font-size: 16px; font-weight: 700; }
.hint { margin-top: 22px; padding: 14px 16px; }
.hint__title { display: block; color: #3d7564; font-size: 11px; font-weight: 700; }
.hint__text { display: block; margin-top: 6px; color: #6e786f; font-size: 11px; line-height: 18px; }
.preview-button {
  margin-top: 24px;
  height: 46px;
  border: none;
  border-radius: 14px;
  color: #fff;
  background: #2f6652;
  font-size: 14px;
  font-weight: 700;
}
</style>
