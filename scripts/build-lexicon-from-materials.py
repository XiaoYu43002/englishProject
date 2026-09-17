#!/usr/bin/env python3
"""从 materials 合并词库构建三层 lexicon：主词典 / 词书关系 / 专业领域骨架。"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MERGED = ROOT / "materials" / "english_vocabulary_full_merged" / "full_merged.jsonl"
DEFAULT_BOOKS_MANIFEST = (
    ROOT / "materials" / "english_vocabulary_full_by_book" / "output" / "books_manifest.json"
)
DEFAULT_OUT_DIR = ROOT / "data" / "lexicon"
SCHEMA_PATH = DEFAULT_OUT_DIR / "schema.sql"

BOOK_META: dict[str, dict[str, str]] = {
    "cet4": {
        "short_name": "CET-4",
        "category": "exam",
        "level": "大学基础",
        "accent": "#2f6652",
        "description": "大学英语四级核心词，适合日常积累与考前复习。",
    },
    "cet6": {
        "short_name": "CET-6",
        "category": "exam",
        "level": "大学进阶",
        "accent": "#a57c42",
        "description": "大学英语六级进阶词汇。",
    },
    "postgraduate": {
        "short_name": "考研",
        "category": "exam",
        "level": "考研备考",
        "accent": "#7a6548",
        "description": "考研英语高频词汇。",
    },
    "tem4": {
        "short_name": "专四",
        "category": "exam",
        "level": "专业英语",
        "accent": "#6b7d52",
        "description": "英语专业四级词汇。",
    },
    "tem8": {
        "short_name": "专八",
        "category": "exam",
        "level": "专业英语",
        "accent": "#5f7450",
        "description": "英语专业八级词汇。",
    },
    "ielts": {
        "short_name": "IELTS",
        "category": "exam",
        "level": "留学考试",
        "accent": "#3f6f7a",
        "description": "雅思核心词汇。",
    },
    "toefl": {
        "short_name": "TOEFL",
        "category": "exam",
        "level": "留学考试",
        "accent": "#456a84",
        "description": "托福学术场景词汇。",
    },
    "sat": {
        "short_name": "SAT",
        "category": "exam",
        "level": "留学考试",
        "accent": "#5b5f7a",
        "description": "SAT 学术阅读词汇。",
    },
    "gre": {
        "short_name": "GRE",
        "category": "exam",
        "level": "留学进阶",
        "accent": "#8c6a58",
        "description": "GRE 高频词汇。",
    },
    "gmat": {
        "short_name": "GMAT",
        "category": "exam",
        "level": "留学进阶",
        "accent": "#8a5a4a",
        "description": "GMAT 词汇。",
    },
    "bec": {
        "short_name": "BEC",
        "category": "business",
        "level": "商务英语",
        "accent": "#5f6f4a",
        "description": "商务英语常用词汇。",
    },
    "junior_high": {
        "short_name": "初中",
        "category": "school",
        "level": "初中基础",
        "accent": "#4d6b58",
        "description": "初中英语综合词汇。",
    },
    "senior_high": {
        "short_name": "高中",
        "category": "school",
        "level": "高中核心",
        "accent": "#58725f",
        "description": "高中英语综合词汇。",
    },
    "pep_primary_3": {
        "short_name": "小三",
        "category": "school",
        "level": "小学",
        "accent": "#6a8570",
        "description": "人教版小学三年级。",
    },
    "pep_primary_4": {
        "short_name": "小四",
        "category": "school",
        "level": "小学",
        "accent": "#6a8570",
        "description": "人教版小学四年级。",
    },
    "pep_primary_5": {
        "short_name": "小五",
        "category": "school",
        "level": "小学",
        "accent": "#6a8570",
        "description": "人教版小学五年级。",
    },
    "pep_primary_6": {
        "short_name": "小六",
        "category": "school",
        "level": "小学",
        "accent": "#6a8570",
        "description": "人教版小学六年级。",
    },
    "pep_junior_7": {
        "short_name": "七上",
        "category": "school",
        "level": "初中",
        "accent": "#4d6b58",
        "description": "人教版初中七年级。",
    },
    "pep_junior_8": {
        "short_name": "八上",
        "category": "school",
        "level": "初中",
        "accent": "#4d6b58",
        "description": "人教版初中八年级。",
    },
    "pep_junior_9": {
        "short_name": "九上",
        "category": "school",
        "level": "初中",
        "accent": "#4d6b58",
        "description": "人教版初中九年级。",
    },
    "pep_senior": {
        "short_name": "人教高中",
        "category": "school",
        "level": "高中",
        "accent": "#58725f",
        "description": "人教版高中词汇。",
    },
    "bnu_senior": {
        "short_name": "北师高中",
        "category": "school",
        "level": "高中",
        "accent": "#58725f",
        "description": "北师大版高中词汇。",
    },
    "fltrp_junior": {
        "short_name": "外研初中",
        "category": "school",
        "level": "初中",
        "accent": "#4d6b58",
        "description": "外研社版初中词汇。",
    },
}

SEED_DOMAINS = [
    ("cs", "Computer Science", "计算机", "计算机 / 软件 / 人工智能相关术语释义", 1),
    ("finance", "Finance", "金融", "金融、会计、投资相关术语释义", 2),
    ("biology", "Biology", "生物", "生物、生命科学相关术语释义", 3),
    ("medicine", "Medicine", "医学", "医学、临床相关术语释义", 4),
]


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def word_norm(word: str) -> str:
    return " ".join(str(word or "").strip().lower().split())


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_books_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def insert_books(conn: sqlite3.Connection, manifest: list[dict[str, Any]]) -> dict[str, str]:
    """返回 book_id -> book_name。"""
    names: dict[str, str] = {}
    rows = []
    for index, item in enumerate(manifest):
        book_id = item["bookId"]
        name = item["bookName"]
        meta = BOOK_META.get(book_id, {})
        names[book_id] = name
        rows.append(
            (
                book_id,
                name,
                meta.get("short_name") or name,
                meta.get("category") or "general",
                meta.get("level") or "",
                meta.get("accent") or "#2f6652",
                meta.get("description") or f"{name}词书。",
                item.get("sourceFile") or "",
                int(item.get("sourceRows") or 0),
                int(item.get("uniqueWords") or 0),
                index,
            )
        )
    conn.executemany(
        """
        INSERT INTO books (
          id, name, short_name, category, level, accent, description,
          source_file, source_rows, unique_words, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return names


def seed_domains(conn: sqlite3.Connection) -> None:
    conn.executemany(
        """
        INSERT INTO domains (id, name, name_zh, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
        """,
        SEED_DOMAINS,
    )


def best_rank(source_entries: list[dict[str, Any]], book_id: str) -> int | None:
    ranks = [
        int(item["wordRank"])
        for item in source_entries
        if item.get("bookId") == book_id and item.get("wordRank") is not None
    ]
    return min(ranks) if ranks else None


def source_book_ids_for(source_entries: list[dict[str, Any]], book_id: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in source_entries:
        if item.get("bookId") != book_id:
            continue
        raw = str(item.get("rawBookId") or "").strip()
        if raw and raw not in seen:
            seen.add(raw)
            out.append(raw)
    return out


def source_entries_for(source_entries: list[dict[str, Any]], book_id: str) -> list[dict[str, Any]]:
    return [item for item in source_entries if item.get("bookId") == book_id]


def import_words(conn: sqlite3.Connection, merged_path: Path, known_books: set[str]) -> dict[str, int]:
    word_rows: list[tuple[Any, ...]] = []
    membership_rows: list[tuple[Any, ...]] = []
    stats = {
        "words": 0,
        "memberships": 0,
        "review_required": 0,
        "missing_book_refs": 0,
    }

    with merged_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            item = json.loads(line)
            word_id = str(item.get("id") or item.get("word") or "").strip()
            word = str(item.get("word") or word_id).strip()
            if not word_id or not word:
                continue

            book_ids = [str(b) for b in (item.get("bookIds") or []) if str(b)]
            unknown = [b for b in book_ids if b not in known_books]
            if unknown:
                stats["missing_book_refs"] += len(unknown)
                # 仍保留主词；关系层只写入已知词书
                book_ids = [b for b in book_ids if b in known_books]

            meanings_by_book = item.get("meaningsByBook") or {}
            source_entries = item.get("sourceEntries") or []
            review_required = 1 if item.get("reviewRequired") else 0
            if review_required:
                stats["review_required"] += 1

            word_rows.append(
                (
                    word_id,
                    word,
                    word_norm(word),
                    str(item.get("usphone") or ""),
                    str(item.get("ukphone") or ""),
                    str(item.get("phone") or ""),
                    dumps(item.get("phonetics") or {}),
                    dumps(item.get("pronunciationRefs") or {}),
                    dumps(item.get("meanings") or []),
                    dumps(item.get("translations") or []),
                    dumps(item.get("phrases") or []),
                    dumps(item.get("sentences") or []),
                    dumps(item.get("realExamSentences") or []),
                    dumps(item.get("synonyms") or []),
                    dumps(item.get("antonyms") or []),
                    dumps(item.get("relatedWords") or []),
                    dumps(item.get("memoryMethods") or []),
                    dumps(item.get("exams") or []),
                    review_required,
                    len(source_entries),
                    len(book_ids),
                )
            )
            stats["words"] += 1

            for book_id in book_ids:
                membership_rows.append(
                    (
                        word_id,
                        book_id,
                        dumps(meanings_by_book.get(book_id) or []),
                        best_rank(source_entries, book_id),
                        dumps(source_book_ids_for(source_entries, book_id)),
                        dumps(source_entries_for(source_entries, book_id)),
                    )
                )
                stats["memberships"] += 1

            if len(word_rows) >= 1000:
                flush_words(conn, word_rows, membership_rows)
                word_rows.clear()
                membership_rows.clear()

    if word_rows:
        flush_words(conn, word_rows, membership_rows)
    return stats


def flush_words(
    conn: sqlite3.Connection,
    word_rows: list[tuple[Any, ...]],
    membership_rows: list[tuple[Any, ...]],
) -> None:
    conn.executemany(
        """
        INSERT INTO words (
          id, word, word_norm, usphone, ukphone, phone,
          phonetics_json, pronunciation_refs_json, meanings_json,
          translations_json, phrases_json, sentences_json, real_exam_sentences_json,
          synonyms_json, antonyms_json, related_words_json, memory_methods_json,
          exams_json, review_required, source_entry_count, book_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        word_rows,
    )
    conn.executemany(
        """
        INSERT INTO word_book_entries (
          word_id, book_id, meanings_json, word_rank,
          source_book_ids_json, source_entries_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        membership_rows,
    )


def export_artifacts(conn: sqlite3.Connection, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    books = []
    for row in conn.execute(
        """
        SELECT id, name, short_name, category, level, accent, description,
               source_rows, unique_words, sort_order
        FROM books
        ORDER BY sort_order
        """
    ):
        books.append(
            {
                "id": row["id"],
                "name": row["name"],
                "shortName": row["short_name"],
                "category": row["category"],
                "level": row["level"],
                "accent": row["accent"],
                "description": row["description"],
                "sourceRows": row["source_rows"],
                "uniqueWords": row["unique_words"],
                "sortOrder": row["sort_order"],
            }
        )
    (out_dir / "books.json").write_text(
        json.dumps(books, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    words_path = out_dir / "words.jsonl"
    with words_path.open("w", encoding="utf-8") as f:
        for row in conn.execute(
            """
            SELECT id, word, word_norm, usphone, ukphone, phone,
                   phonetics_json, pronunciation_refs_json, meanings_json,
                   translations_json, phrases_json, sentences_json,
                   real_exam_sentences_json, synonyms_json, antonyms_json,
                   related_words_json, memory_methods_json, exams_json,
                   review_required, source_entry_count, book_count
            FROM words
            ORDER BY word_norm, id
            """
        ):
            payload = {
                "id": row[0],
                "word": row[1],
                "wordNorm": row[2],
                "usphone": row[3],
                "ukphone": row[4],
                "phone": row[5],
                "phonetics": json.loads(row[6] or "{}"),
                "pronunciationRefs": json.loads(row[7] or "{}"),
                "meanings": json.loads(row[8] or "[]"),
                "translations": json.loads(row[9] or "[]"),
                "phrases": json.loads(row[10] or "[]"),
                "sentences": json.loads(row[11] or "[]"),
                "realExamSentences": json.loads(row[12] or "[]"),
                "synonyms": json.loads(row[13] or "[]"),
                "antonyms": json.loads(row[14] or "[]"),
                "relatedWords": json.loads(row[15] or "[]"),
                "memoryMethods": json.loads(row[16] or "[]"),
                "exams": json.loads(row[17] or "[]"),
                "reviewRequired": bool(row[18]),
                "sourceEntryCount": row[19],
                "bookCount": row[20],
            }
            f.write(dumps(payload) + "\n")

    membership_path = out_dir / "word_book_entries.jsonl"
    with membership_path.open("w", encoding="utf-8") as f:
        for row in conn.execute(
            """
            SELECT word_id, book_id, meanings_json, word_rank,
                   source_book_ids_json, source_entries_json
            FROM word_book_entries
            ORDER BY book_id, COALESCE(word_rank, 999999), word_id
            """
        ):
            payload = {
                "wordId": row[0],
                "bookId": row[1],
                "meanings": json.loads(row[2] or "[]"),
                "wordRank": row[3],
                "sourceBookIds": json.loads(row[4] or "[]"),
                "sourceEntries": json.loads(row[5] or "[]"),
            }
            f.write(dumps(payload) + "\n")

    domains = [
        {
            "id": row[0],
            "name": row[1],
            "nameZh": row[2],
            "description": row[3],
            "sortOrder": row[4],
        }
        for row in conn.execute(
            "SELECT id, name, name_zh, description, sort_order FROM domains ORDER BY sort_order"
        )
    ]
    (out_dir / "domains.json").write_text(
        json.dumps(domains, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_manifest(
    out_dir: Path,
    merged_path: Path,
    stats: dict[str, int],
    book_count: int,
    db_path: Path,
) -> None:
    counts = {
        "sourceFile": str(merged_path.relative_to(ROOT)),
        "sourceSha256": sha256_file(merged_path),
        "words": stats["words"],
        "wordBookEntries": stats["memberships"],
        "reviewRequired": stats["review_required"],
        "missingBookRefs": stats["missing_book_refs"],
        "books": book_count,
        "domains": len(SEED_DOMAINS),
        "db": str(db_path.relative_to(ROOT)),
        "dbSha256": sha256_file(db_path),
        "dbBytes": db_path.stat().st_size,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(counts, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build zhimi lexicon from materials")
    parser.add_argument("--merged", type=Path, default=DEFAULT_MERGED)
    parser.add_argument("--books-manifest", type=Path, default=DEFAULT_BOOKS_MANIFEST)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    if not args.merged.exists():
        raise SystemExit(f"missing merged jsonl: {args.merged}")
    if not SCHEMA_PATH.exists():
        raise SystemExit(f"missing schema: {SCHEMA_PATH}")

    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "zhimi-lexicon.sqlite"

    print(f"[1/5] connect {db_path}")
    conn = connect(db_path)
    conn.row_factory = sqlite3.Row

    print(f"[2/5] load books from {args.books_manifest}")
    manifest = load_books_manifest(args.books_manifest)
    if not manifest:
        raise SystemExit("books_manifest.json is empty or missing")
    book_names = insert_books(conn, manifest)
    seed_domains(conn)

    print(f"[3/5] import words from {args.merged}")
    stats = import_words(conn, args.merged, set(book_names))
    conn.execute(
        "INSERT INTO meta(key, value) VALUES(?, ?)",
        ("source_sha256", sha256_file(args.merged)),
    )
    conn.execute(
        "INSERT INTO meta(key, value) VALUES(?, ?)",
        ("word_count", str(stats["words"])),
    )
    conn.commit()

    print("[4/5] export json artifacts")
    export_artifacts(conn, out_dir)
    conn.close()

    # rewrite books.json with proper dicts (row_factory was set)
    # export already done with row_factory

    print("[5/5] write manifest")
    write_manifest(out_dir, args.merged, stats, len(book_names), db_path)

    print(
        json.dumps(
            {
                "ok": True,
                "words": stats["words"],
                "wordBookEntries": stats["memberships"],
                "books": len(book_names),
                "reviewRequired": stats["review_required"],
                "db": str(db_path),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
