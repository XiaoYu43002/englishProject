import { starterBooks, starterWords } from '@/data/catalog.generated'
import { apiUrl } from '@/config/api'
import type { VocabularyWord, WordBook } from '@/types/domain'

export const localBooks: WordBook[] = starterBooks.map((book) => ({ ...book }))

export function getLocalWords(bookId: string): VocabularyWord[] {
  const source = starterWords[bookId as keyof typeof starterWords] || []
  return source.map((word) => ({
    ...word,
    meanings: [...word.meanings],
    bookIds: [...word.bookIds],
    meaningsByBook: word.meaningsByBook
      ? Object.fromEntries(Object.entries(word.meaningsByBook).map(([id, list]) => [id, [...list]]))
      : undefined,
    activeBookId: bookId,
  }))
}

interface ApiBookWordsResponse {
  items: VocabularyWord[]
  total: number
}

export async function fetchBookWords(bookId: string, limit = 120, offset = 0): Promise<ApiBookWordsResponse> {
  const endpoint = apiUrl(`/api/books/${encodeURIComponent(bookId)}/words?limit=${limit}&offset=${offset}`)
  if (!endpoint) return { items: getLocalWords(bookId), total: getLocalWords(bookId).length }

  try {
    return await new Promise<ApiBookWordsResponse>((resolve, reject) => {
      uni.request({
        url: endpoint,
        timeout: 8000,
        success: (response) => {
          const data = response.data as ApiBookWordsResponse
          if (response.statusCode !== 200 || !data?.items) reject(new Error('catalog request failed'))
          else resolve(data)
        },
        fail: reject,
      })
    })
  } catch {
    const items = getLocalWords(bookId)
    return { items, total: items.length }
  }
}
