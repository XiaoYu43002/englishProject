export type LearnerIdentity =
  | 'primary'
  | 'junior'
  | 'senior'
  | 'college'
  | 'graduate'
  | 'working'
  | 'freelance'

export type LearnerGoal = 'exam' | 'self-improve'

export type ExamTarget =
  | 'zhongkao'
  | 'gaokao'
  | 'cet4'
  | 'cet6'
  | 'kaoyan'
  | 'zhuanshengben'
  | 'ielts'
  | 'toefl'
  | 'tem4'
  | 'tem8'
  | 'zhigao'
  | 'zhongzhi'
  | 'jixiao'
  | 'other'

export type ImproveFocus = 'vocab' | 'daily' | 'professional' | 'speaking'

export interface OptionItem<T extends string = string> {
  id: T
  label: string
}

export interface LearnerProfileState {
  identity: LearnerIdentity | ''
  goal: LearnerGoal | ''
  examTarget: ExamTarget | ''
  improveFocus: ImproveFocus | ''
  completed: boolean
  skipped: boolean
  updatedAt: number
}

export const IDENTITY_OPTIONS: OptionItem<LearnerIdentity>[] = [
  { id: 'primary', label: '小学生' },
  { id: 'junior', label: '初中生' },
  { id: 'senior', label: '高中生' },
  { id: 'college', label: '大学生' },
  { id: 'graduate', label: '研究生及以上' },
  { id: 'working', label: '工作党' },
  { id: 'freelance', label: '自由职业' },
]

export const GOAL_OPTIONS: OptionItem<LearnerGoal>[] = [
  { id: 'exam', label: '通过考试' },
  { id: 'self-improve', label: '自我提升' },
]

export const EXAM_OPTIONS: OptionItem<ExamTarget>[] = [
  { id: 'zhongkao', label: '中考' },
  { id: 'gaokao', label: '高考' },
  { id: 'cet4', label: '四级' },
  { id: 'cet6', label: '六级' },
  { id: 'kaoyan', label: '考研' },
  { id: 'zhuanshengben', label: '专升本' },
  { id: 'ielts', label: '雅思' },
  { id: 'toefl', label: '托福' },
  { id: 'tem4', label: '专四' },
  { id: 'tem8', label: '专八' },
  { id: 'zhigao', label: '职高' },
  { id: 'zhongzhi', label: '中职' },
  { id: 'jixiao', label: '技校升学' },
  { id: 'other', label: '其他' },
]

export const IMPROVE_OPTIONS: OptionItem<ImproveFocus>[] = [
  { id: 'vocab', label: '提升词汇量' },
  { id: 'daily', label: '日常英语' },
  { id: 'professional', label: '专业英语' },
  { id: 'speaking', label: '提升口语' },
]

/** 末尾固定：专升本 → 技校升学 → 其他；其余按身份优先排序 */
const EXAM_TAIL: ExamTarget[] = ['zhuanshengben', 'jixiao', 'other']

export function examsForIdentity(identity: LearnerIdentity | ''): OptionItem<ExamTarget>[] {
  const priority: ExamTarget[] = (() => {
    switch (identity) {
      case 'junior':
      case 'senior':
        return ['zhongkao', 'gaokao', 'cet4', 'cet6', 'tem4', 'tem8', 'zhigao', 'zhongzhi']
      case 'college':
        return ['cet4', 'cet6', 'kaoyan', 'ielts', 'toefl', 'tem4', 'tem8', 'zhigao', 'zhongzhi']
      case 'graduate':
        return ['cet4', 'cet6', 'kaoyan', 'ielts', 'toefl', 'tem4', 'tem8', 'zhigao', 'zhongzhi']
      case 'working':
      case 'freelance':
        return ['ielts', 'toefl', 'cet4', 'cet6', 'kaoyan', 'tem4', 'tem8', 'zhigao', 'zhongzhi']
      case 'primary':
        return ['zhongkao', 'gaokao', 'cet4', 'tem4', 'tem8', 'zhigao', 'zhongzhi']
      default:
        return ['cet4', 'cet6', 'kaoyan', 'gaokao', 'zhongkao', 'ielts', 'toefl', 'tem4', 'tem8', 'zhigao', 'zhongzhi']
    }
  })()

  const map = new Map(EXAM_OPTIONS.map((item) => [item.id, item]))
  const tailSet = new Set(EXAM_TAIL)
  const ordered = priority
    .filter((id) => !tailSet.has(id))
    .map((id) => map.get(id))
    .filter(Boolean) as OptionItem<ExamTarget>[]
  const rest = EXAM_OPTIONS.filter(
    (item) => !tailSet.has(item.id) && !priority.includes(item.id),
  )
  const tail = EXAM_TAIL.map((id) => map.get(id)).filter(Boolean) as OptionItem<ExamTarget>[]
  return [...ordered, ...rest, ...tail]
}
