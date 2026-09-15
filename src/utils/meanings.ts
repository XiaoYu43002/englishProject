/** 一词多画像：词书侧重点 + 常用义补齐 */

export function uniqueMeanings(list: string[] = []) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const normalized = String(item || '').trim().replace(/\s+/g, ' ')
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

export function meaningsForBook(
  entry: { meanings?: string[]; meaningsByBook?: Record<string, string[]> } | null | undefined,
  bookId?: string,
) {
  if (!entry) return []
  const focused = bookId ? entry.meaningsByBook?.[bookId] || [] : []
  const common = entry.meanings || []
  return uniqueMeanings([...focused, ...common])
}
