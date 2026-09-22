import type { WordBook } from '@/types/domain'

export interface BookCategory {
  id: string
  label: string
  letter: string
  /** 归入该类的词书 id；暂无数据时可为空 */
  bookIds: string[]
}

/** 选词书页分类（暂时按此列表展示） */
export const BOOK_CATEGORIES: BookCategory[] = [
  {
    id: 'primary',
    label: '小学英语',
    letter: 'P',
    bookIds: ['pep_primary_3', 'pep_primary_4', 'pep_primary_5', 'pep_primary_6'],
  },
  {
    id: 'junior',
    label: '初中英语',
    letter: 'J',
    bookIds: [
      'junior_high',
      'chuzhong',
      'zhongkao',
      'pep_junior_7',
      'pep_junior_8',
      'pep_junior_9',
      'fltrp_junior',
    ],
  },
  {
    id: 'senior',
    label: '高中英语',
    letter: 'S',
    bookIds: ['senior_high', 'gaokao', 'pep_senior', 'bnu_senior'],
  },
  {
    id: 'cet4',
    label: '大学四级 CET-4',
    letter: '4',
    bookIds: ['cet4'],
  },
  {
    id: 'cet6',
    label: '大学六级 CET-6',
    letter: '6',
    bookIds: ['cet6'],
  },
  {
    id: 'tem4',
    label: '专四词汇 TEM-4',
    letter: 'T',
    bookIds: ['tem4'],
  },
  {
    id: 'tem8',
    label: '专八词汇 TEM-8',
    letter: 'E',
    bookIds: ['tem8'],
  },
  {
    id: 'college-textbooks',
    label: '大学英语教科书',
    letter: 'C',
    bookIds: [],
  },
  {
    id: 'zhuanshengben',
    label: '专升本词汇',
    letter: 'Z',
    bookIds: [],
  },
  {
    id: 'ielts',
    label: '雅思词汇',
    letter: 'I',
    bookIds: ['ielts'],
  },
  {
    id: 'toefl',
    label: '托福词汇',
    letter: 'F',
    bookIds: ['toefl'],
  },
]

export function booksInCategory(
  category: BookCategory,
  books: WordBook[],
): WordBook[] {
  const map = new Map(books.map((book) => [book.id, book]))
  return category.bookIds
    .map((id) => map.get(id))
    .filter(Boolean) as WordBook[]
}
