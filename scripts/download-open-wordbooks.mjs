import fs from 'node:fs'
import path from 'node:path'

// RealKai42/qwerty-learner，近三年持续维护（GPL-3.0）
// 通过 jsDelivr 拉取，避免 raw.githubusercontent.com 在部分网络下失败
const commit = process.env.QWERTY_LEARNER_COMMIT || 'master'
const files = [
  'CET4_T.json',
  'CET6_T.json',
  'GaoKao_3500.json',
  'GRE_1500.json',
  'IELTS_3_T.json',
  'TOEFL_3_T.json',
  'KaoYan_2024.json',
  'ZhongKaoHeXin.json',
  'SAT_3_T.json',
  'Level4luan_2_T.json',
  'GRE3000_3_T.json',
  'BEC_2_T.json',
  'ChuZhongluan_2_T.json',
]
const destination = path.resolve(import.meta.dirname, '..', 'inputs', 'qwerty-learner')
fs.mkdirSync(destination, { recursive: true })

for (const file of files) {
  const url = `https://cdn.jsdelivr.net/gh/RealKai42/qwerty-learner@${commit}/public/dicts/${file}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载 ${file} 失败：HTTP ${response.status}`)
  const text = await response.text()
  JSON.parse(text) // 校验 JSON
  fs.writeFileSync(path.join(destination, file), text)
  console.log(`Downloaded ${file}`)
}
