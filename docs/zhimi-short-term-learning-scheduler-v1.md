# 知觅英语短时学习调度器 V1

面向新词当天学习阶段的“认识、模糊、忘记”状态机与动态队列实现指南。适用于 uni-app、Vue 3、TypeScript 与 Pinia。

- 版本：V1.0
- 算法类型：规则状态机
- 适用范围：新词当天短时学习
- 后续衔接：SSP-MMC长期复习调度

## 目录

1. [方案概览](#1-方案概览)
2. [状态定义](#2-状态定义)
3. [状态转移规则](#3-状态转移规则)
4. [第一版间隔参数](#4-第一版间隔参数)
5. [新学10、50、100个词的处理](#5-新学1050100个词的处理)
6. [动态队列与选卡优先级](#6-动态队列与选卡优先级)
7. [困难词处理](#7-困难词处理)
8. [TypeScript数据模型](#8-typescript数据模型)
9. [核心TypeScript算法](#9-核心typescript算法)
10. [必须记录的学习日志](#10-必须记录的学习日志)
11. [第一版验收测试](#11-第一版验收测试)
12. [与长期复习调度衔接](#12-与长期复习调度衔接)
13. [开发实施清单](#13-开发实施清单)

## 1. 方案概览

第一版不需要机器学习，采用“有限状态机（FSM）＋动态优先队列＋时间/卡片双条件调度”。先保证逻辑稳定、可解释并记录数据，后续再用真实用户数据优化参数。

**短时学习器负责**  
把新词从陌生、模糊推进到当天初步掌握，时间尺度为秒到小时。

**长期调度器负责**  
单词初步掌握后，决定未来几天、几十天后的复习时间。

**核心原则：**第一次认识可直接通过；模糊需要一次延迟后的完整回忆；忘记需要重新学习，并完成两次有间隔的成功回忆。

## 2. 状态定义

| 内部状态     | 中文名称     | 含义                                                       |
|--------------|--------------|------------------------------------------------------------|
| `NEW`        | 第一次学习   | 当天第一次看到该单词，尚未产生反馈。                       |
| `LEARNING_1` | 重新记忆     | 用户刚刚没想起来，需要重新编码并进行快速检查。             |
| `LEARNING_2` | 延迟验证     | 用户已有印象或刚成功回忆一次，需要隔开其他单词后再次验证。 |
| `HARD`       | 困难词       | 当天多次忘记或反复退步，暂停普通循环，稍后更换方式再学。   |
| `GRADUATED`  | 当天初步掌握 | 完成短时学习，移交长期复习调度器。                         |

### LEARNING 1：重新记忆

进入条件：第一次选择“忘记”、延迟验证时再次忘记，或者长期复习时忘记。建议展示发音、核心释义、短例句/搭配，必要时追加词根、助记或易混词。

### LEARNING 2：延迟验证

进入条件：第一次选择“模糊”，或者在 LEARNING 1 中选择“认识”。它的作用是排除刚看过答案造成的短时视觉熟悉感。

## 3. 状态转移规则

```text
NEW 第一次学习
├─ 认识 → GRADUATED
├─ 模糊 → LEARNING_2 延迟验证
└─ 忘记 → LEARNING_1 重新记忆

LEARNING_1 重新记忆
├─ 认识 → LEARNING_2
├─ 模糊 → LEARNING_1
└─ 忘记 → LEARNING_1
                 └─ 多次忘记 → HARD

LEARNING_2 延迟验证
├─ 认识 → GRADUATED
├─ 模糊 → LEARNING_2
└─ 忘记 → LEARNING_1

HARD 困难词
└─ 更换学习方式，30分钟后 → LEARNING_1
```

| 当前状态 | 认识 KNOW      | 模糊 FUZZY | 忘记 FORGET    |
|----------|----------------|------------|----------------|
| NEW      | 直接 GRADUATED | 进入 L2    | 进入 L1        |
| L1       | 进入 L2        | 留在 L1    | 留在 L1        |
| L2       | 进入 GRADUATED | 留在 L2    | 退回 L1        |
| HARD     | 进入 L2        | 稍后继续   | 继续困难词处理 |

**毕业标准：**第一次模糊，需要之后完成1次延迟、无提示的认识；第一次忘记，需要在 L1 和 L2 中分别成功回忆，合计2次有间隔的认识。

## 4. 第一版间隔参数

| 状态变化     | 最少间隔卡片 | 最短时间 | 最长等待     |
|--------------|--------------|----------|--------------|
| NEW忘记 → L1 | 2张          | 30秒     | 60秒         |
| NEW模糊 → L2 | 4张          | 45秒    | 2分钟        |
| L1认识 → L2  | 5张          | 1分钟    | 6分钟        |
| L1模糊 → L1  | 3张          | 2分钟    | 3分钟        |
| L1忘记 → L1  | 2张          | 30秒     | 90秒         |
| L2模糊 → L2  | 5张          | 2分钟    | 5分钟        |
| L2忘记 → L1  | 2张          | 45秒     | 2分钟        |
| HARD → L1    | 不限制       | 15分钟   | 20分钟 |

### 三个参数分别代表什么

- **最少间隔卡片：**同一单词两次出现之间，至少经过多少张其他单词卡，防止连续机械重复。
- **最短时间：**即使卡片数已经达到，也必须经过的最短时间，防止用户快速滑动。
- **最长等待：**如果卡片数量一直不足，到达该时间后也允许出现，防止单词永久被压在队列后面。

    canShowAgain =
      (cardsSinceLastSeen >= minCards && elapsedSeconds >= minSeconds)
      || elapsedSeconds >= maxSeconds

例：忘记后规则为“2张卡、30秒、90秒”。隔2张卡但只过20秒不能出现；隔2张卡且过40秒可以出现；只隔1张卡但已过90秒，也可以兜底出现。

## 5. 新学10、50、100个词的处理

统一采用“每批10个＋动态穿插＋最多15个处于学习中”。分批只是内部策略，用户不需要明显感知。

| 每日新词量 | 内部分批  | 运行方式                               |
|------------|-----------|----------------------------------------|
| 10个       | 1批 × 10  | 新词与到期的 L1/L2 穿插。              |
| 50个       | 5批 × 10  | 上一批的延迟验证可以穿插进下一批。     |
| 100个      | 10批 × 10 | 在学词达到15个时暂停新增，清理后继续。 |

**准入控制：**同时处于 L1/L2 的单词达到15个时暂停新增；降到10个后再恢复新增。连续新词最多5张，普通词当天最多出现5次。不能“先过完100个新词，再回头复习”。

其中“处于学习中”只计算 `LEARNING_1` 和 `LEARNING_2`，不计算尚未展示的 `NEW`、已经毕业的 `GRADUATED` 和暂时移出普通队列的 `HARD`。

```ts
const BATCH_SIZE = 10
const PAUSE_NEW_AT = 15
const RESUME_NEW_AT = 10
```

## 6. 动态队列与选卡优先级

系统至少维护新词队列、L1队列、L2队列、困难词队列；长期复习词还可以作为等待期间的填充内容。

1.  已经达到最长等待的卡片（防止饿死）。
2.  已到期的 L1 重新记忆词。
3.  已到期的 L2 延迟验证词。
4.  当前批次的 NEW 新词（未处于“暂停新增”状态）。
5.  到期的长期复习词。
6.  下一批新词。

如果当前没有任何可展示卡片，不要反复展示同一个词。可以展示长期复习词，或者结束当前小轮，把未到期词放入“今日待巩固”。

## 7. 困难词处理

满足任意一项即进入 HARD：

- 当天累计选择“忘记”达到3次；
- 当天出现5次仍未毕业；
- 从 L2 退回 L1 达到2次；
- 连续出现同一种错误或混淆。

**不要无限轰炸：**HARD词移出普通队列，换用发音、例句、词根或易混词对比，30分钟后再回到 L1；当天仍无法掌握则第二天优先复习。

## 8. TypeScript数据模型

    export type LearningState =
      | 'NEW'
      | 'LEARNING_1'
      | 'LEARNING_2'
      | 'HARD'
      | 'GRADUATED'

    export type LearningRating = 'KNOW' | 'FUZZY' | 'FORGET'

    export interface IntervalRule {
      minCards: number
      minSeconds: number
      maxSeconds: number
    }

    export interface ShortTermWord {
      wordId: string
      state: LearningState
      intervalRule?: IntervalRule
      lastRatedAt?: number
      lastSeenSequence?: number
      exposureCountToday: number
      forgetCountToday: number
      downgradeCountToday: number
      hintUsed: boolean
      nextDueAt?: number
      hardDueAt?: number
      firstRating?: LearningRating
    }

### 间隔配置

```ts
export const INTERVAL_RULES = {
  NEW_FORGET: { minCards: 2, minSeconds: 30,  maxSeconds: 60 },
  NEW_FUZZY:  { minCards: 4, minSeconds: 45,  maxSeconds: 120 },
  L1_KNOW:    { minCards: 5, minSeconds: 60,  maxSeconds: 360 },
  L1_FUZZY:   { minCards: 3, minSeconds: 120, maxSeconds: 180 },
  L1_FORGET:  { minCards: 2, minSeconds: 30,  maxSeconds: 90 },
  L2_FUZZY:   { minCards: 5, minSeconds: 120, maxSeconds: 300 },
  L2_FORGET:  { minCards: 2, minSeconds: 45,  maxSeconds: 120 },
} satisfies Record<string, IntervalRule>
```

> 实现源码：`src/services/shortTermScheduler.ts`（与上表 §4 一致）。

## 9. 核心TypeScript算法

### 调度与毕业

    function schedule(
      card: ShortTermWord,
      state: LearningState,
      rule: IntervalRule,
      now: number
    ): ShortTermWord {
      return {
        ...card,
        state,
        intervalRule: rule,
        nextDueAt: now + rule.minSeconds * 1000
      }
    }

    function graduate(card: ShortTermWord): ShortTermWord {
      return {
        ...card,
        state: 'GRADUATED',
        intervalRule: undefined,
        nextDueAt: undefined
      }
    }

    function shouldEnterHard(card: ShortTermWord): boolean {
      return card.forgetCountToday >= 3
        || card.exposureCountToday >= 5
        || card.downgradeCountToday >= 2
    }

    function enterHardState(card: ShortTermWord, now: number): ShortTermWord {
      return {
        ...card,
        state: 'HARD',
        intervalRule: undefined,
        nextDueAt: undefined,
        hardDueAt: now + 30 * 60 * 1000
      }
    }

### 处理用户反馈

    export function applyRating(
      card: ShortTermWord,
      rating: LearningRating,
      now: number,
      currentSequence: number
    ): ShortTermWord {
      const updated: ShortTermWord = {
        ...card,
        exposureCountToday: card.exposureCountToday + 1,
        forgetCountToday:
          card.forgetCountToday + (rating === 'FORGET' ? 1 : 0),
        lastRatedAt: now,
        lastSeenSequence: currentSequence,
        firstRating:
          card.firstRating ?? (card.state === 'NEW' ? rating : undefined)
      }

      let next: ShortTermWord

      switch (card.state) {
        case 'NEW':
          if (rating === 'KNOW') return graduate(updated)
          next = rating === 'FUZZY'
            ? schedule(updated, 'LEARNING_2', INTERVAL_RULES.NEW_FUZZY, now)
            : schedule(updated, 'LEARNING_1', INTERVAL_RULES.NEW_FORGET, now)
          break

        case 'LEARNING_1':
          if (rating === 'KNOW') {
            next = schedule(updated, 'LEARNING_2', INTERVAL_RULES.L1_KNOW, now)
          } else if (rating === 'FUZZY') {
            next = schedule(updated, 'LEARNING_1', INTERVAL_RULES.L1_FUZZY, now)
          } else {
            next = schedule(updated, 'LEARNING_1', INTERVAL_RULES.L1_FORGET, now)
          }
          break

        case 'LEARNING_2':
          if (rating === 'KNOW') return graduate(updated)
          if (rating === 'FUZZY') {
            next = schedule(updated, 'LEARNING_2', INTERVAL_RULES.L2_FUZZY, now)
          } else {
            updated.downgradeCountToday += 1
            next = schedule(updated, 'LEARNING_1', INTERVAL_RULES.L2_FORGET, now)
          }
          break

        case 'HARD':
          next = rating === 'KNOW'
            ? schedule(updated, 'LEARNING_2', INTERVAL_RULES.L1_KNOW, now)
            : enterHardState(updated, now)
          break

        case 'GRADUATED':
          return updated
      }

      return next.state !== 'GRADUATED' && shouldEnterHard(next)
        ? enterHardState(next, now)
        : next
    }

### 判断能否再次出现

    export function isEligible(
      card: ShortTermWord,
      now: number,
      currentSequence: number
    ): boolean {
      if (card.state === 'GRADUATED') return false
      if (card.state === 'NEW') return true

      if (card.state === 'HARD') {
        return card.hardDueAt !== undefined && now >= card.hardDueAt
      }

      if (!card.intervalRule
          || card.lastRatedAt === undefined
          || card.lastSeenSequence === undefined) {
        return false
      }

      const elapsedSeconds = (now - card.lastRatedAt) / 1000
      const cardsSinceLastSeen = currentSequence - card.lastSeenSequence

      return (
        cardsSinceLastSeen >= card.intervalRule.minCards
        && elapsedSeconds >= card.intervalRule.minSeconds
      ) || elapsedSeconds >= card.intervalRule.maxSeconds
    }

### 选择下一张卡

    export function getNextCard(
      cards: ShortTermWord[],
      now: number,
      currentSequence: number
    ): ShortTermWord | null {
      const eligible = cards.filter(card =>
        isEligible(card, now, currentSequence)
      )

      // 1. 最长等待已到：绝对优先
      const forced = eligible
        .filter(card => {
          if (!card.intervalRule || card.lastRatedAt === undefined) return false
          return now - card.lastRatedAt >=
            card.intervalRule.maxSeconds * 1000
        })
        .sort((a, b) => (a.lastRatedAt ?? 0) - (b.lastRatedAt ?? 0))
      if (forced[0]) return forced[0]

      // 2. 快速重新记忆
      const learning1 = eligible
        .filter(card => card.state === 'LEARNING_1')
        .sort((a, b) => (a.nextDueAt ?? 0) - (b.nextDueAt ?? 0))
      if (learning1[0]) return learning1[0]

      // 3. 延迟验证
      const learning2 = eligible
        .filter(card => card.state === 'LEARNING_2')
        .sort((a, b) => (a.nextDueAt ?? 0) - (b.nextDueAt ?? 0))
      if (learning2[0]) return learning2[0]

  // 4. 控制同时学习中的单词数量。
  // 完整业务层应记录 newWordsPaused：达到15时设为 true，降到10时恢复。
      const activeCount = cards.filter(card =>
        card.state === 'LEARNING_1' || card.state === 'LEARNING_2'
      ).length

      if (activeCount < 15) {
        return cards.find(card => card.state === 'NEW') ?? null
      }

      return null
    }

**工程注意：**还需在调用层限制“连续新词最多5张”和“不能立即返回上一张同一单词”。当 `getNextCard()` 返回空时，再尝试长期复习词或结束本轮。

## 10. 必须记录的学习日志

实现：`src/services/learningEventRepository.ts`，本地键 `zhimi-short-term-events`。

```ts
export interface ShortTermLearningEvent {
  eventId: string
  userId: string
  wordId: string
  learningDate: string // YYYY-MM-DD
  bookId: string
  rating: LearningRating // KNOW | FUZZY | FORGET
  stateBefore: LearningState
  stateAfter: LearningState
  shownAt: number // 本次出现时间
  answerRevealedAt?: number
  ratedAt: number
  recallTimeMs?: number
  secondsSinceLastSeen: number // 距上次出现；首次 -1
  cardsSinceLastSeen: number   // 中间间隔卡数；首次 -1
  sequence: number
  exposureCountToday: number   // 当天出现次数
  forgetCountToday: number     // 当天忘记次数
  downgradeCountToday: number  // L2→L1 次数
  enteredHard: boolean         // 本次是否进入 HARD
  graduatedAt?: number         // 进入 GRADUATED 的时间
  audioPlayed: boolean
  hintUsed: boolean
  algorithmVersion: 'short-term-v1'
}
```

原始事件日志不能只保留最终状态。后续优化“30秒还是60秒”“隔3张还是5张”全部依赖这些数据。

**工程入口：**`src/services/shortTermSession.ts`（会话）+ `src/stores/learning.ts` 的 `markCurrentWord` / `startTodayLearning`。

## 11. 第一版验收测试

| 编号 | 输入路径                  | 预期结果                                     |
|------|---------------------------|----------------------------------------------|
| T01  | NEW → 认识                | 立即进入 GRADUATED，当天不再出现。           |
| T02  | NEW → 模糊                | 进入 L2；未到45秒且未达最长等待时不得出现。 |
| T03  | NEW → 模糊 → L2认识       | 进入 GRADUATED。                             |
| T04  | NEW → 忘记                | 进入 L1；隔2张且过30秒后可出现。             |
| T05  | NEW忘记 → L1认识          | 进入 L2，不能直接毕业。                      |
| T06  | NEW忘记 → L1认识 → L2认识 | 完成两次成功回忆后毕业。                     |
| T07  | 连续忘记3次               | 进入 HARD，普通队列不再立即展示。            |
| T08  | 隔2张卡但只过20秒         | 不满足最短时间，不可出现。                   |
| T09  | 只隔1张卡但已过最长等待   | 触发兜底，可以出现。                         |
| T10  | 100词且在学词达到15个     | 暂停新增，优先处理 L1/L2。                   |

## 12. 与长期复习调度衔接

进入 GRADUATED 后，短时学习结束，调用长期调度器初始化单词记忆状态。SSP-MMC尚未接入前，可以使用临时规则：

| 当天学习路径         | 临时首次跨天复习 | 难度种子 |
|----------------------|------------------|----------|
| 第一次直接认识       | 3天后            | 简单     |
| 第一次模糊，随后毕业 | 2天后            | 中等     |
| 第一次忘记，随后毕业 | 1天后            | 较难     |
| 进入过 HARD          | 第二天           | 困难     |

未来接入 SSP-MMC 时，只替换毕业后的长期间隔计算，短时状态机本身无需推翻。

## 13. 开发实施清单

- 建立 NEW、L1、L2、HARD、GRADUATED 五个状态。
- 实现三种反馈对应的状态转移。
- 实现卡片间隔数和经过时间的双重判断。
- 实现最长等待兜底。
- 每日新词按10个一批加载。
- 在学词达到15个时暂停开放新词。
- 实现困难词条件和30分钟延后。
- 记录每一次学习事件，而不是只记录最终结果。
- 完成至少10项验收测试。
- 为后续SSP-MMC保留长期调度接口。

**建议模块名：**`shortTermScheduler.ts`、`learningSession.store.ts`、`learningEvent.repository.ts`。算法版本统一写入 `short-term-v1`，方便以后灰度升级和对比。

知觅英语 · 短时学习调度器 V1 · 开发实现指南
