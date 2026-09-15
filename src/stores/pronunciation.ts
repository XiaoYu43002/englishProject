import { defineStore } from 'pinia'

export type AudioAccent = 'us' | 'uk'

export interface VoiceOption {
  id: string
  name: string
  desc: string
}

/** 每个口音提供 3 个可选音色 */
export const VOICE_OPTIONS: Record<AudioAccent, VoiceOption[]> = {
  us: [
    { id: 'af_heart', name: 'Heart', desc: '清晰自然' },
    { id: 'af_bella', name: 'Bella', desc: '柔和甜美' },
    { id: 'af_sky', name: 'Sky', desc: '轻快年轻' },
  ],
  uk: [
    { id: 'bf_emma', name: 'Emma', desc: '标准英式' },
    { id: 'bf_isabella', name: 'Isabella', desc: '柔和英式' },
    { id: 'bf_alice', name: 'Alice', desc: '清亮英式' },
  ],
}

const STORAGE_KEY = 'zhimi-pronunciation'

function loadSettings() {
  const raw = uni.getStorageSync(STORAGE_KEY) || {}
  const accent: AudioAccent = raw.accent === 'us' ? 'us' : 'uk'
  const usIds = new Set(VOICE_OPTIONS.us.map((item) => item.id))
  const ukIds = new Set(VOICE_OPTIONS.uk.map((item) => item.id))
  return {
    accent,
    voiceUs: usIds.has(raw.voiceUs) ? raw.voiceUs : VOICE_OPTIONS.us[0].id,
    voiceUk: ukIds.has(raw.voiceUk) ? raw.voiceUk : VOICE_OPTIONS.uk[0].id,
  }
}

export const usePronunciationStore = defineStore('pronunciation', {
  state: () => loadSettings(),
  getters: {
    activeVoice(): string {
      return this.accent === 'uk' ? this.voiceUk : this.voiceUs
    },
    activeVoiceOption(): VoiceOption {
      const list = VOICE_OPTIONS[this.accent]
      return list.find((item) => item.id === this.activeVoice) || list[0]
    },
    accentLabel(): string {
      return this.accent === 'uk' ? '英式' : '美式'
    },
  },
  actions: {
    persist() {
      uni.setStorageSync(STORAGE_KEY, {
        accent: this.accent,
        voiceUs: this.voiceUs,
        voiceUk: this.voiceUk,
      })
    },
    setAccent(accent: AudioAccent) {
      this.accent = accent
      this.persist()
    },
    setVoice(accent: AudioAccent, voiceId: string) {
      const allowed = new Set(VOICE_OPTIONS[accent].map((item) => item.id))
      if (!allowed.has(voiceId)) return
      if (accent === 'uk') this.voiceUk = voiceId
      else this.voiceUs = voiceId
      this.persist()
    },
  },
})
