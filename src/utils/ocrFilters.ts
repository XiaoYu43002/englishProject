import stopwordsList from '@/data/ocr-stopwords.json'

/** 拍词默认过滤的超常见词（不影响词书正常学习） */
export const OCR_STOPWORDS = new Set(
  (stopwordsList as string[]).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean),
)

export function isOcrStopword(word: string) {
  return OCR_STOPWORDS.has(String(word || '').trim().toLowerCase())
}

export function normalizeWordKey(word: string) {
  return String(word || '').trim().toLowerCase()
}
