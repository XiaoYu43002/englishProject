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
```

导出后 Node API（`server/index.mjs`）会直接读取更新后的 `data/vocabulary.json` / `data/wordbooks.json`。
旧文件首次整合时备份到 `data/legacy-backup/`。

整合结果（参考）：

- 主表 ≈ materials 23881 + 旧库独有 707 ≈ **24588**
- 词书 = materials 23 本 + 保留旧书 初中/中考/高考/考研2024 共 **27** 本

## 分层约定

- **主表不含** `meaningsByBook`；词书侧重点只放在 `word_book_entries.meanings_json`
- 主表 `meanings_json` 是跨词书合并后的常用义，用于全局搜索与默认展示
- 按词书学习时：`JOIN word_book_entries`，优先展示该书释义，再用主表常用义补齐
- 专业英语：写入 `word_domain_meanings`，不污染考试词书释义

## 来源

材料来自 KyleBing/english-vocabulary 整理后的 full 正序合并包，详见
`materials/english_vocabulary_full_merged/README.md`。
