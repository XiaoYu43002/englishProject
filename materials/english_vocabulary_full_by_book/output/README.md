# 英语学习 App 合并词库（full 正序）

本数据包从 `KyleBing/english-vocabulary/full_line_jsonl/full/正序` 的 23 本词书合并生成。
“乱序”目录没有参与合并。输出采用 UTF-8 JSONL：一行一个去重后的词条，适合流式导入
SQLite、PostgreSQL、Elasticsearch 或应用自己的词库数据库。

## 结果概览

- 原始词书：23 本
- 原始书内词条：116,953 条
- 合并后唯一词条：23,881 条
- 同时出现在多本词书中的词条：14,471 条
- 解析错误：0 条
- 需复核词条：1,666 条（本次均为缺少音标；释义仍保留）
- `full_merged.jsonl` SHA-256：`da90e6b5d340d15d0c2dc55b80cee4639447bde2b3f77fc25b7ccbce1cf7a2c2`

## 文件说明

| 文件 | 用途 |
|---|---|
| `full_merged.jsonl` | 主词库，一词一行，按词条不区分大小写排序并合并 |
| `review_required.jsonl` | 从主词库抽出的待补音标/待复核词条 |
| `sample_100.jsonl` | 前 100 条样例，方便前端联调 |
| `books_manifest.json` | 23 本词书的原始行数、唯一词数、重复数和缺音标统计 |
| `books/` | 按原词书名称分成 23 个目录 |
| `manifest.json` | 数据量、分书计数、校验和与处理结果 |
| `parse_errors.json` | 源数据解析异常；本次为空数组 |
| `merge_full_jsonl.py` | 可复现的合并脚本 |

## 分词书目录

`books/` 下保留 23 个与原仓库对应的目录，例如：

```text
books/
├── 四级/
│   ├── full.jsonl
│   ├── missing_phonetic.jsonl
│   ├── source_rows.jsonl
│   ├── source_rows_missing_phonetic.jsonl
│   └── manifest.json
├── 六级/
├── 考研/
└── ……
```

每本词书目录中的文件含义：

| 文件 | 含义 |
|---|---|
| `full.jsonl` | 该词书内部按单词合并去重后的完整版，适合直接导入 App |
| `missing_phonetic.jsonl` | `full.jsonl` 中缺少美音、英音和通用音标的唯一词条 |
| `source_rows.jsonl` | 与原仓库该词书行数严格一致的标准化版本，保留不同册次的重复词 |
| `source_rows_missing_phonetic.jsonl` | `source_rows.jsonl` 中每条原始记录缺音标的部分 |
| `manifest.json` | 该书原始行数、唯一词数、合并重复数、两种缺音标数量及 SHA-256 |

原仓库 README 中展示的“单词数”实际是 JSONL 行数；部分词书由多个册次组成，同一单词会重复出现。
因此 `source_rows.jsonl` 严格对应原标注数量，而 `full.jsonl` 会把同一本词书中的重复词合并。
例如四级原始为 7,508 行，词书内合并后为 4,544 个唯一词；建议 App 使用后者，核对源数据时使用前者。

## 单词结构

```json
{
  "id": "debate",
  "word": "debate",
  "usphone": "dɪ'bet",
  "ukphone": "dɪ'beɪt",
  "phone": "di'beit",
  "phonetics": {"us": ["dɪ'bet"], "uk": ["dɪ'beɪt"], "general": ["di'beit"]},
  "pronunciationRefs": {"us": ["debate&type=2"], "uk": ["debate&type=1"]},
  "meanings": ["辩论,争论,讨论", "辩论;辩论会"],
  "meaningsByBook": {"cet4": ["争论,辩论"], "cet6": ["争论, 辩论"]},
  "bookIds": ["cet4", "cet6"],
  "bookNames": {"cet4": "大学英语四级", "cet6": "大学英语六级"},
  "sourceBookIds": ["CET4_2", "CET4_3", "CET6_3"],
  "translations": [],
  "phrases": [],
  "sentences": [],
  "realExamSentences": [],
  "synonyms": [],
  "antonyms": [],
  "relatedWords": [],
  "memoryMethods": [],
  "exams": [],
  "sourceEntries": [],
  "reviewRequired": false
}
```

### 主要字段

| 字段 | 含义 |
|---|---|
| `id`, `word` | 规范词条；按用户要求，ID 与单词相同 |
| `usphone`, `ukphone`, `phone` | 主美音、英音和通用音标；有多个版本时选源数据中出现频率最高者 |
| `phonetics` | 所有非空音标变体，避免合并时丢失差异 |
| `pronunciationRefs` | 原仓库的发音引用标识，不是可直接播放的完整 URL |
| `meanings` | 跨词书去重后的中文释义 |
| `meaningsByBook` | 按逻辑词书 ID 保存的中文释义 |
| `bookIds`, `bookNames` | 词条出现在哪些逻辑词书中 |
| `sourceBookIds` | 原始册次 ID，例如 `CET4_2`、`PEPChuZhong7_2` |
| `translations` | 结构化词性、中释、英释及来源词书 |
| `phrases` | 短语、中文释义及来源词书 |
| `sentences` | 普通例句、中译及来源词书 |
| `realExamSentences` | 真题例句及年份、试卷、题型等来源信息 |
| `synonyms`, `antonyms` | 同近义词、反义词 |
| `relatedWords` | 同根词、词性和释义 |
| `memoryMethods` | 原数据中的记忆法 |
| `exams` | 选择题、选项、答案和解析等原始结构 |
| `sourceEntries` | 每个来源词条的原始 `wordId`、排名、册次等追溯信息 |
| `reviewRequired` | 当前规则为“无释义或所有音标均为空”时标为 `true` |

数组内对象的 `bookIds` 表示该内容来自哪些词书。同一句例句或同一条释义在不同词书中重复时，
只保留一份内容并合并来源。

## 逻辑词书 ID

`gmat`、`gre`、`sat`、`tem8`、`tem4`、`pep_junior_7`、`pep_junior_8`、
`pep_junior_9`、`pep_primary_3`、`pep_primary_4`、`pep_primary_5`、
`pep_primary_6`、`pep_senior`、`cet6`、`junior_high`、`bnu_senior`、`bec`、
`cet4`、`fltrp_junior`、`toefl`、`postgraduate`、`ielts`、`senior_high`。

## App 接入建议

不要在小程序启动时把整个 JSONL 读入内存。建议在构建阶段流式导入 SQLite/后端数据库，
以 `id` 建唯一索引，以 `bookIds` 建关联表或倒排索引；客户端只下发用户正在学习的词书和分页内容。
`pronunciationRefs` 只是源仓库标识，正式发音仍需接入有道、系统 TTS 或自建 TTS，并注意缓存和授权。

## 复现

```bash
python3 merge_full_jsonl.py \
  english-vocabulary/full_line_jsonl/full/正序 \
  output
```

脚本会校验输入必须为 23 个正序词书文件，并输出解析错误和 SHA-256。

## 来源与使用提醒

数据来源：<https://github.com/KyleBing/english-vocabulary>。仓库 README 表述其用于学习与共享，
但在本次获取的仓库根目录中未发现明确的许可证文件。若应用准备公开发布或商业化，请在上线前向原作者确认
词库、例句、真题内容和发音资源的授权范围，并保留来源说明。本数据包仅做格式整理与去重，不改变原始内容权利归属。
