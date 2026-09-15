#!/usr/bin/env node
/**
 * 探测 Free Dictionary API（https://dictionaryapi.dev/）是否可用。
 *
 * 用法：
 *   node tests/test_dictionaryapi_dev.mjs
 *   node tests/test_dictionaryapi_dev.mjs hello present cancel
 */

const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const words = process.argv.slice(2).length ? process.argv.slice(2) : ['hello', 'present', 'cancel']

function pickAudio(entry) {
  const list = Array.isArray(entry?.phonetics) ? entry.phonetics : []
  for (const item of list) {
    const audio = String(item?.audio || '').trim()
    if (audio) return audio.startsWith('//') ? `https:${audio}` : audio
  }
  return ''
}

function summarize(entry) {
  const meanings = []
  for (const block of entry?.meanings || []) {
    const pos = block.partOfSpeech || '?'
    for (const def of block.definitions || []) {
      if (def.definition) meanings.push(`${pos}: ${def.definition}`)
    }
  }
  return {
    word: entry?.word,
    phonetic: entry?.phonetic || entry?.phonetics?.[0]?.text || '',
    audio: pickAudio(entry),
    meaningCount: meanings.length,
    sampleMeanings: meanings.slice(0, 3),
  }
}

async function lookup(word) {
  const started = Date.now()
  const url = `${BASE}/${encodeURIComponent(word)}`
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'zhimi-uniapp-dictionary-probe/1.0' },
    })
    const ms = Date.now() - started
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }

    if (!response.ok) {
      return {
        ok: false,
        word,
        status: response.status,
        ms,
        error: data?.title || data?.message || text.slice(0, 160) || `HTTP ${response.status}`,
      }
    }

    if (!Array.isArray(data) || !data.length) {
      return { ok: false, word, status: response.status, ms, error: '响应不是词条数组' }
    }

    return {
      ok: true,
      word,
      status: response.status,
      ms,
      entries: data.length,
      ...summarize(data[0]),
    }
  } catch (error) {
    const cause = error?.cause
    const detail = cause?.code || cause?.message || error.message || String(error)
    return {
      ok: false,
      word,
      status: 0,
      ms: Date.now() - started,
      error: detail,
    }
  }
}

async function main() {
  console.log(`Free Dictionary API probe → ${BASE}/<word>`)
  console.log(`docs: https://dictionaryapi.dev/\n`)

  const results = []
  for (const word of words) {
    const result = await lookup(String(word).trim().toLowerCase())
    results.push(result)
    if (result.ok) {
      console.log(`✅ ${result.word}  HTTP ${result.status}  ${result.ms}ms  entries=${result.entries}`)
      console.log(`   phonetic: ${result.phonetic || '(none)'}`)
      console.log(`   audio: ${result.audio || '(none)'}`)
      for (const line of result.sampleMeanings) console.log(`   - ${line}`)
    } else {
      console.log(`❌ ${result.word}  HTTP ${result.status || '-'}  ${result.ms}ms`)
      console.log(`   error: ${result.error}`)
    }
    console.log('')
  }

  const passed = results.filter((item) => item.ok).length
  const failed = results.length - passed
  console.log(`summary: ${passed} passed / ${failed} failed / ${results.length} total`)
  process.exit(failed ? 1 : 0)
}

main()
