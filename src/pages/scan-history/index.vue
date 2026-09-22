<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useLearningStore } from '@/stores/learning'
import type { ScanHistoryRecord } from '@/types/domain'

const store = useLearningStore()
const expandedId = ref('')

const records = computed(() => store.scanHistory)

function back() {
  uni.navigateBack()
}

function formatTime(ts: number) {
  const date = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function previewWords(record: ScanHistoryRecord) {
  return record.words.slice(0, 8).join(' · ')
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? '' : id
}

function clearAll() {
  if (!records.value.length) return
  uni.showModal({
    title: '清空拍词记录',
    content: '确定清空全部拍词记录吗？不会删除已加入生词本的单词。',
    success: (res) => {
      if (res.confirm) store.clearScanHistory()
    },
  })
}

function removeOne(id: string) {
  store.removeScanHistory(id)
  if (expandedId.value === id) expandedId.value = ''
}

function goScan() {
  uni.navigateTo({ url: '/pages/scan/index' })
}
</script>

<template>
  <view class="screen history-screen">
    <PageHeader title="拍词记录" @back="back">
      <template #right>
        <text
          class="history-header__action"
          :class="{ 'history-header__action--muted': !records.length }"
          @tap="clearAll"
        >清空</text>
      </template>
    </PageHeader>

    <view v-if="!records.length" class="empty-card card">
      <text class="empty-card__title">还没有拍词记录</text>
      <text class="empty-card__text">去拍一页试卷或真题，识别结果会自动出现在这里。</text>
      <button class="primary-button empty-card__button pressable" @tap="goScan">去拍词</button>
    </view>

    <view v-else class="record-list">
      <view
        v-for="record in records"
        :key="record.id"
        class="record-card card"
      >
        <view class="record-card__head pressable" @tap="toggleExpand(record.id)">
          <view class="record-card__meta-row">
            <text class="record-card__meta">
              识别 {{ record.candidateCount }} · 已加入 {{ record.addedWords.length }}
            </text>
            <text class="record-card__time">{{ formatTime(record.createdAt) }}</text>
          </view>
          <view class="record-card__preview-row">
            <text class="record-card__preview">{{ previewWords(record) }}</text>
            <image
              class="record-card__chevron"
              :class="{ 'record-card__chevron--open': expandedId === record.id }"
              src="/static/icons/chevron-down.svg"
              mode="aspectFit"
            />
          </view>
        </view>

        <view v-if="expandedId === record.id" class="record-card__body">
          <view
            v-for="word in record.words"
            :key="`${record.id}-${word}`"
            class="word-row"
          >
            <view class="word-row__main">
              <text class="word-row__word">{{ word }}</text>
              <text class="word-row__meaning">{{ record.meanings[word] || '释义待补充' }}</text>
            </view>
            <text v-if="record.addedWords.includes(word)" class="word-row__tag">已加入</text>
          </view>
          <text class="record-card__delete pressable" @tap="removeOne(record.id)">删除这条记录</text>
        </view>
      </view>
    </view>

    <BottomNav active="profile" />
  </view>
</template>

<style scoped lang="scss">
.history-screen {
  padding-top: calc(env(safe-area-inset-top) + 18px);
  padding-bottom: 116px;
}

.history-header__action {
  min-width: 36px;
  color: #1f4d3a;
  font-size: 13px;
  font-weight: 700;
  text-align: right;
  line-height: 36px;
}

.history-header__action--muted {
  color: #a7aea7;
}

.empty-card {
  margin-top: 28px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-card__title {
  color: #1f2421;
  font-size: 16px;
  font-weight: 700;
}

.empty-card__text {
  margin-top: 8px;
  color: #6e786f;
  font-size: 13px;
  line-height: 20px;
}

.empty-card__button {
  margin-top: 20px;
  width: 160px;
}

.record-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-card {
  padding: 0;
  overflow: hidden;
}

.record-card__head {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-card__meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.record-card__meta {
  flex: none;
  color: #3d7564;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.record-card__time {
  flex: 1;
  min-width: 0;
  color: #8b938b;
  font-size: 12px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-card__preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-card__preview {
  flex: 1;
  min-width: 0;
  color: #6e786f;
  font-size: 13px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-card__chevron {
  width: 18px;
  height: 18px;
  flex: none;
  transition: transform 180ms ease;
}

.record-card__chevron--open {
  transform: rotate(180deg);
}

.record-card__body {
  padding: 0 16px 14px;
  border-top: 1px solid #ece8dc;
}

.word-row {
  padding: 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #f0ece2;
}

.word-row:last-of-type {
  border-bottom: none;
}

.word-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.word-row__word {
  color: #1f2421;
  font-size: 15px;
  font-weight: 700;
}

.word-row__meaning {
  margin-top: 4px;
  color: #6e786f;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-row__tag {
  flex: none;
  padding: 4px 8px;
  color: #1f4d3a;
  background: #e4efe8;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.record-card__delete {
  display: block;
  margin-top: 4px;
  padding: 10px 0 2px;
  color: #9a6b5c;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}
</style>
