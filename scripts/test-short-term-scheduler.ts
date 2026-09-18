/**
 * 短时调度器验收测试 T01–T10
 * 运行：node --experimental-strip-types scripts/test-short-term-scheduler.ts
 */
import {
  applyRating,
  createEmptyCard,
  createSessionSnapshot,
  getNextCard,
  isEligible,
  INTERVAL_RULES,
  countActiveLearning,
  BATCH_SIZE,
  PAUSE_NEW_AT,
} from '../src/services/shortTermScheduler'

let passed = 0
let failed = 0

function assert(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed += 1
    console.log(`PASS  ${name}`)
  } else {
    failed += 1
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function card(id: string) {
  return createEmptyCard(id, 'cet4')
}

// T01 NEW → 认识 → GRADUATED
{
  const t0 = 1_000_000
  const next = applyRating(card('a'), 'KNOW', t0, 1)
  assert('T01 NEW→认识→GRADUATED', next.state === 'GRADUATED' && Boolean(next.graduatedAt))
}

// T02 NEW → 模糊 → L2；卡数不够且未到最长等待时不可出现
{
  const t0 = 1_000_000
  let c = applyRating(card('b'), 'FUZZY', t0, 1)
  assert('T02a 进入 L2', c.state === 'LEARNING_2')
  // 只隔 1 张（sequence 2），20 秒：卡数不够，也未到 max 120s
  assert(
    'T02b 卡数不足时不可出现',
    !isEligible(c, t0 + 20_000, 2),
    `rule=${JSON.stringify(c.intervalRule)}`,
  )
  // 隔满 4 张且过防连点 2 秒即可
  assert('T02c 卡数够即可出现', isEligible(c, t0 + 3_000, 5))
}

// T03 NEW → 模糊 → L2认识 → GRADUATED
{
  const t0 = 1_000_000
  let c = applyRating(card('c'), 'FUZZY', t0, 1)
  c = applyRating(c, 'KNOW', t0 + 200_000, 6)
  assert('T03 L2认识→GRADUATED', c.state === 'GRADUATED')
}

// T04 NEW → 忘记 → L1；隔2张且过防连点即可
{
  const t0 = 1_000_000
  const c = applyRating(card('d'), 'FORGET', t0, 1)
  assert('T04a 进入 L1', c.state === 'LEARNING_1')
  assert('T04b 隔2张但仅1秒不可', !isEligible(c, t0 + 1_000, 3))
  assert('T04c 隔2张且3秒可', isEligible(c, t0 + 3_000, 3))
}

// T05 NEW忘记 → L1认识 → L2（不能直接毕业）
{
  const t0 = 1_000_000
  let c = applyRating(card('e'), 'FORGET', t0, 1)
  c = applyRating(c, 'KNOW', t0 + 60_000, 4)
  assert('T05 L1认识→L2 非毕业', c.state === 'LEARNING_2')
}

// T06 NEW忘记 → L1认识 → L2认识 → 毕业
{
  const t0 = 1_000_000
  let c = applyRating(card('f'), 'FORGET', t0, 1)
  c = applyRating(c, 'KNOW', t0 + 60_000, 4)
  c = applyRating(c, 'KNOW', t0 + 300_000, 10)
  assert('T06 两次成功回忆后毕业', c.state === 'GRADUATED')
}

// T07 连续忘记3次 → HARD
{
  const t0 = 1_000_000
  let c = applyRating(card('g'), 'FORGET', t0, 1)
  c = applyRating(c, 'FORGET', t0 + 60_000, 3)
  c = applyRating(c, 'FORGET', t0 + 120_000, 5)
  assert('T07 忘记3次→HARD', c.state === 'HARD' && c.enteredHardToday)
}

// T08 隔2张卡但只过1秒 → 不可（防连点）
{
  const t0 = 1_000_000
  const c = applyRating(card('h'), 'FORGET', t0, 1)
  assert('T08', !isEligible(c, t0 + 1_000, 3))
}

// T09 只隔1张卡但已过最长等待 → 可
{
  const t0 = 1_000_000
  const c = applyRating(card('i'), 'FORGET', t0, 1)
  const maxMs = INTERVAL_RULES.NEW_FORGET.maxSeconds * 1000
  assert('T09', isEligible(c, t0 + maxMs, 2))
}

// T10 100词且在学达到15 → 暂停新增
{
  const ids = Array.from({ length: 100 }, (_, i) => `w${i}`)
  const session = createSessionSnapshot({
    learningDate: '2026-09-18',
    bookId: 'cet4',
    dailyTarget: 100,
    wordIds: ids,
  })
  // 人为把前15个推到 L1
  const now = 1_000_000
  for (let i = 0; i < PAUSE_NEW_AT; i += 1) {
    session.cards[i] = applyRating(session.cards[i], 'FORGET', now + i * 1000, i + 1)
  }
  session.sequence = PAUSE_NEW_AT
  session.introducedLimit = 100
  session.newWordsPaused = true
  session.consecutiveNewCount = 0
  const active = countActiveLearning(session.cards)
  assert('T10a 在学=15', active === PAUSE_NEW_AT)
  const pick = getNextCard(session.cards, now + 120_000, session.sequence, {
    consecutiveNewCount: 0,
    newWordsPaused: true,
    introducedLimit: 100,
    lastWordId: null,
  })
  assert(
    'T10b 暂停时不选 NEW',
    pick.card !== null && pick.card.state !== 'NEW',
    `got ${pick.card?.state} reason=${pick.reason}`,
  )
  assert('T10c 批次常量', BATCH_SIZE === 10)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
