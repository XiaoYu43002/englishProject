#!/usr/bin/env python3
"""将 ECDICT 应用增强词库并入 lexicon，并导出 App 用 vocabulary.json。

策略（避免把 235 万词整包塞进小程序）：
1. 若尚无 SQLite，从当前 data/vocabulary.json + wordbooks.json 引导建库
2. 用 by_tag/*.jsonl 导入考试标签词（中考/高考/四六级/考研/托福/雅思/GRE）
3. 流式扫描 ecdict_words_full.jsonl：增强库内已有词的释义/综合音标
4. 导出 data/vocabulary.json、wordbooks.json、catalog.generated.ts

用法：
  python3 scripts/import-ecdict-into-lexicon.py
  python3 scripts/import-ecdict-into-lexicon.py --skip-enrich   # 只导 tag、不做全量增强
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LEXICON_DIR = ROOT / "data" / "lexicon"
DB_PATH = LEXICON_DIR / "zhimi-lexicon.sqlite"
SCHEMA_PATH = LEXICON_DIR / "schema.sql"
VOCAB_PATH = ROOT / "data" / "vocabulary.json"
BOOKS_PATH = ROOT / "data" / "wordbooks.json"
ECDICT_DIR = ROOT / "materials" / "ECDICT_complete_app_dictionary"
ECDICT_FULL = ECDICT_DIR / "ecdict_words_full.jsonl"
ECDICT_TAG_DIR = ECDICT_DIR / "by_tag"

# ECDICT tag → 本项目词书 id
TAG_TO_BOOK: dict[str, str] = {
    "zk": "zhongkao",
    "gk": "gaokao",
    "cet4": "cet4",
    "cet6": "cet6",
    "ky": "postgraduate",
    "toefl": "toefl",
    "ielts": "ielts",
    "gre": "gre",
}

TAG_BOOK_META: dict[str, dict[str, str]] = {
    "zhongkao": {
        "name": "中考英语核心",
        "short_name": "中考",
        "category": "school",
        "level": "中考冲刺",
        "accent": "#5a7260",
        "description": "ECDICT 中考标签词（zk）。",
    },
    "gaokao": {
        "name": "高考英语",
        "short_name": "高考",
        "category": "school",
        "level": "高中核心",
        "accent": "#58725f",
        "description": "ECDICT 高考标签词（gk）。",
    },
    "cet4": {
        "name": "大学英语四级",
        "short_name": "CET-4",
        "category": "exam",
        "level": "大学基础",
        "accent": "#2f6652",
        "description": "ECDICT / 材料合并的四级词汇。",
    },
    "cet6": {
        "name": "大学英语六级",
        "short_name": "CET-6",
        "category": "exam",
        "level": "大学进阶",
        "accent": "#a57c42",
        "description": "ECDICT / 材料合并的六级词汇。",
    },
    "postgraduate": {
        "name": "考研英语",
        "short_name": "考研",
        "category": "exam",
        "level": "考研备考",
        "accent": "#7a6548",
        "description": "ECDICT 考研标签词（ky）。",
    },
    "toefl": {
        "name": "托福",
        "short_name": "TOEFL",
        "category": "exam",
        "level": "留学考试",
        "accent": "#456a84",
        "description": "ECDICT 托福标签词。",
    },
    "ielts": {
        "name": "雅思",
        "short_name": "IELTS",
        "category": "exam",
        "level": "留学考试",
        "accent": "#3f6f7a",
        "description": "ECDICT 雅思标签词。",
    },
    "gre": {
        "name": "GRE",
        "short_name": "GRE",
        "category": "exam",
        "level": "留学进阶",
        "accent": "#8c6a58",
        "description": "ECDICT GRE 标签词。",
    },
}


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def word_norm(word: str) -> str:
    return " ".join(str(word or "").strip().lower().split())


def clean_meanings(items: list[Any] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items or []:
        text = re.sub(r"\s+", " ", str(item or "").strip())
        text = text.replace("〔", "（").replace("〕", "）")
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def load_integrate():
    path = ROOT / "scripts" / "integrate-lexicon-for-app.py"
    spec = importlib.util.spec_from_file_location("integrate_lexicon", path)
    if not spec or not spec.loader:
        raise RuntimeError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def connect_db() -> sqlite3.Connection:
    LEXICON_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    if SCHEMA_PATH.exists():
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def ensure_book(conn: sqlite3.Connection, book_id: str, sort_order: int = 100) -> None:
    row = conn.execute("SELECT 1 FROM books WHERE id = ?", (book_id,)).fetchone()
    if row:
        return
    meta = TAG_BOOK_META.get(book_id) or {
        "name": book_id,
        "short_name": book_id,
        "category": "exam",
        "level": "",
        "accent": "#2f6652",
        "description": f"ECDICT 导入词书 {book_id}",
    }
    conn.execute(
        """
        INSERT INTO books (
          id, name, short_name, category, level, accent, description,
          source_file, source_rows, unique_words, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        """,
        (
            book_id,
            meta["name"],
            meta["short_name"],
            meta["category"],
            meta["level"],
            meta["accent"],
            meta["description"],
            "ECDICT",
            sort_order,
        ),
    )


def bootstrap_from_app_json(conn: sqlite3.Connection) -> dict[str, int]:
    """用当前 App 词库重建 sqlite（当 db 为空或不存在 words）。"""
    count = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    if count:
        return {"bootstrapped": 0, "existing": int(count)}

    if not VOCAB_PATH.exists() or not BOOKS_PATH.exists():
        raise SystemExit("missing data/vocabulary.json or data/wordbooks.json for bootstrap")

    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    books = json.loads(BOOKS_PATH.read_text(encoding="utf-8"))

    for index, book in enumerate(books):
        bid = str(book["id"])
        ensure_book(conn, bid, sort_order=index)
        # 覆盖名称等元数据
        conn.execute(
            """
            UPDATE books
            SET name = ?, short_name = ?, level = ?, accent = ?, description = ?,
                unique_words = ?, sort_order = ?
            WHERE id = ?
            """,
            (
                book.get("title") or bid,
                book.get("shortTitle") or bid,
                book.get("level") or "",
                book.get("accent") or "#2f6652",
                book.get("description") or "",
                int(book.get("wordCount") or 0),
                index,
                bid,
            ),
        )

    word_rows = []
    membership_rows = []
    for entry in vocab:
        wid = word_norm(entry.get("id") or entry.get("word") or "")
        word = str(entry.get("word") or wid).strip() or wid
        if not wid:
            continue
        meanings = clean_meanings(entry.get("meanings"))
        usphone = str(entry.get("usphone") or "")
        ukphone = str(entry.get("ukphone") or "")
        phone = str(entry.get("phonetic") or "").strip("/ ")
        word_rows.append(
            (
                wid,
                word,
                wid,
                usphone,
                ukphone,
                phone,
                dumps({}),
                dumps({}),
                dumps(meanings),
                dumps([]),
                dumps([]),
                dumps([]),
                dumps([]),
                dumps([]),
                dumps([]),
                dumps([]),
                dumps([]),
                dumps(entry.get("bookIds") or []),
                1 if entry.get("reviewRequired") else 0,
                1,
                len(entry.get("bookIds") or []),
            )
        )
        by_book = entry.get("meaningsByBook") or {}
        book_ids = list(entry.get("bookIds") or [])
        for bid in list(by_book.keys()):
            if bid not in book_ids:
                book_ids.append(bid)
        for bid in book_ids:
            ensure_book(conn, bid)
            membership_rows.append(
                (
                    wid,
                    bid,
                    dumps(clean_meanings(by_book.get(bid) or meanings)),
                    None,
                    dumps([bid]),
                    dumps([]),
                )
            )

    conn.executemany(
        """
        INSERT OR IGNORE INTO words (
          id, word, word_norm, usphone, ukphone, phone,
          phonetics_json, pronunciation_refs_json, meanings_json, translations_json,
          phrases_json, sentences_json, real_exam_sentences_json,
          synonyms_json, antonyms_json, related_words_json, memory_methods_json,
          exams_json, review_required, source_entry_count, book_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        word_rows,
    )
    conn.executemany(
        """
        INSERT OR IGNORE INTO word_book_entries (
          word_id, book_id, meanings_json, word_rank, source_book_ids_json, source_entries_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        membership_rows,
    )
    # domains seed
    conn.executemany(
        """
        INSERT OR IGNORE INTO domains (id, name, name_zh, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            ("cs", "Computer Science", "计算机", "", 1),
            ("finance", "Finance", "金融", "", 2),
            ("biology", "Biology", "生物", "", 3),
            ("medicine", "Medicine", "医学", "", 4),
        ],
    )
    conn.commit()
    return {"bootstrapped": len(word_rows), "memberships": len(membership_rows)}


def upsert_ecdict_word(conn: sqlite3.Connection, item: dict[str, Any], *, force_insert: bool) -> str | None:
    wid = word_norm(item.get("id") or item.get("word") or "")
    word = str(item.get("word") or wid).strip() or wid
    if not wid:
        return None

    meanings = clean_meanings(item.get("meanings") or item.get("allMeanings"))
    phonetic = str(item.get("phonetic") or "").strip()
    existing = conn.execute(
        "SELECT id, meanings_json, phone, usphone, ukphone FROM words WHERE word_norm = ? OR id = ?",
        (wid, wid),
    ).fetchone()

    if existing:
        eid, old_meanings_json, old_phone, usphone, ukphone = existing
        old_meanings = clean_meanings(json.loads(old_meanings_json or "[]"))
        merged = clean_meanings([*old_meanings, *meanings]) if meanings else old_meanings
        # 已有英美音标不覆盖；综合音标仅在空时写入
        new_phone = old_phone or phonetic
        conn.execute(
            """
            UPDATE words
            SET meanings_json = ?, phone = ?, source_entry_count = source_entry_count + 1
            WHERE id = ?
            """,
            (dumps(merged), new_phone, eid),
        )
        return eid

    if not force_insert:
        return None

    conn.execute(
        """
        INSERT INTO words (
          id, word, word_norm, usphone, ukphone, phone,
          phonetics_json, pronunciation_refs_json, meanings_json, translations_json,
          phrases_json, sentences_json, real_exam_sentences_json,
          synonyms_json, antonyms_json, related_words_json, memory_methods_json,
          exams_json, review_required, source_entry_count, book_count
        ) VALUES (?, ?, ?, '', '', ?, '{}', '{}', ?, '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', 0, 1, 0)
        """,
        (wid, word, wid, phonetic, dumps(meanings)),
    )
    return wid


def upsert_membership(
    conn: sqlite3.Connection,
    word_id: str,
    book_id: str,
    meanings: list[str],
    rank: int | None,
) -> None:
    ensure_book(conn, book_id)
    existing = conn.execute(
        "SELECT meanings_json, word_rank FROM word_book_entries WHERE word_id = ? AND book_id = ?",
        (word_id, book_id),
    ).fetchone()
    if existing:
        old = clean_meanings(json.loads(existing[0] or "[]"))
        merged = clean_meanings([*old, *meanings])
        new_rank = existing[1] if existing[1] is not None else rank
        conn.execute(
            """
            UPDATE word_book_entries
            SET meanings_json = ?, word_rank = ?
            WHERE word_id = ? AND book_id = ?
            """,
            (dumps(merged), new_rank, word_id, book_id),
        )
    else:
        conn.execute(
            """
            INSERT INTO word_book_entries (
              word_id, book_id, meanings_json, word_rank, source_book_ids_json, source_entries_json
            ) VALUES (?, ?, ?, ?, ?, '[]')
            """,
            (word_id, book_id, dumps(meanings), rank, dumps([book_id])),
        )


def import_tagged(conn: sqlite3.Connection) -> dict[str, int]:
    stats = {"files": 0, "rows": 0, "inserted_or_updated": 0, "memberships": 0}
    if not ECDICT_TAG_DIR.exists():
        raise SystemExit(f"missing {ECDICT_TAG_DIR}")

    for path in sorted(ECDICT_TAG_DIR.glob("*.jsonl")):
        tag = path.stem
        book_id = TAG_TO_BOOK.get(tag)
        if not book_id:
            print(f"[skip] unknown tag file: {path.name}", file=sys.stderr)
            continue
        ensure_book(conn, book_id)
        stats["files"] += 1
        with path.open(encoding="utf-8") as f:
            for index, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                item = json.loads(line)
                stats["rows"] += 1
                wid = upsert_ecdict_word(conn, item, force_insert=True)
                if not wid:
                    continue
                stats["inserted_or_updated"] += 1
                meanings = clean_meanings(item.get("meanings") or item.get("allMeanings"))
                # 也挂上该词自带的其它 bookIds（映射后）
                tags = list(item.get("bookIds") or [])
                if tag not in tags:
                    tags.append(tag)
                for raw_tag in tags:
                    mapped = TAG_TO_BOOK.get(str(raw_tag))
                    if not mapped:
                        continue
                    upsert_membership(conn, wid, mapped, meanings, index)
                    stats["memberships"] += 1
        conn.commit()
        print(f"[tag] {path.name} → {book_id} rows={stats['rows']}", flush=True)
    return stats


def enrich_existing(conn: sqlite3.Connection) -> dict[str, int]:
    """流式扫描全量 ECDICT，只增强库中已有词。"""
    if not ECDICT_FULL.exists():
        raise SystemExit(f"missing {ECDICT_FULL}")

    existing = {
        row[0]: row[1]
        for row in conn.execute("SELECT word_norm, id FROM words")
    }
    stats = {"scanned": 0, "matched": 0, "updated": 0}
    t0 = time.time()
    with ECDICT_FULL.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            stats["scanned"] += 1
            if stats["scanned"] % 200000 == 0:
                print(
                    f"[enrich] scanned={stats['scanned']:,} matched={stats['matched']:,} "
                    f"elapsed={time.time() - t0:.1f}s",
                    flush=True,
                )
            item = json.loads(line)
            norm = word_norm(item.get("id") or item.get("word") or "")
            if not norm or norm not in existing:
                continue
            stats["matched"] += 1
            before = conn.execute(
                "SELECT meanings_json, phone FROM words WHERE id = ?",
                (existing[norm],),
            ).fetchone()
            wid = upsert_ecdict_word(conn, item, force_insert=False)
            if not wid or not before:
                continue
            after = conn.execute(
                "SELECT meanings_json, phone FROM words WHERE id = ?",
                (wid,),
            ).fetchone()
            if after != before:
                stats["updated"] += 1
            if stats["matched"] % 5000 == 0:
                conn.commit()
    conn.commit()
    return stats


def refresh_counts(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        UPDATE words
        SET book_count = (
          SELECT COUNT(*) FROM word_book_entries e WHERE e.word_id = words.id
        )
        """
    )
    conn.execute(
        """
        UPDATE books
        SET unique_words = (
          SELECT COUNT(*) FROM word_book_entries e WHERE e.book_id = books.id
        )
        """
    )
    conn.commit()


def patch_export_phonetic(integrate_mod) -> None:
    """integrate 已导出 phone→phonetic，此处保留钩子便于兼容旧脚本。"""
    return


def main() -> None:
    parser = argparse.ArgumentParser(description="Import ECDICT into zhimi lexicon")
    parser.add_argument("--skip-enrich", action="store_true", help="skip full jsonl enrich pass")
    parser.add_argument("--skip-export", action="store_true", help="only update sqlite")
    args = parser.parse_args()

    if not ECDICT_DIR.exists():
        raise SystemExit(f"missing ECDICT dir: {ECDICT_DIR}")

    print(f"[db] {DB_PATH}", flush=True)
    conn = connect_db()
    boot = bootstrap_from_app_json(conn)
    print(f"[bootstrap] {boot}", flush=True)

    for book_id in TAG_TO_BOOK.values():
        ensure_book(conn, book_id)
    conn.commit()

    tag_stats = import_tagged(conn)
    print(f"[tagged] {tag_stats}", flush=True)

    enrich_stats = {"skipped": True}
    if not args.skip_enrich:
        enrich_stats = enrich_existing(conn)
        print(f"[enrich] {enrich_stats}", flush=True)

    refresh_counts(conn)

    word_n = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    book_n = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    mem_n = conn.execute("SELECT COUNT(*) FROM word_book_entries").fetchone()[0]
    print(f"[sqlite] words={word_n} books={book_n} memberships={mem_n}", flush=True)

    export_stats: dict[str, Any] = {"skipped": True}
    if not args.skip_export:
        integrate = load_integrate()
        patch_export_phonetic(integrate)
        taxonomy = integrate.load_taxonomy()
        export_stats = integrate.export_for_app(conn, taxonomy)
        print(f"[export] {export_stats}", flush=True)

    conn.execute(
        "INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)",
        ("ecdict_imported_at", time.strftime("%Y-%m-%dT%H:%M:%S")),
    )
    conn.commit()
    conn.close()

    print(
        json.dumps(
            {
                "ok": True,
                "bootstrap": boot,
                "tagged": tag_stats,
                "enrich": enrich_stats,
                "export": export_stats,
                "db": str(DB_PATH),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
