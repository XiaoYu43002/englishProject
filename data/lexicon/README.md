# 三层词库（Lexicon）

目标结构：

1. **统一主词典** `words`：一词一行，可搜索、带音标与跨词书常用义  
2. **词书关系层** `books` + `word_book_entries`：四级 / 六级 / 考研等书内释义与排序  
3. **专业领域释义层** `domains` + `word_domain_meanings`：计算机 / 金融 / 生物 / 医学（骨架已就绪，释义待补）

## 构建

```bash
python3 scripts/build-lexicon-from-materials.py
```

默认读取：

- `materials/english_vocabulary_full_merged/full_merged.jsonl`
- `materials/english_vocabulary_full_by_book/output/books_manifest.json`

输出到 `data/lexicon/`：

| 文件 | 说明 |
|---|---|
| `schema.sql` | 表结构 |
| `zhimi-lexicon.sqlite` | 完整 SQLite 库 |
| `words.jsonl` | 主词典导出（一词一行） |
| `word_book_entries.jsonl` | 词↔词书关系导出 |
| `books.json` | 23 本词书元数据 |
| `domains.json` | 专业领域占位 |
| `manifest.json` | 校验与计数 |

## 接入 App

```bash
# 1) 从 materials 建主表
npm run build:lexicon

# 2) 并入旧 vocabulary.json 独有词，并导出 data/vocabulary.json + wordbooks.json
npm run integrate:lexicon

# 或一步完成
npm run sync:lexicon

# 3) 并入 ECDICT（考试 tag 词 + 增强已有释义/综合音标）
npm run import:ecdict

# 4) 并入专业领域词（materials/professional → 领域层 + 专业词书）
npm run import:professional
```

ECDICT 路径：`materials/ECDICT_complete_app_dictionary/`（约 235 万词）。  
**不会**整包写入 App：默认只导入 `by_tag` 考试词，并用全量 JSONL 增强库内已有词。

专业领域路径：`materials/professional/*.jsonl`（约 33.5 万词，20 个领域）。  
会写入 `domains` / `word_domain_meanings`，并生成 `pro_*` 词书供 App 学习。

导出后 Node API（`server/index.mjs`）会直接读取更新后的 `data/vocabulary.json` / `data/wordbooks.json`。
旧文件首次整合时备份到 `data/legacy-backup/`。

整合结果（参考）：

- 主表 ≈ materials 23881 + 旧库独有 707 ≈ **24588**
- 并入 ECDICT 考试标签后约 **25444**
- 再并入专业领域后约 **348002**（随材料变动）
- 词书 ≈ 考试/教材 27 本 + 专业领域 20 本 ≈ **47** 本

## 分层约定

- **主表不含** `meaningsByBook`；词书侧重点只放在 `word_book_entries.meanings_json`
- 主表 `meanings_json` 是跨词书合并后的常用义，用于全局搜索与默认展示
- 按词书学习时：`JOIN word_book_entries`，优先展示该书释义，再用主表常用义补齐
- 专业英语：写入 `word_domain_meanings`，不污染考试词书释义

## 来源

材料来自 KyleBing/english-vocabulary 整理后的 full 正序合并包，详见
`materials/english_vocabulary_full_merged/README.md`。
