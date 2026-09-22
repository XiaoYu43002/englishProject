import { defineStore } from 'pinia'
import type {
  ExamTarget,
  ImproveFocus,
  LearnerGoal,
  LearnerIdentity,
  LearnerProfileState,
} from '@/types/learnerProfile'

const STORAGE_KEY = 'zhimi-learner-profile'

function emptyProfile(): LearnerProfileState {
  return {
    identity: '',
    goal: '',
    examTarget: '',
    improveFocus: '',
    completed: false,
    skipped: false,
    updatedAt: 0,
  }
}

function loadProfile(): LearnerProfileState {
  const raw = uni.getStorageSync(STORAGE_KEY) || {}
  return {
    ...emptyProfile(),
    ...raw,
    identity: raw.identity || '',
    goal: raw.goal || '',
    examTarget: raw.examTarget || '',
    improveFocus: raw.improveFocus || '',
    completed: Boolean(raw.completed),
    skipped: Boolean(raw.skipped),
    updatedAt: Number(raw.updatedAt) || 0,
  }
}

export const useLearnerProfileStore = defineStore('learnerProfile', {
  state: (): LearnerProfileState => loadProfile(),
  getters: {
    needsOnboarding(): boolean {
      return !this.completed && !this.skipped
    },
    summaryLabel(): string {
      if (!this.completed && !this.skipped) return '待完善'
      if (this.skipped && !this.identity) return '已跳过'
      const bits: string[] = []
      const identityMap: Record<string, string> = {
        primary: '小学生',
        junior: '初中生',
        senior: '高中生',
        college: '大学生',
        graduate: '研究生',
        working: '工作党',
        freelance: '自由职业',
      }
      if (this.identity) bits.push(identityMap[this.identity] || this.identity)
      if (this.goal === 'exam') bits.push('通过考试')
      if (this.goal === 'self-improve') bits.push('自我提升')
      return bits.join(' · ') || '已完善'
    },
  },
  actions: {
    persist() {
      this.updatedAt = Date.now()
      uni.setStorageSync(STORAGE_KEY, {
        identity: this.identity,
        goal: this.goal,
        examTarget: this.examTarget,
        improveFocus: this.improveFocus,
        completed: this.completed,
        skipped: this.skipped,
        updatedAt: this.updatedAt,
      })
    },
    setIdentity(identity: LearnerIdentity) {
      this.identity = identity
      this.persist()
    },
    setGoal(goal: LearnerGoal) {
      this.goal = goal
      if (goal === 'exam') this.improveFocus = ''
      if (goal === 'self-improve') this.examTarget = ''
      this.persist()
    },
    setExamTarget(examTarget: ExamTarget) {
      this.examTarget = examTarget
      this.improveFocus = ''
      this.persist()
    },
    setImproveFocus(improveFocus: ImproveFocus) {
      this.improveFocus = improveFocus
      this.examTarget = ''
      this.persist()
    },
    markCompleted() {
      this.completed = true
      this.skipped = false
      this.persist()
    },
    markSkipped() {
      this.skipped = true
      this.completed = false
      this.persist()
    },
    reset() {
      Object.assign(this, emptyProfile())
      uni.removeStorageSync(STORAGE_KEY)
    },
  },
})

/** 登录成功后的统一跳转 */
export function navigateAfterLogin() {
  const profile = useLearnerProfileStore()
  if (profile.needsOnboarding) {
    uni.redirectTo({ url: '/pages/learner-profile/index' })
    return
  }
  uni.redirectTo({ url: '/pages/home/index' })
}
