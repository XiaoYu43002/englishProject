-- 知觅英语三层词库
-- 1) words              统一主词典（一词一行）
-- 2) books + word_book_entries  多本词书关系层
-- 3) domains + word_domain_meanings  专业领域释义层（可后续扩展）

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Layer 1: 统一主词典
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,                 -- 与规范词条相同，便于检索与导入
  word TEXT NOT NULL,                  -- 展示用原文
  word_norm TEXT NOT NULL,             -- 小写规范化，用于搜索/去重
  usphone TEXT NOT NULL DEFAULT '',
  ukphone TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  phonetics_json TEXT NOT NULL DEFAULT '{}',
  pronunciation_refs_json TEXT NOT NULL DEFAULT '{}',
  meanings_json TEXT NOT NULL DEFAULT '[]',          -- 跨词书常用义
  translations_json TEXT NOT NULL DEFAULT '[]',      -- 结构化词性/中英释
  phrases_json TEXT NOT NULL DEFAULT '[]',
  sentences_json TEXT NOT NULL DEFAULT '[]',
  real_exam_sentences_json TEXT NOT NULL DEFAULT '[]',
  synonyms_json TEXT NOT NULL DEFAULT '[]',
  antonyms_json TEXT NOT NULL DEFAULT '[]',
  related_words_json TEXT NOT NULL DEFAULT '[]',
  memory_methods_json TEXT NOT NULL DEFAULT '[]',
  exams_json TEXT NOT NULL DEFAULT '[]',
  review_required INTEGER NOT NULL DEFAULT 0,
  source_entry_count INTEGER NOT NULL DEFAULT 0,
  book_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_words_word_norm ON words(word_norm);
CREATE INDEX IF NOT EXISTS idx_words_review ON words(review_required);
CREATE INDEX IF NOT EXISTS idx_words_book_count ON words(book_count);

-- ---------------------------------------------------------------------------
-- Layer 2: 词书元数据 + 词书关系
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,                 -- cet4 / postgraduate / ...
  name TEXT NOT NULL,                  -- 大学英语四级 / 考研英语
  short_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',   -- exam / school / business / ...
  level TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '#2f6652',
  description TEXT NOT NULL DEFAULT '',
  source_file TEXT NOT NULL DEFAULT '',
  source_rows INTEGER NOT NULL DEFAULT 0,
  unique_words INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS word_book_entries (
  word_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  meanings_json TEXT NOT NULL DEFAULT '[]',   -- 该词书侧重点释义
  word_rank INTEGER,                         -- 书内排序（取最早 sourceEntries）
  source_book_ids_json TEXT NOT NULL DEFAULT '[]',
  source_entries_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (word_id, book_id),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wbe_book ON word_book_entries(book_id, word_rank);
CREATE INDEX IF NOT EXISTS idx_wbe_word ON word_book_entries(word_id);

-- ---------------------------------------------------------------------------
-- Layer 3: 专业领域释义（计算机 / 金融 / 生物 / 医学…）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,                 -- cs / finance / biology / medicine
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS word_domain_meanings (
  word_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  meanings_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  review_required INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (word_id, domain_id),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wdm_domain ON word_domain_meanings(domain_id);
