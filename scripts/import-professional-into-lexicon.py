#!/usr/bin/env python3
"""导入 materials/professional/*.jsonl 到 lexicon。

- 写入 domains + word_domain_meanings（专业领域释义层）
- 同步建成 category=professional 的词书，可在 App「我的词书」里学
- 清洗嘈杂释义后 upsert 到 words，并导出 vocabulary.json

用法：
  python3 scripts/import-professional-into-lexicon.py
"""

from __future__ import annotations

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
PROF_DIR = ROOT / "materials" / "professional"

# 文件名 → 领域元数据
DOMAIN_META: dict[str, dict[str, Any]] = {
    "agriculture_forestry_fisheries": {
        "name": "Agriculture / Forestry / Fisheries",
        "name_zh": "农林水产",
        "description": "农业、林业与水产相关术语",
        "accent": "#5f7450",
        "sort": 10,
    },
    "arts_media": {
        "name": "Arts & Media",
        "name_zh": "艺术传媒",
        "description": "艺术、媒体与传播相关术语",
        "accent": "#8a5a4a",
        "sort": 20,
    },
    "aviation_maritime_transport": {
        "name": "Aviation / Maritime / Transport",
        "name_zh": "航空航海交通",
        "description": "航空、航海与交通运输术语",
        "accent": "#456a84",
        "sort": 30,
    },
    "biology": {
        "name": "Biology",
        "name_zh": "生物",
        "description": "生物与生命科学相关术语",
        "accent": "#2f6652",
        "sort": 40,
    },
    "business_management": {
        "name": "Business & Management",
        "name_zh": "工商管理",
        "description": "商业与管理相关术语",
        "accent": "#7a6548",
        "sort": 50,
    },
    "chemistry": {
        "name": "Chemistry",
        "name_zh": "化学",
        "description": "化学与化工相关术语",
        "accent": "#5b5f7a",
        "sort": 60,
    },
    "computer_it": {
        "name": "Computer & IT",
        "name_zh": "计算机",
        "description": "计算机与信息技术术语",
        "accent": "#3f6f7a",
        "sort": 70,
    },
    "earth_environment": {
        "name": "Earth & Environment",
        "name_zh": "地球环境",
        "description": "地球科学与环境术语",
        "accent": "#58725f",
        "sort": 80,
    },
    "electronics_telecommunications": {
        "name": "Electronics & Telecom",
        "name_zh": "电子通信",
        "description": "电子与电信相关术语",
        "accent": "#4d6b58",
        "sort": 90,
    },
    "engineering_manufacturing": {
        "name": "Engineering & Manufacturing",
        "name_zh": "工程制造",
        "description": "工程与制造相关术语",
        "accent": "#6b7d52",
        "sort": 100,
    },
    "finance_economics": {
        "name": "Finance & Economics",
        "name_zh": "金融经济",
        "description": "金融与经济相关术语",
        "accent": "#a57c42",
        "sort": 110,
    },
    "history_archaeology": {
        "name": "History & Archaeology",
        "name_zh": "历史考古",
        "description": "历史与考古相关术语",
        "accent": "#8c6a58",
        "sort": 120,
    },
    "language_literature": {
        "name": "Language & Literature",
        "name_zh": "语言文学",
        "description": "语言与文学相关术语",
        "accent": "#6a8570",
        "sort": 130,
    },
    "law": {
        "name": "Law",
        "name_zh": "法律",
        "description": "法律相关术语",
        "accent": "#5a7260",
        "sort": 140,
    },
    "mathematics_statistics": {
        "name": "Mathematics & Statistics",
        "name_zh": "数理统计",
        "description": "数学与统计相关术语",
        "accent": "#4d6b58",
        "sort": 150,
    },
    "medicine_health": {
        "name": "Medicine & Health",
        "name_zh": "医学健康",
        "description": "医学与健康相关术语",
        "accent": "#8a5a4a",
        "sort": 160,
    },
    "military_defense": {
        "name": "Military & Defense",
        "name_zh": "军事国防",
        "description": "军事与国防相关术语",
        "accent": "#5b5f7a",
        "sort": 170,
    },
    "physics": {
        "name": "Physics",
        "name_zh": "物理",
        "description": "物理学相关术语",
        "accent": "#456a84",
        "sort": 180,
    },
    "religion_mythology": {
        "name": "Religion & Mythology",
        "name_zh": "宗教神话",
        "description": "宗教与神话相关术语",
        "accent": "#7a6548",
        "sort": 190,
    },
    "sports": {
        "name": "Sports",
        "name_zh": "体育",
        "description": "体育相关术语",
        "accent": "#2f6652",
        "sort": 200,
    },
}

# 兼容旧四领域 id（保留别名写入）
DOMAIN_ALIASES: dict[str, str] = {
    "computer_it": "cs",
    "finance_economics": "finance",
    "biology": "biology",
    "medicine_health": "medicine",
}

SKIP_EXACT = {
    "短语:",
    "变形:",
    "vt.",
    "vi.",
    "n.",
    "a.",
    "adj.",
    "adv.",
    "prep.",
    "conj.",
    "pron.",
    "num.",
    "int.",
    "aux.",
    "art.",
    "abbr.",
    "suf.",
    "pref.",
    "v.",
    "pl.",
}


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def word_norm(word: str) -> str:
    return " ".join(str(word or "").strip().lower().split())


def clean_meanings(items: list[Any] | None, *, limit: int = 12) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items or []:
        text = re.sub(r"\s+", " ", str(item or "").strip())
        text = text.replace("〔", "（").replace("〕", "）")
        if not text:
            continue
        low = text.lower()
        if text in SKIP_EXACT or low in SKIP_EXACT:
            continue
        if text.startswith("短语:") or text.startswith("变形:"):
            continue
        if re.fullmatch(r"[-.]?[a-zA-Z0-9]+", text):
            # 单独词形/代号行，无释义价值
            continue
        if len(text) <= 2 and not re.search(r"[\u4e00-\u9fff]", text):
            continue
        key = low
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= limit:
            break
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
    if not DB_PATH.exists():
        raise SystemExit(f"missing lexicon db: {DB_PATH}（请先 npm run import:ecdict 或 sync:lexicon）")
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    if SCHEMA_PATH.exists():
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def ensure_domain(conn: sqlite3.Connection, domain_id: str, meta: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO domains (id, name, name_zh, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          name_zh = excluded.name_zh,
          description = excluded.description,
          sort_order = excluded.sort_order
        """,
        (
            domain_id,
            meta["name"],
            meta["name_zh"],
            meta["description"],
            int(meta["sort"]),
        ),
    )


def ensure_book(conn: sqlite3.Connection, book_id: str, meta: dict[str, Any], sort_order: int) -> None:
    row = conn.execute("SELECT 1 FROM books WHERE id = ?", (book_id,)).fetchone()
    title = f"专业 · {meta['name_zh']}"
    short = meta["name_zh"]
    desc = meta["description"]
    accent = meta.get("accent") or "#2f6652"
    if row:
        conn.execute(
            """
            UPDATE books
            SET name = ?, short_name = ?, category = 'professional', level = '专业英语',
                accent = ?, description = ?, sort_order = ?
            WHERE id = ?
            """,
            (title, short, accent, desc, sort_order, book_id),
        )
        return
    conn.execute(
        """
        INSERT INTO books (
          id, name, short_name, category, level, accent, description,
          source_file, source_rows, unique_words, sort_order
        ) VALUES (?, ?, ?, 'professional', '专业英语', ?, ?, 'professional', 0, 0, ?)
        """,
        (book_id, title, short, accent, desc, sort_order),
    )


def upsert_word(conn: sqlite3.Connection, item: dict[str, Any], meanings: list[str]) -> str | None:
    wid = word_norm(item.get("id") or item.get("word") or "")
    word = str(item.get("word") or wid).strip() or wid
    if not wid:
        return None
    phonetic = str(item.get("phonetic") or "").strip()
    usphone = str(item.get("usphone") or "") if item.get("usphone") else ""
    ukphone = str(item.get("ukphone") or "") if item.get("ukphone") else ""

    existing = conn.execute(
        "SELECT id, meanings_json, phone, usphone, ukphone FROM words WHERE word_norm = ? OR id = ?",
        (wid, wid),
    ).fetchone()
    if existing:
        eid, old_json, old_phone, old_us, old_uk = existing
        old = clean_meanings(json.loads(old_json or "[]"), limit=20)
        merged = clean_meanings([*old, *meanings], limit=20)
        conn.execute(
            """
            UPDATE words
            SET meanings_json = ?,
                phone = CASE WHEN phone = '' OR phone IS NULL THEN ? ELSE phone END,
                usphone = CASE WHEN usphone = '' OR usphone IS NULL THEN ? ELSE usphone END,
                ukphone = CASE WHEN ukphone = '' OR ukphone IS NULL THEN ? ELSE ukphone END,
                source_entry_count = source_entry_count + 1
            WHERE id = ?
            """,
            (dumps(merged), phonetic, usphone, ukphone, eid),
        )
        return eid

    conn.execute(
        """
        INSERT INTO words (
          id, word, word_norm, usphone, ukphone, phone,
          phonetics_json, pronunciation_refs_json, meanings_json, translations_json,
          phrases_json, sentences_json, real_exam_sentences_json,
          synonyms_json, antonyms_json, related_words_json, memory_methods_json,
          exams_json, review_required, source_entry_count, book_count
        ) VALUES (?, ?, ?, ?, ?, ?, '{}', '{}', ?, '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', 0, 1, 0)
        """,
        (wid, word, wid, usphone, ukphone, phonetic, dumps(meanings)),
    )
    return wid


def upsert_membership(conn: sqlite3.Connection, word_id: str, book_id: str, meanings: list[str], rank: int) -> None:
    existing = conn.execute(
        "SELECT meanings_json, word_rank FROM word_book_entries WHERE word_id = ? AND book_id = ?",
        (word_id, book_id),
    ).fetchone()
    if existing:
        old = clean_meanings(json.loads(existing[0] or "[]"), limit=20)
        merged = clean_meanings([*old, *meanings], limit=20)
        conn.execute(
            """
            UPDATE word_book_entries
            SET meanings_json = ?, word_rank = COALESCE(word_rank, ?)
            WHERE word_id = ? AND book_id = ?
            """,
            (dumps(merged), rank, word_id, book_id),
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


def upsert_domain_meanings(
    conn: sqlite3.Connection,
    word_id: str,
    domain_id: str,
    meanings: list[str],
    source: str,
) -> None:
    existing = conn.execute(
        "SELECT meanings_json FROM word_domain_meanings WHERE word_id = ? AND domain_id = ?",
        (word_id, domain_id),
    ).fetchone()
    if existing:
        old = clean_meanings(json.loads(existing[0] or "[]"), limit=20)
        merged = clean_meanings([*old, *meanings], limit=20)
        conn.execute(
            """
            UPDATE word_domain_meanings
            SET meanings_json = ?, source = ?
            WHERE word_id = ? AND domain_id = ?
            """,
            (dumps(merged), source, word_id, domain_id),
        )
    else:
        conn.execute(
            """
            INSERT INTO word_domain_meanings (
              word_id, domain_id, meanings_json, notes, source, review_required
            ) VALUES (?, ?, ?, '', ?, 0)
            """,
            (word_id, domain_id, dumps(meanings), source),
        )


def refresh_counts(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        UPDATE words SET book_count = (
          SELECT COUNT(*) FROM word_book_entries e WHERE e.word_id = words.id
        )
        """
    )
    conn.execute(
        """
        UPDATE books SET unique_words = (
          SELECT COUNT(*) FROM word_book_entries e WHERE e.book_id = books.id
        )
        """
    )
    conn.commit()


def export_domains_json(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT id, name, name_zh, description, sort_order FROM domains ORDER BY sort_order, id"
    ).fetchall()
    payload = [
        {
            "id": r[0],
            "name": r[1],
            "nameZh": r[2],
            "description": r[3],
            "sortOrder": r[4],
        }
        for r in rows
    ]
    (LEXICON_DIR / "domains.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def import_file(conn: sqlite3.Connection, path: Path, domain_key: str, meta: dict[str, Any]) -> dict[str, int]:
    book_id = f"pro_{domain_key}"
    ensure_domain(conn, domain_key, meta)
    alias = DOMAIN_ALIASES.get(domain_key)
    if alias and alias != domain_key:
        # 保留旧四领域别名，指向同一批释义
        ensure_domain(
            conn,
            alias,
            {
                **meta,
                "sort": meta["sort"] - 1 if alias in {"cs", "finance", "biology", "medicine"} else meta["sort"],
            },
        )
    ensure_book(conn, book_id, meta, sort_order=1000 + int(meta["sort"]))

    stats = {"rows": 0, "words": 0, "skipped_empty": 0}
    with path.open(encoding="utf-8") as f:
        for index, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            item = json.loads(line)
            stats["rows"] += 1
            meanings = clean_meanings(item.get("meanings") or item.get("allMeanings"))
            if not meanings:
                stats["skipped_empty"] += 1
                # 仍入库，避免丢词；给占位
                meanings = ["专业释义待整理"]
            wid = upsert_word(conn, item, meanings)
            if not wid:
                continue
            stats["words"] += 1
            upsert_membership(conn, wid, book_id, meanings, index)
            upsert_domain_meanings(conn, wid, domain_key, meanings, path.name)
            if alias and alias != domain_key:
                upsert_domain_meanings(conn, wid, alias, meanings, path.name)
            if stats["rows"] % 5000 == 0:
                conn.commit()
                print(f"  … {path.name} {stats['rows']:,}", flush=True)
    conn.commit()
    return stats


def main() -> None:
    if not PROF_DIR.exists():
        raise SystemExit(f"missing {PROF_DIR}")

    files = sorted(PROF_DIR.glob("*.jsonl"))
    if not files:
        raise SystemExit(f"no jsonl under {PROF_DIR}")

    print(f"[db] {DB_PATH}", flush=True)
    conn = connect_db()
    t0 = time.time()
    all_stats: dict[str, Any] = {}

    for path in files:
        key = path.stem
        meta = DOMAIN_META.get(key)
        if not meta:
            print(f"[skip] unknown domain file: {path.name}", file=sys.stderr)
            continue
        print(f"[import] {path.name} → pro_{key}", flush=True)
        all_stats[key] = import_file(conn, path, key, meta)
        print(f"  done {all_stats[key]}", flush=True)

    refresh_counts(conn)
    export_domains_json(conn)

    word_n = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    book_n = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    mem_n = conn.execute("SELECT COUNT(*) FROM word_book_entries").fetchone()[0]
    dom_n = conn.execute("SELECT COUNT(*) FROM domains").fetchone()[0]
    wdm_n = conn.execute("SELECT COUNT(*) FROM word_domain_meanings").fetchone()[0]
    pro_books = conn.execute(
        "SELECT id, unique_words FROM books WHERE category = 'professional' ORDER BY sort_order"
    ).fetchall()

    print(
        f"[sqlite] words={word_n} books={book_n} memberships={mem_n} "
        f"domains={dom_n} domainMeanings={wdm_n}",
        flush=True,
    )

    integrate = load_integrate()
    taxonomy = integrate.load_taxonomy()
    export_stats = integrate.export_for_app(conn, taxonomy)
    print(f"[export] {export_stats}", flush=True)

    conn.execute(
        "INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)",
        ("professional_imported_at", time.strftime("%Y-%m-%dT%H:%M:%S")),
    )
    conn.commit()
    conn.close()

    print(
        json.dumps(
            {
                "ok": True,
                "elapsedSec": round(time.time() - t0, 1),
                "files": all_stats,
                "professionalBooks": [{"id": b[0], "words": b[1]} for b in pro_books],
                "export": export_stats,
                "db": str(DB_PATH),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
