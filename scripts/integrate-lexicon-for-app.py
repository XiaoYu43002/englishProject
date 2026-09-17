#!/usr/bin/env python3
"""把旧 vocabulary.json 独有词并入 lexicon 主表，并导出供 App / server 使用的词库文件。"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LEXICON_DIR = ROOT / "data" / "lexicon"
DB_PATH = LEXICON_DIR / "zhimi-lexicon.sqlite"
OLD_VOCAB_PATH = ROOT / "data" / "vocabulary.json"
OLD_BOOKS_PATH = ROOT / "data" / "wordbooks.json"
TAXONOMY_PATH = ROOT / "taxonomy" / "taxonomy.json"

# 旧词书 ID → 新主词书 ID（并入关系层时同时挂上）
BOOK_ALIAS = {
    "bec2": "bec",
    "gre1500": "gre",
    "gre3000": "gre",
    "kaoyan2024": "postgraduate",
}

# 继续保留为独立词书（方便 App 里「中考/高考/初中/考研2024」）
KEEP_LEGACY_BOOKS = {
    "chuzhong": {
        "name": "初中英语核心",
        "short_name": "初中",
        "category": "school",
        "level": "初中基础",
        "accent": "#4d6b58",
        "description": "旧版 Qwerty 初中核心词表（已并入主词典）。",
    },
    "zhongkao": {
        "name": "中考英语核心",
        "short_name": "中考",
        "category": "school",
        "level": "中考冲刺",
        "accent": "#5a7260",
        "description": "旧版中考核心词表（已并入主词典）。",
    },
    "gaokao": {
        "name": "高考英语 3500",
        "short_name": "高考",
        "category": "school",
        "level": "高中核心",
        "accent": "#58725f",
        "description": "旧版高考 3500 词表（已并入主词典）。",
    },
    "kaoyan2024": {
        "name": "考研英语 2024",
        "short_name": "考研24",
        "category": "exam",
        "level": "考研备考",
        "accent": "#7a6548",
        "description": "旧版考研 2024 词表（已并入主词典；亦映射到 postgraduate）。",
    },
}


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def word_norm(word: str) -> str:
    return " ".join(str(word or "").strip().lower().split())


def unique_meanings(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        text = re.sub(r"\s+", " ", str(item or "").strip())
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def load_taxonomy() -> list[dict[str, Any]]:
    if TAXONOMY_PATH.exists():
        rows = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
        # 旧 classify 用 keywords；taxonomy.json 可能已去掉 keywords
        return rows
    return []


def classify(word: str, meanings: list[str], taxonomy: list[dict[str, Any]]) -> dict[str, Any]:
    # taxonomy.json 当前无 keywords，用稳定哈希落到 12 类
    if not taxonomy:
        return {
            "semanticDomainId": "relation",
            "semanticPath": f"因果与关系 › 原因·结果·连接 › {word}",
            "semanticConfidence": 0.2,
            "reviewRequired": True,
        }
    code = sum(ord(ch) for ch in word)
    domain = taxonomy[code % len(taxonomy)]
    name = domain.get("name") or domain.get("id")
    slot = domain.get("slot") or ""
    return {
        "semanticDomainId": domain.get("id") or "relation",
        "semanticPath": f"{name} › {slot} › {word}" if slot else f"{name} › {word}",
        "semanticConfidence": 0.2,
        "reviewRequired": True,
    }


def ensure_legacy_books(conn: sqlite3.Connection) -> None:
    max_order = conn.execute("SELECT COALESCE(MAX(sort_order), 0) FROM books").fetchone()[0]
    for offset, (book_id, meta) in enumerate(KEEP_LEGACY_BOOKS.items(), start=1):
        exists = conn.execute("SELECT 1 FROM books WHERE id = ?", (book_id,)).fetchone()
        if exists:
            continue
        conn.execute(
            """
            INSERT INTO books (
              id, name, short_name, category, level, accent, description,
              source_file, source_rows, unique_words, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, 0, ?)
            """,
            (
                book_id,
                meta["name"],
                meta["short_name"],
                meta["category"],
                meta["level"],
                meta["accent"],
                meta["description"],
                max_order + offset,
            ),
        )


def known_book_ids(conn: sqlite3.Connection) -> set[str]:
    return {row[0] for row in conn.execute("SELECT id FROM books")}


def insert_word_if_missing(conn: sqlite3.Connection, entry: dict[str, Any]) -> bool:
    word = str(entry.get("word") or entry.get("id") or "").strip()
    wid = str(entry.get("id") or word).strip()
    norm = word_norm(word)
    if not wid or not norm:
        return False
    exists = conn.execute(
        "SELECT id FROM words WHERE id = ? OR word_norm = ?",
        (wid, norm),
    ).fetchone()
    if exists:
        return False

    meanings = unique_meanings(list(entry.get("meanings") or []))
    review = 1 if entry.get("reviewRequired") or not (entry.get("usphone") or entry.get("ukphone")) else 0
    conn.execute(
        """
        INSERT INTO words (
          id, word, word_norm, usphone, ukphone, phone,
          phonetics_json, pronunciation_refs_json, meanings_json,
          translations_json, phrases_json, sentences_json, real_exam_sentences_json,
          synonyms_json, antonyms_json, related_words_json, memory_methods_json,
          exams_json, review_required, source_entry_count, book_count
        ) VALUES (?, ?, ?, ?, ?, '', '{}', '{}', ?, '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', ?, 0, 0)
        """,
        (
            wid.lower() if wid.lower() == norm else wid,
            word if word else wid,
            norm,
            str(entry.get("usphone") or ""),
            str(entry.get("ukphone") or ""),
            dumps(meanings),
            review,
        ),
    )
    return True


def upsert_membership(
    conn: sqlite3.Connection,
    word_id: str,
    book_id: str,
    meanings: list[str],
    word_rank: int | None,
    known_books: set[str],
) -> None:
    if book_id not in known_books:
        return
    existing = conn.execute(
        "SELECT meanings_json, word_rank FROM word_book_entries WHERE word_id = ? AND book_id = ?",
        (word_id, book_id),
    ).fetchone()
    cleaned = unique_meanings(meanings)
    if existing:
        old = unique_meanings(json.loads(existing[0] or "[]"))
        merged = unique_meanings([*old, *cleaned])
        rank = existing[1] if existing[1] is not None else word_rank
        conn.execute(
            """
            UPDATE word_book_entries
            SET meanings_json = ?, word_rank = ?
            WHERE word_id = ? AND book_id = ?
            """,
            (dumps(merged), rank, word_id, book_id),
        )
    else:
        conn.execute(
            """
            INSERT INTO word_book_entries (
              word_id, book_id, meanings_json, word_rank,
              source_book_ids_json, source_entries_json
            ) VALUES (?, ?, ?, ?, '[]', '[]')
            """,
            (word_id, book_id, dumps(cleaned), word_rank),
        )


def resolve_word_id(conn: sqlite3.Connection, entry: dict[str, Any]) -> str | None:
    word = str(entry.get("word") or entry.get("id") or "").strip()
    wid = str(entry.get("id") or word).strip()
    norm = word_norm(word or wid)
    row = conn.execute(
        "SELECT id FROM words WHERE id = ? OR word_norm = ? OR lower(word) = ? LIMIT 1",
        (wid, norm, norm),
    ).fetchone()
    return row[0] if row else None


def refresh_book_counts(conn: sqlite3.Connection) -> None:
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


def export_for_app(conn: sqlite3.Connection, taxonomy: list[dict[str, Any]]) -> dict[str, int]:
    # meaningsByBook + bookIds from membership
    membership: dict[str, dict[str, list[str]]] = {}
    ranks: dict[str, dict[str, int | None]] = {}
    for row in conn.execute(
        "SELECT word_id, book_id, meanings_json, word_rank FROM word_book_entries"
    ):
        wid, bid, meanings_json, word_rank = row
        membership.setdefault(wid, {})[bid] = json.loads(meanings_json or "[]")
        ranks.setdefault(wid, {})[bid] = word_rank

    vocabulary: list[dict[str, Any]] = []
    for row in conn.execute(
        """
        SELECT id, word, word_norm, usphone, ukphone, meanings_json, review_required
        FROM words
        ORDER BY word_norm, id
        """
    ):
        wid, word, norm, usphone, ukphone, meanings_json, review_required = row
        meanings = json.loads(meanings_json or "[]")
        by_book = membership.get(wid) or {}
        book_ids = sorted(by_book.keys())
        if not meanings:
            # 回退：任意词书释义
            for lst in by_book.values():
                meanings = unique_meanings([*meanings, *lst])
        semantic = classify(norm, meanings, taxonomy)
        vocabulary.append(
            {
                "id": norm,
                "word": norm,
                "meanings": meanings,
                "meaningsByBook": by_book,
                "usphone": usphone or "",
                "ukphone": ukphone or "",
                "bookIds": book_ids,
                "semanticDomainId": semantic["semanticDomainId"],
                "semanticPath": semantic["semanticPath"],
                "semanticConfidence": semantic["semanticConfidence"],
                "reviewRequired": bool(review_required) or semantic["reviewRequired"],
            }
        )

    # wordbooks with ordered wordIds
    books_out: list[dict[str, Any]] = []
    for row in conn.execute(
        """
        SELECT id, name, short_name, level, accent, description, unique_words, sort_order
        FROM books
        ORDER BY sort_order, id
        """
    ):
        book_id, name, short_name, level, accent, description, unique_words, _sort = row
        pairs = conn.execute(
            """
            SELECT word_id, word_rank
            FROM word_book_entries
            WHERE book_id = ?
            """,
            (book_id,),
        ).fetchall()
        # order by rank then id
        pairs_sorted = sorted(
            pairs,
            key=lambda item: (
                item[1] is None,
                item[1] if item[1] is not None else 10**9,
                item[0],
            ),
        )
        # map to exported vocabulary ids (word_norm)
        word_ids: list[str] = []
        for word_id, _rank in pairs_sorted:
            norm_row = conn.execute(
                "SELECT word_norm FROM words WHERE id = ?",
                (word_id,),
            ).fetchone()
            if not norm_row:
                continue
            word_ids.append(norm_row[0])
        books_out.append(
            {
                "id": book_id,
                "title": name,
                "shortTitle": short_name or name,
                "level": level or "",
                "accent": accent or "#2f6652",
                "description": description or "",
                "wordCount": len(word_ids),
                "wordIds": word_ids,
            }
        )

    # backup old app files once
    backup_dir = ROOT / "data" / "legacy-backup"
    backup_dir.mkdir(parents=True, exist_ok=True)
    if OLD_VOCAB_PATH.exists() and not (backup_dir / "vocabulary.json").exists():
        (backup_dir / "vocabulary.json").write_text(
            OLD_VOCAB_PATH.read_text(encoding="utf-8"),
            encoding="utf-8",
        )
    if OLD_BOOKS_PATH.exists() and not (backup_dir / "wordbooks.json").exists():
        (backup_dir / "wordbooks.json").write_text(
            OLD_BOOKS_PATH.read_text(encoding="utf-8"),
            encoding="utf-8",
        )

    (ROOT / "data" / "vocabulary.json").write_text(
        json.dumps(vocabulary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (ROOT / "data" / "wordbooks.json").write_text(
        json.dumps(books_out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # starter catalog for offline H5
    starter_limit = 80
    starter_books = []
    starter_words: dict[str, list[dict[str, Any]]] = {}
    by_id = {item["id"]: item for item in vocabulary}
    for book in books_out:
        preview_ids = book["wordIds"][:starter_limit]
        starter_books.append(
            {
                "id": book["id"],
                "title": book["title"],
                "shortTitle": book["shortTitle"],
                "level": book["level"],
                "accent": book["accent"],
                "description": book["description"],
                "wordCount": book["wordCount"],
                "previewCount": len(preview_ids),
            }
        )
        starter_words[book["id"]] = []
        for wid in preview_ids:
            entry = by_id.get(wid)
            if not entry:
                continue
            focused = entry.get("meaningsByBook", {}).get(book["id"]) or []
            base = entry.get("meanings") or []
            meanings = unique_meanings([*focused, *base])
            starter_words[book["id"]].append(
                {
                    **entry,
                    "meanings": meanings,
                    "activeBookId": book["id"],
                }
            )

    catalog_path = ROOT / "src" / "data" / "catalog.generated.ts"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(
        "// 由 scripts/integrate-lexicon-for-app.py 自动生成，请勿手工修改。\n"
        f"export const starterBooks = {json.dumps(starter_books, ensure_ascii=False, indent=2)} as const\n\n"
        f"export const starterWords = {json.dumps(starter_words, ensure_ascii=False, indent=2)} as const\n",
        encoding="utf-8",
    )

    # update lexicon manifest
    manifest_path = LEXICON_DIR / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.update(
        {
            "words": len(vocabulary),
            "books": len(books_out),
            "wordBookEntries": conn.execute("SELECT COUNT(*) FROM word_book_entries").fetchone()[0],
            "appExport": {
                "vocabulary": "data/vocabulary.json",
                "wordbooks": "data/wordbooks.json",
                "catalog": "src/data/catalog.generated.ts",
            },
        }
    )
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "words": len(vocabulary),
        "books": len(books_out),
        "memberships": manifest["wordBookEntries"],
    }


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"missing lexicon db: {DB_PATH} (run npm run build:lexicon first)")
    if not OLD_VOCAB_PATH.exists():
        raise SystemExit(f"missing old vocabulary: {OLD_VOCAB_PATH}")

    old_vocab = json.loads(OLD_VOCAB_PATH.read_text(encoding="utf-8"))
    taxonomy = load_taxonomy()

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    ensure_legacy_books(conn)
    books = known_book_ids(conn)

    inserted = 0
    memberships_added = 0

    # 旧库词序：用于 word_rank
    old_books = json.loads(OLD_BOOKS_PATH.read_text(encoding="utf-8")) if OLD_BOOKS_PATH.exists() else []
    rank_maps: dict[str, dict[str, int]] = {}
    for book in old_books:
        bid = book["id"]
        rank_maps[bid] = {wid: idx + 1 for idx, wid in enumerate(book.get("wordIds") or [])}

    for entry in old_vocab:
        created = insert_word_if_missing(conn, entry)
        if created:
            inserted += 1
        word_id = resolve_word_id(conn, entry)
        if not word_id:
            continue

        meanings_by_book = entry.get("meaningsByBook") or {}
        book_ids = list(entry.get("bookIds") or [])
        # 也覆盖 meaningsByBook 的 key
        for bid in list(meanings_by_book.keys()):
            if bid not in book_ids:
                book_ids.append(bid)

        for bid in book_ids:
            meanings = list(meanings_by_book.get(bid) or entry.get("meanings") or [])
            rank = rank_maps.get(bid, {}).get(str(entry.get("id") or "").lower())
            # 保留旧书 ID（若在 books 表）
            if bid in books:
                before = conn.execute(
                    "SELECT 1 FROM word_book_entries WHERE word_id = ? AND book_id = ?",
                    (word_id, bid),
                ).fetchone()
                upsert_membership(conn, word_id, bid, meanings, rank, books)
                if not before:
                    memberships_added += 1
            # 映射到新主词书
            alias = BOOK_ALIAS.get(bid)
            if alias and alias in books:
                before = conn.execute(
                    "SELECT 1 FROM word_book_entries WHERE word_id = ? AND book_id = ?",
                    (word_id, alias),
                ).fetchone()
                upsert_membership(conn, word_id, alias, meanings, rank, books)
                if not before:
                    memberships_added += 1

    refresh_book_counts(conn)
    conn.commit()

    stats = export_for_app(conn, taxonomy)
    conn.execute(
        "INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)",
        ("integrated_legacy_words", str(inserted)),
    )
    conn.commit()
    conn.close()

    print(
        json.dumps(
            {
                "ok": True,
                "legacyWordsInserted": inserted,
                "membershipTouches": memberships_added,
                "appWords": stats["words"],
                "appBooks": stats["books"],
                "memberships": stats["memberships"],
                "db": str(DB_PATH),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
