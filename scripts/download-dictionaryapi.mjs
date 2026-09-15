#!/usr/bin/env node
/**
 * 批量拉取 Free Dictionary API（https://dictionaryapi.dev/）词义 / 音标 / 发音链接。
 * 结果落盘，便于以后当后台补充源（可断点续跑、限速、可选下载音频）。
 *
 * 用法：
 *   # 从词库拉前 20 个（试跑）
 *   node scripts/download-dictionaryapi.mjs --limit 20
 *
 *   # 拉整本词库（慢，建议挂后台）
 *   node scripts/download-dictionaryapi.mjs
 *
 *   # 指定单词
 *   node scripts/download-dictionaryapi.mjs hello present cancel
 *
 *   # 同时下载发音 mp3
 *   node scripts/download-dictionaryapi.mjs --limit 50 --download-audio
 *
 *   # 强制重拉已存在词条
 *   node scripts/download-dictionaryapi.mjs --limit 10 --force
 *
 * 环境变量：
 *   DICTAPI_DELAY_MS=800     请求间隔（默认 800）
 *   DICTAPI_TIMEOUT_MS=30000 单次超时
 *   DICTAPI_RETRIES=3        失败重试次数
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const outRoot = path.join(root, 'data', 'dictionaryapi')
const entriesDir = path.join(outRoot, 'entries')
const audioDir = path.join(outRoot, 'audio')
const progressPath = path.join(outRoot, 'progress.json')
const indexPath = path.join(outRoot, 'index.jsonl')
const summaryPath = path.join(outRoot, 'summary.json')

const delayMs = Number(process.env.DICTAPI_DELAY_MS || 800)
const timeoutMs = Number(process.env.DICTAPI_TIMEOUT_MS || 30000)
const retries = Number(process.env.DICTAPI_RETRIES || 3)

function parseArgs(argv) {
  const flags = {
    limit: 0,
    offset: 0,
    force: false,
    downloadAudio: false,
    words: [],
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit') flags.limit = Number(argv[++i] || 0)
    else if (arg === '--offset') flags.offset = Number(argv[++i] || 0)
    else if (arg === '--force') flags.force = true
    else if (arg === '--download-audio') flags.downloadAudio = true
    else if (arg === '--help' || arg === '-h') flags.help = true
    else if (!arg.startsWith('-')) flags.words.push(arg.toLowerCase())
  }
  return flags
}

function ensureDirs() {
  for (const dir of [outRoot, entriesDir, audioDir]) fs.mkdirSync(dir, { recursive: true })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeAudioUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (value.startsWith('//')) return `https:${value}`
  return value
}

function entryPath(word) {
  return path.join(entriesDir, `${word}.json`)
}

function loadVocabularyWords() {
  const vocabularyPath = path.join(root, 'data', 'vocabulary.json')
  const rows = JSON.parse(fs.readFileSync(vocabularyPath, 'utf8'))
  return rows.map((item) => String(item.word || item.id || '').trim().toLowerCase()).filter(Boolean)
}

function normalizeRecord(word, payload) {
  const entries = Array.isArray(payload) ? payload : []
  const phonetics = []
  const meanings = []
  const audios = []

  for (const entry of entries) {
    if (entry.phonetic) phonetics.push({ text: entry.phonetic, audio: '' })
    for (const item of entry.phonetics || []) {
      const audio = normalizeAudioUrl(item.audio)
      phonetics.push({ text: item.text || '', audio })
      if (audio) audios.push(audio)
    }
    for (const block of entry.meanings || []) {
      const pos = block.partOfSpeech || ''
      for (const def of block.definitions || []) {
        meanings.push({
          partOfSpeech: pos,
          definition: def.definition || '',
          example: def.example || '',
          synonyms: def.synonyms || [],
          antonyms: def.antonyms || [],
        })
      }
    }
  }

  const uniqueAudios = [...new Set(audios)]
  const phoneticTexts = [...new Set(phonetics.map((item) => item.text).filter(Boolean))]

  return {
    word,
    source: 'dictionaryapi.dev',
    fetchedAt: new Date().toISOString(),
    phonetic: phoneticTexts[0] || '',
    phonetics: phoneticTexts,
    audioUrls: uniqueAudios,
    meanings,
    meaningLines: meanings
      .filter((item) => item.definition)
      .map((item) => (item.partOfSpeech ? `${item.partOfSpeech}: ${item.definition}` : item.definition)),
    raw: entries,
  }
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'zhimi-uniapp-dictionaryapi-downloader/1.0',
      },
      signal: controller.signal,
    })
    const text = await response.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    return { response, data }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWithRetry(word) {
  const url = `${BASE}/${encodeURIComponent(word)}`
  let lastError = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const started = Date.now()
    try {
      const { response, data } = await fetchJson(url)
      const ms = Date.now() - started
      if (response.status === 404) {
        return { ok: false, status: 404, ms, error: 'not_found', data }
      }
      if (response.status === 429 || response.status >= 500) {
        const wait = delayMs * (attempt + (response.status === 429 ? 2 : 3))
        console.warn(`[retry] word=${word} status=${response.status} attempt=${attempt} wait=${wait}ms`)
        await sleep(wait)
        lastError = {
          status: response.status,
          ms,
          error: data?.title || data?.message || `HTTP ${response.status}`,
        }
        continue
      }
      if (!response.ok) {
        lastError = { status: response.status, ms, error: data?.title || data?.message || `HTTP ${response.status}` }
        await sleep(delayMs * attempt)
        continue
      }
      if (!Array.isArray(data) || !data.length) {
        return { ok: false, status: response.status, ms, error: 'empty_payload', data }
      }
      return { ok: true, status: response.status, ms, data }
    } catch (error) {
      lastError = { status: 0, ms: Date.now() - started, error: error.cause?.code || error.message || String(error) }
      await sleep(delayMs * attempt)
    }
  }
  return { ok: false, ...(lastError || { status: 0, ms: 0, error: 'unknown' }) }
}

async function downloadAudioFiles(word, urls) {
  const saved = []
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i]
    const ext = path.extname(new URL(url).pathname) || '.mp3'
    const file = path.join(audioDir, `${word}${i === 0 ? '' : `-${i}`}${ext}`)
    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
      saved.push(file)
      continue
    }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!response.ok) continue
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) continue
      fs.writeFileSync(file, buffer)
      saved.push(file)
    } catch {
      // 音频失败不阻断词义下载
    }
  }
  return saved
}

function appendIndex(line) {
  fs.appendFileSync(indexPath, `${JSON.stringify(line)}\n`)
}

function writeProgress(progress) {
  fs.writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`)
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  if (flags.help) {
    console.log(`Usage:
  node scripts/download-dictionaryapi.mjs [--limit N] [--offset N] [--force] [--download-audio] [word...]`)
    process.exit(0)
  }

  ensureDirs()
  const sourceWords = flags.words.length ? flags.words : loadVocabularyWords()
  const sliced = sourceWords.slice(flags.offset, flags.limit > 0 ? flags.offset + flags.limit : undefined)

  console.log(`[dictapi] words=${sliced.length} delay=${delayMs}ms retries=${retries} audio=${flags.downloadAudio}`)
  console.log(`[dictapi] out=${outRoot}`)

  const progress = {
    startedAt: new Date().toISOString(),
    total: sliced.length,
    done: 0,
    ok: 0,
    skipped: 0,
    notFound: 0,
    failed: 0,
  }

  for (const word of sliced) {
    const file = entryPath(word)
    if (!flags.force && fs.existsSync(file)) {
      progress.done += 1
      progress.skipped += 1
      if (progress.done % 50 === 0 || progress.done === sliced.length) {
        writeProgress({ ...progress, updatedAt: new Date().toISOString(), lastWord: word })
        console.log(`[skip] ${word}  (${progress.done}/${sliced.length})`)
      }
      continue
    }

    const result = await fetchWithRetry(word)
    if (result.ok) {
      const record = normalizeRecord(word, result.data)
      if (flags.downloadAudio && record.audioUrls.length) {
        record.localAudioFiles = await downloadAudioFiles(word, record.audioUrls)
      }
      fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
      appendIndex({
        word,
        ok: true,
        status: result.status,
        ms: result.ms,
        meanings: record.meanings.length,
        audioUrls: record.audioUrls.length,
        fetchedAt: record.fetchedAt,
      })
      progress.ok += 1
      console.log(`[ok] ${word}  ${result.ms}ms  meanings=${record.meanings.length} audio=${record.audioUrls.length}`)
    } else if (result.status === 404) {
      const miss = {
        word,
        source: 'dictionaryapi.dev',
        fetchedAt: new Date().toISOString(),
        error: 'not_found',
        meanings: [],
        meaningLines: [],
        audioUrls: [],
      }
      fs.writeFileSync(file, `${JSON.stringify(miss, null, 2)}\n`)
      appendIndex({ word, ok: false, status: 404, ms: result.ms, error: 'not_found' })
      progress.notFound += 1
      console.log(`[404] ${word}  ${result.ms}ms`)
    } else {
      appendIndex({ word, ok: false, status: result.status, ms: result.ms, error: result.error })
      progress.failed += 1
      console.log(`[fail] ${word}  status=${result.status} err=${result.error}`)
    }

    progress.done += 1
    writeProgress({ ...progress, updatedAt: new Date().toISOString(), lastWord: word })
    await sleep(delayMs)
  }

  const summary = {
    ...progress,
    finishedAt: new Date().toISOString(),
    entriesDir,
    indexPath,
  }
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`[dictapi] done ok=${progress.ok} skip=${progress.skipped} 404=${progress.notFound} fail=${progress.failed}`)
  process.exit(progress.failed ? 1 : 0)
}

main().catch((error) => {
  console.error('[dictapi] fatal', error)
  process.exit(1)
})
