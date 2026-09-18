<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import { recognizeImage } from '@/services/ocr'
import { useLearningStore } from '@/stores/learning'
import type { ScanAddTarget } from '@/types/domain'

const store = useLearningStore()
const photoPath = ref('')
const lastFilePath = ref('')
const status = ref<'idle' | 'recognizing' | 'success' | 'error'>('idle')
const errorMessage = ref('')
const elapsedMs = ref(0)
const lineCount = ref(0)

const selectedCount = computed(() => store.selectedWords.length)
const allSelected = computed(() => Boolean(store.scanCandidates.length) && selectedCount.value === store.scanCandidates.length)
const busy = computed(() => status.value === 'recognizing')

function choosePhoto(sourceType: Array<'camera' | 'album'>) {
  if (busy.value) return
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType,
    success: async (result) => {
      const filePath = result.tempFilePaths[0]
      if (!filePath) return
      lastFilePath.value = filePath
      photoPath.value = filePath
      await runOcr(filePath)
    },
  })
}

function tapCaptureArea() {
  if (busy.value) return
  choosePhoto(['camera'])
}

async function runOcr(filePath = lastFilePath.value) {
  if (!filePath || busy.value) return
  photoPath.value = filePath
  status.value = 'recognizing'
  errorMessage.value = ''
  store.setScanCandidates([])
  try {
    const result = await recognizeImage(filePath)
    store.setScanCandidates(result.candidates, { record: true })
    elapsedMs.value = result.elapsedMs
    lineCount.value = result.lineCount
    status.value = 'success'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '识别失败，请稍后重试'
    status.value = 'error'
  } finally {
    photoPath.value = ''
  }
}

function toggleAll() {
  if (allSelected.value) store.clearScanWords()
  else store.selectAllScanWords()
}

function reshoot() {
  status.value = 'idle'
  errorMessage.value = ''
  photoPath.value = ''
  store.setScanCandidates([])
  choosePhoto(['camera'])
}

function addWords(target: ScanAddTarget) {
  if (!selectedCount.value) {
    uni.showToast({ title: '请先选择单词', icon: 'none' })
    return
  }
  const result = store.addScannedWords(target)
  const destination = target === 'today' ? '今日学习' : '我的生词'
  uni.showToast({ title: result.added ? `已加入${destination} ${result.added} 个` : '这些词已在生词本中', icon: 'none' })
}
</script>

<template>
  <view class="screen scan-screen" :class="{ 'scan-screen--result': store.scanCandidates.length }">
    <template v-if="!store.scanCandidates.length">
      <view class="scan-heading">
        <text class="page-title scan-title">拍词</text>
        <text class="page-subtitle">
          试卷、四六级真题、阅读段落——一键上传并按需选择加入生词本进行学习
        </text>
      </view>

      <view class="photo-card card pressable" @tap="tapCaptureArea">
        <image v-if="photoPath" class="photo-card__image" :src="photoPath" mode="aspectFill" />
        <view v-else class="photo-card__empty">
          <view class="focus-frame"><view class="focus-frame__leaf" /></view>
          <text class="photo-card__title">拍摄英文书页或题目</text>
          <text class="photo-card__text">画面清晰、文字水平，识别会更准确</text>
        </view>
        <view v-if="busy" class="recognizing-mask">
          <view class="scan-line" />
          <text class="recognizing-mask__title">正在辨认单词</text>
          <text class="recognizing-mask__text">首次启动模型可能需要多等一会儿</text>
        </view>
      </view>

      <view class="source-actions">
        <button
          class="source-button source-button--primary pressable"
          :disabled="busy"
          @tap.stop="choosePhoto(['camera'])"
        >
          <view class="source-button__glyph source-button__glyph--scan" /><text>拍照识词</text>
        </button>
        <button
          class="source-button pressable"
          :disabled="busy"
          @tap.stop="choosePhoto(['album'])"
        >
          <view class="source-button__glyph source-button__glyph--album" /><text>从相册选择</text>
        </button>
      </view>

      <view v-if="status === 'error'" class="message-card message-card--error">
        <text class="message-card__title">这次没有识别成功</text>
        <text class="message-card__text">{{ errorMessage }}</text>
        <view class="message-card__actions">
          <text class="message-card__link" @tap="runOcr()">重新识别</text>
          <text class="message-card__link" @tap="tapCaptureArea">再拍一张</text>
        </view>
      </view>

      <view v-if="status === 'success' && !store.scanCandidates.length" class="message-card">
        <text class="message-card__title">没有识别到英文单词</text>
        <text class="message-card__text">请对准题目或段落文字，避免反光、倾斜或模糊后再试。</text>
        <text class="message-card__link" @tap="tapCaptureArea">重新拍摄</text>
      </view>
    </template>

    <template v-else>
      <view class="result-page">
        <view class="result-toolbar">
          <text class="result-toolbar__side" @tap="reshoot">再拍一次</text>
          <view class="result-toolbar__center">
            <text class="result-toolbar__label">共识别</text>
            <text class="result-toolbar__count">{{ store.scanCandidates.length }}</text>
            <text class="result-toolbar__label">词</text>
          </view>
          <text class="result-toolbar__side result-toolbar__side--right" @tap="toggleAll">
            {{ allSelected ? '取消勾选' : '全选' }}
          </text>
        </view>

        <scroll-view scroll-y class="result-list" :show-scrollbar="false">
          <view
            v-for="item in store.scanCandidates"
            :key="`${item.normalized}-${item.lineIndex}`"
            class="result-row"
            :class="{ 'result-row--on': store.selectedWords.includes(item.normalized) }"
            @tap="store.toggleWord(item.normalized)"
          >
            <image
              class="result-row__check"
              :src="store.selectedWords.includes(item.normalized) ? '/static/icons/radio-on.svg' : '/static/icons/radio-off.svg'"
              mode="aspectFit"
            />
            <view class="result-row__body">
              <text class="result-row__word">{{ item.word }}</text>
              <text class="result-row__meaning">{{ item.meanings[0] || '词义待补充' }}</text>
            </view>
            <text class="result-row__confidence">{{ Math.round(item.confidence * 100) }}%</text>
          </view>
        </scroll-view>

        <view class="result-actions">
          <button class="result-action result-action--ghost pressable" @tap="addWords('notebook')">加入生词本</button>
          <button class="result-action result-action--solid pressable" @tap="addWords('today')">加入今日学习</button>
        </view>
      </view>
    </template>

    <BottomNav active="scan" />
  </view>
</template>

<style scoped lang="scss">
.scan-screen {
  padding-top: calc(env(safe-area-inset-top) + 34px);
  padding-bottom: 116px;
}

.scan-screen--result {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-left: 0;
  padding-right: 0;
  padding-top: calc(env(safe-area-inset-top) + 36px);
  padding-bottom: calc(52px + env(safe-area-inset-bottom));
}

.scan-heading {
  display: flex;
  flex-direction: column;
}

.scan-title {
  margin-top: 0;
}

.photo-card {
  position: relative;
  height: 210px;
  margin-top: 22px;
  overflow: hidden;
  border: 1px solid rgba(92, 105, 92, 0.14);
}

.photo-card__image {
  width: 100%;
  height: 100%;
}

.photo-card__empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e9efe6, #f8f3e5);
}

.focus-frame {
  position: relative;
  width: 62px;
  height: 48px;
  border: 2px solid #537363;
  border-radius: 13px;
}

.focus-frame::before,
.focus-frame::after {
  position: absolute;
  content: '';
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #cdb273;
}

.focus-frame::before {
  left: 12px;
  top: 10px;
}

.focus-frame::after {
  right: 9px;
  bottom: 8px;
  width: 22px;
  height: 2px;
  border-radius: 4px;
  transform: rotate(-18deg);
}

.focus-frame__leaf {
  position: absolute;
  right: -8px;
  top: -9px;
  width: 18px;
  height: 10px;
  background: #75907d;
  border-radius: 15px 2px 15px 2px;
  transform: rotate(-26deg);
}

.photo-card__title {
  margin-top: 16px;
  color: #253b31;
  font-size: 15px;
  font-weight: 700;
}

.photo-card__text {
  margin-top: 6px;
  color: #788179;
  font-size: 11px;
}

.recognizing-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fffdf6;
  background: rgba(25, 67, 51, 0.82);
}

.scan-line {
  position: absolute;
  left: 9%;
  right: 9%;
  top: 30%;
  height: 2px;
  background: #e1c583;
  box-shadow: 0 0 12px #f1d995;
  animation: scan 1.6s ease-in-out infinite alternate;
}

.recognizing-mask__title {
  font-size: 16px;
  font-weight: 700;
}

.recognizing-mask__text {
  margin-top: 8px;
  font-size: 10px;
  opacity: 0.8;
}

@keyframes scan {
  from { transform: translateY(-28px); }
  to { transform: translateY(58px); }
}

.source-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.source-button {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 0;
  color: #315444;
  background: #f8f5ec;
  border: 1px solid #d8d7ca;
  border-radius: 14px;
  font-size: 12px;
  line-height: 44px;
}

.source-button::after {
  border: 0;
}

.source-button--primary {
  color: #fffdf5;
  background: #285c48;
  border-color: #285c48;
}

.source-button__glyph {
  width: 14px;
  height: 14px;
  flex: none;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.source-button__glyph--scan {
  background-color: #fffdf5;
  -webkit-mask-image: url('/static/icons/nav-scan.svg');
  mask-image: url('/static/icons/nav-scan.svg');
}

.source-button__glyph--album {
  background-color: #315444;
  -webkit-mask-image: url('/static/icons/nav-album.svg?v=2');
  mask-image: url('/static/icons/nav-album.svg?v=2');
}

.message-card {
  margin-top: 18px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  background: #f3f1e8;
  border-radius: 16px;
}

.message-card--error {
  background: #f5ebe3;
}

.message-card__title {
  color: #1f2421;
  font-size: 14px;
  font-weight: 700;
}

.message-card__text {
  margin-top: 6px;
  color: #6e786f;
  font-size: 12px;
  line-height: 18px;
}

.message-card__actions {
  display: flex;
  gap: 16px;
  margin-top: 12px;
}

.message-card__link {
  align-self: flex-start;
  margin-top: 12px;
  color: #1f4d3a;
  font-size: 12px;
  font-weight: 700;
}

.message-card__actions .message-card__link {
  margin-top: 0;
}

.result-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px 12px;
  border-bottom: 1px solid rgba(31, 77, 58, 0.08);
  background: rgba(248, 245, 233, 0.96);
}

.result-toolbar__side {
  flex: 0 0 72px;
  color: #3d7564;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.result-toolbar__side--right {
  text-align: right;
}

.result-toolbar__center {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.result-toolbar__label {
  color: #4a524c;
  font-size: 15px;
  font-weight: 600;
}

.result-toolbar__count {
  color: #1f4d3a;
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.5px;
}

.result-list {
  flex: 1;
  min-height: 0;
  height: 0;
  background: #f3f0e6;
  -webkit-overflow-scrolling: touch;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 12px 16px;
  background: #fffdf8;
  border-bottom: 1px solid rgba(224, 220, 207, 0.85);
}

.result-row--on {
  background: #f4f8f4;
}

.result-row__check {
  flex: none;
  width: 16px;
  height: 16px;
}

.result-row__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.result-row__word {
  color: #1f2421;
  font-size: 16px;
  font-weight: 700;
  font-style: italic;
  line-height: 1.2;
}

.result-row__meaning {
  overflow: hidden;
  color: #8b9288;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-row__confidence {
  flex: none;
  color: #9a927f;
  font-size: 11px;
  font-weight: 600;
}

.result-actions {
  flex: none;
  display: flex;
  gap: 10px;
  padding: 8px 16px 10px;
  background: #f8f5e9;
  border-top: 1px solid rgba(31, 77, 58, 0.08);
}

.result-action {
  flex: 1;
  height: 46px;
  margin: 0;
  padding: 0 10px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  line-height: 46px;
}

.result-action::after {
  border: 0;
}

.result-action--ghost {
  color: #1f4d3a;
  background: transparent;
  border: 1.5px solid rgba(31, 77, 58, 0.28);
}

.result-action--solid {
  color: #fff;
  background: #1f4d3a;
  border: 1.5px solid #1f4d3a;
  box-shadow: 0 8px 18px rgba(31, 77, 58, 0.18);
}

.result-action--ghost:active {
  background: rgba(31, 77, 58, 0.06);
}

.result-action--solid:active {
  opacity: 0.92;
}
</style>
