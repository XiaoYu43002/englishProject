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
    store.setScanCandidates(result.candidates)
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
  <view class="screen scan-screen">
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

    <view v-if="store.scanCandidates.length" class="result-card">
      <view class="result-card__head">
        <text class="result-card__title">
          共识别 <text class="result-card__count">{{ store.scanCandidates.length }}</text> 词
        </text>
        <text class="result-card__action" @tap="toggleAll">{{ allSelected ? '取消勾选' : '全选' }}</text>
      </view>

      <scroll-view scroll-y class="candidate-list" :show-scrollbar="false">
        <view class="candidate-list__inner">
          <view
            v-for="item in store.scanCandidates"
            :key="`${item.normalized}-${item.lineIndex}`"
            class="candidate-row"
            @tap="store.toggleWord(item.normalized)"
          >
            <image
              class="candidate-row__check"
              :src="store.selectedWords.includes(item.normalized) ? '/static/icons/radio-on.svg' : '/static/icons/radio-off.svg'"
              mode="aspectFit"
            />
            <text class="candidate-row__word">{{ item.word }}</text>
            <view class="candidate-row__meaning-wrap">
              <text class="candidate-row__meaning">{{ item.meanings[0] || '词义待补充' }}</text>
            </view>
            <text class="candidate-row__confidence">{{ Math.round(item.confidence * 100) }}%</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="store.scanCandidates.length" class="confirm-actions">
      <button class="confirm-button pressable" hover-class="confirm-button--on" @tap="addWords('notebook')">加入生词本</button>
      <button class="confirm-button pressable" hover-class="confirm-button--on" @tap="addWords('today')">加入今日学习</button>
    </view>

    <BottomNav active="scan" />
  </view>
</template>

<style scoped lang="scss">
.scan-screen {
  padding-top: calc(env(safe-area-inset-top) + 34px);
  padding-bottom: 116px;
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

.source-button::after,
.confirm-button::after {
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

.result-card {
  margin-top: 18px;
  padding: 14px 12px 12px;
  background: #e7eee6;
  border: 1px solid #cfd9cc;
  border-radius: 22px;
}

.result-card__head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  margin-bottom: 10px;
  padding: 0 68px;
}

.result-card__title {
  color: #4a524c;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.result-card__count {
  color: #1f4d3a;
  font-size: 20px;
  font-weight: 800;
}

.result-card__action {
  position: absolute;
  top: 50%;
  right: 4px;
  color: #1f4d3a;
  font-size: 13px;
  font-weight: 600;
  transform: translateY(-50%);
}

.candidate-list {
  height: 280px;
  -webkit-overflow-scrolling: touch;
}

.candidate-list__inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 2px;
}

.candidate-row {
  min-height: 48px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 18px;
}

.candidate-row__check {
  flex: none;
  width: 11px;
  height: 11px;
}

.candidate-row__word {
  flex: none;
  padding-right: 1px;
  color: #1f2421;
  font-size: 14px;
  font-weight: 700;
  font-style: italic;
  line-height: 14px;
  white-space: nowrap;
}

.candidate-row__meaning-wrap {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.candidate-row__meaning {
  display: block;
  overflow: hidden;
  color: #8b9288;
  font-size: 13px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-row__confidence {
  flex: none;
  color: #9a927f;
  font-size: 11px;
  font-weight: 600;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.confirm-button {
  flex: 1;
  height: 46px;
  margin: 0;
  padding: 0 8px;
  color: #1f4d3a;
  background: #f4f1e8;
  border: 1px solid #cdd5cc;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  line-height: 46px;
}

.confirm-button--on,
.confirm-button:active {
  color: #fff;
  background: #1f4d3a;
  border-color: #1f4d3a;
}
</style>
