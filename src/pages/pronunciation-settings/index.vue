<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import PageHeader from '@/components/PageHeader.vue'
import { playWordAudio } from '@/services/dictionary'
import {
  usePronunciationStore,
  VOICE_OPTIONS,
  type AudioAccent,
} from '@/stores/pronunciation'

const store = usePronunciationStore()
const currentVoices = computed(() => VOICE_OPTIONS[store.accent])
const previewWord = ref('')

const previewLabel = computed(() => {
  const word = previewWord.value.trim()
  return word ? `试听 ${word}` : '试听'
})

function selectAccent(accent: AudioAccent) {
  store.setAccent(accent)
}

function selectVoice(voiceId: string) {
  store.setVoice(store.accent, voiceId)
}

async function preview() {
  const word = previewWord.value.trim()
  if (!word) {
    uni.showToast({ title: '请先输入要试听的单词', icon: 'none' })
    return
  }
  if (!/^[a-zA-Z][a-zA-Z'\- ]*$/.test(word)) {
    uni.showToast({ title: '请输入英文单词', icon: 'none' })
    return
  }
  uni.showToast({ title: '试听中…', icon: 'none', duration: 800 })
  const result = await playWordAudio(word)
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
    <PageHeader title="发音设置" @back="back" />

    <view class="preview-input card">
      <input
        v-model="previewWord"
        class="preview-input__field"
        type="text"
        confirm-type="done"
        placeholder="输入单词后可试听，如 hello"
        placeholder-class="preview-input__placeholder"
        @confirm="preview"
      />
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

    <button class="preview-button pressable" @tap="preview">{{ previewLabel }}</button>

    <BottomNav active="profile" />
  </view>
</template>

<style scoped lang="scss">
.settings-screen {
  padding-top: calc(env(safe-area-inset-top) + 18px);
  padding-bottom: 116px;
}

.preview-input {
  margin-top: 16px;
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.preview-input__field {
  flex: 1;
  height: 48px;
  padding: 0;
  color: #1f2421;
  font-size: 14px;
  line-height: 48px;
  background: transparent;
}

.preview-input__placeholder {
  color: #9ca39b;
}

.section-label {
  display: block;
  margin-top: 26px;
  color: #3d7564;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.option-row {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}

.option-card {
  flex: 1;
  padding: 14px 12px;
  background: #eef1e8;
  border-radius: 14px;
  border: 1px solid transparent;
}

.option-card--active {
  background: #dce8e1;
  border-color: #3d7564;
}

.option-card__title {
  display: block;
  color: #1f4d3a;
  font-size: 15px;
  font-weight: 700;
}

.option-card__desc {
  display: block;
  margin-top: 4px;
  color: #6e786f;
  font-size: 10px;
}

.voice-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-row {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid transparent;
}

.voice-row--active {
  border-color: #3d7564;
  background: #f3f6ef;
}

.voice-row__main {
  display: flex;
  flex-direction: column;
}

.voice-row__name {
  color: #1f2421;
  font-size: 14px;
  font-weight: 700;
}

.voice-row__desc {
  margin-top: 4px;
  color: #6e786f;
  font-size: 11px;
}

.voice-row__check {
  color: #2f6652;
  font-size: 16px;
  font-weight: 700;
}

.preview-button {
  margin: 28px 0 0;
  padding: 0;
  height: 46px;
  line-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 14px;
  color: #fff;
  background: #2f6652;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.preview-button::after {
  border: none;
}
</style>
