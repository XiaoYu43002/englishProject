#!/usr/bin/env python3
"""Merge full_line_jsonl/full/正序 into one normalized, deduplicated JSONL."""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any


BOOKS = {
    "GMAT": ("gmat", "GMAT"),
    "GRE": ("gre", "GRE"),
    "SAT": ("sat", "SAT"),
    "专八": ("tem8", "英语专业八级"),
    "专四": ("tem4", "英语专业四级"),
    "人教初中七年级": ("pep_junior_7", "人教版初中七年级"),
    "人教初中八年级": ("pep_junior_8", "人教版初中八年级"),
    "人教初中九年级": ("pep_junior_9", "人教版初中九年级"),
    "人教小学三年级": ("pep_primary_3", "人教版小学三年级"),
    "人教小学四年级": ("pep_primary_4", "人教版小学四年级"),
    "人教小学五年级": ("pep_primary_5", "人教版小学五年级"),
    "人教小学六年级": ("pep_primary_6", "人教版小学六年级"),
    "人教高中": ("pep_senior", "人教版高中"),
    "六级": ("cet6", "大学英语六级"),
    "初中": ("junior_high", "初中英语"),
    "北师高中": ("bnu_senior", "北师大版高中"),
    "商务英语": ("bec", "商务英语"),
    "四级": ("cet4", "大学英语四级"),
    "外研社初中": ("fltrp_junior", "外研社版初中"),
    "托福": ("toefl", "托福"),
    "考研": ("postgraduate", "考研英语"),
    "雅思": ("ielts", "雅思"),
    "高中": ("senior_high", "高中英语"),
}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value))).strip()


def word_key(value: str) -> str:
    return clean_text(value).casefold()


def meaningful(value: Any) -> bool:
    return value not in (None, "", [], {})


def has_lexical_text(value: str) -> bool:
    """Reject source placeholders such as '/', '"' and ')' without losing Unicode words."""
    return any(char.isalnum() for char in value)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class WordRecord:
    def __init__(self, word: str) -> None:
        self.word = clean_text(word)
        self.book_ids: list[str] = []
        self.book_names: dict[str, str] = {}
        self.raw_book_ids: list[str] = []
        self.meanings: list[str] = []
        self.meanings_by_book: dict[str, list[str]] = {}
        self.phones: dict[str, collections.Counter[str]] = {
            "us": collections.Counter(), "uk": collections.Counter(), "general": collections.Counter()
        }
        self.pronunciation_refs: dict[str, list[str]] = {"us": [], "uk": [], "general": []}
        self.translations: dict[str, dict[str, Any]] = {}
        self.phrases: dict[str, dict[str, Any]] = {}
        self.sentences: dict[str, dict[str, Any]] = {}
        self.real_exam_sentences: dict[str, dict[str, Any]] = {}
        self.synonyms: dict[str, dict[str, Any]] = {}
        self.antonyms: dict[str, dict[str, Any]] = {}
        self.related_words: dict[str, dict[str, Any]] = {}
        self.memory_methods: dict[str, dict[str, Any]] = {}
        self.exams: dict[str, dict[str, Any]] = {}
        self.source_entries: list[dict[str, Any]] = []

    @staticmethod
    def add_unique(target: list[str], value: Any) -> None:
        value = clean_text(value)
        if value and value not in target:
            target.append(value)

    @staticmethod
    def add_sourced(target: dict[str, dict[str, Any]], payload: dict[str, Any], book_id: str) -> None:
        payload = {k: v for k, v in payload.items() if meaningful(v)}
        key = canonical_json(payload)
        if not key or key == "{}":
            return
        if key not in target:
            target[key] = {**payload, "bookIds": [book_id]}
        elif book_id not in target[key]["bookIds"]:
            target[key]["bookIds"].append(book_id)

    def merge(self, row: dict[str, Any], book_id: str, book_name: str) -> None:
        word_obj = row.get("content", {}).get("word", {})
        content = word_obj.get("content") or {}
        raw_book_id = clean_text(row.get("bookId"))
        if book_id not in self.book_ids:
            self.book_ids.append(book_id)
        self.book_names[book_id] = book_name
        self.add_unique(self.raw_book_ids, raw_book_id)

        phone_fields = (("usphone", "us"), ("ukphone", "uk"), ("phone", "general"))
        for field, kind in phone_fields:
            value = clean_text(content.get(field))
            if value:
                self.phones[kind][value] += 1
        speech_fields = (("usspeech", "us"), ("ukspeech", "uk"), ("speech", "general"))
        for field, kind in speech_fields:
            self.add_unique(self.pronunciation_refs[kind], content.get(field))

        for trans in content.get("trans") or []:
            cn = clean_text(trans.get("tranCn"))
            en = clean_text(trans.get("tranOther"))
            if cn and has_lexical_text(cn):
                self.add_unique(self.meanings, cn)
                self.meanings_by_book.setdefault(book_id, [])
                self.add_unique(self.meanings_by_book[book_id], cn)
            else:
                cn = ""
            payload = {
                "pos": clean_text(trans.get("pos")),
                "cn": cn,
                "en": en,
                "cnLabel": clean_text(trans.get("descCn")),
                "enLabel": clean_text(trans.get("descOther")),
            }
            if cn or en:
                self.add_sourced(self.translations, payload, book_id)

        for phrase in (content.get("phrase") or {}).get("phrases") or []:
            self.add_sourced(self.phrases, {
                "phrase": clean_text(phrase.get("pContent")),
                "meaning": clean_text(phrase.get("pCn")),
            }, book_id)

        for sentence in (content.get("sentence") or {}).get("sentences") or []:
            self.add_sourced(self.sentences, {
                "en": clean_text(sentence.get("sContent")),
                "zh": clean_text(sentence.get("sCn")),
            }, book_id)

        for sentence in (content.get("realExamSentence") or {}).get("sentences") or []:
            self.add_sourced(self.real_exam_sentences, {
                "en": clean_text(sentence.get("sContent")),
                "zh": clean_text(sentence.get("sCn")),
                "source": sentence.get("sourceInfo") or {},
            }, book_id)

        for syn in (content.get("syno") or {}).get("synos") or []:
            words = [clean_text(x.get("w")) for x in (syn.get("hwds") or [])]
            self.add_sourced(self.synonyms, {
                "pos": clean_text(syn.get("pos")),
                "meaning": clean_text(syn.get("tran")),
                "words": [x for x in words if x],
            }, book_id)

        for ant in (content.get("antos") or {}).get("anto") or []:
            self.add_sourced(self.antonyms, {"word": clean_text(ant.get("hwd"))}, book_id)

        for rel in (content.get("relWord") or {}).get("rels") or []:
            for related in rel.get("words") or []:
                self.add_sourced(self.related_words, {
                    "pos": clean_text(rel.get("pos")),
                    "word": clean_text(related.get("hwd")),
                    "meaning": clean_text(related.get("tran")),
                }, book_id)

        rem = content.get("remMethod") or {}
        if clean_text(rem.get("val")):
            self.add_sourced(self.memory_methods, {"text": clean_text(rem.get("val"))}, book_id)

        for exam in content.get("exam") or []:
            self.add_sourced(self.exams, exam, book_id)

        meta = {
            "bookId": book_id,
            "rawBookId": raw_book_id,
            "wordId": clean_text(word_obj.get("wordId")),
            "wordRank": row.get("wordRank"),
            "star": content.get("star"),
        }
        self.source_entries.append({k: v for k, v in meta.items() if meaningful(v)})

    @staticmethod
    def primary(counter: collections.Counter[str]) -> str:
        if not counter:
            return ""
        return sorted(counter.items(), key=lambda item: (-item[1], -len(item[0]), item[0]))[0][0]

    @staticmethod
    def values(items: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        return list(items.values())

    def export(self) -> dict[str, Any]:
        usphone = self.primary(self.phones["us"])
        ukphone = self.primary(self.phones["uk"])
        phone = self.primary(self.phones["general"])
        phonetics = {kind: list(counter.keys()) for kind, counter in self.phones.items() if counter}
        pronunciation_refs = {k: v for k, v in self.pronunciation_refs.items() if v}
        output = {
            "id": self.word,
            "word": self.word,
            "usphone": usphone,
            "ukphone": ukphone,
            "phone": phone,
            "phonetics": phonetics,
            "pronunciationRefs": pronunciation_refs,
            "meanings": self.meanings,
            "meaningsByBook": self.meanings_by_book,
            "bookIds": self.book_ids,
            "bookNames": self.book_names,
            "sourceBookIds": self.raw_book_ids,
            "translations": self.values(self.translations),
            "phrases": self.values(self.phrases),
            "sentences": self.values(self.sentences),
            "realExamSentences": self.values(self.real_exam_sentences),
            "synonyms": self.values(self.synonyms),
            "antonyms": self.values(self.antonyms),
            "relatedWords": self.values(self.related_words),
            "memoryMethods": self.values(self.memory_methods),
            "exams": self.values(self.exams),
            "sourceEntries": self.source_entries,
            "reviewRequired": not bool(self.meanings) or not bool(usphone or ukphone or phone),
        }
        return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    records: dict[str, WordRecord] = {}
    records_by_book: dict[str, dict[str, WordRecord]] = {
        book_id: {} for book_id, _book_name in BOOKS.values()
    }
    input_stats: dict[str, int] = {}
    parse_errors: list[dict[str, Any]] = []

    files = sorted(args.input_dir.glob("*.jsonl"), key=lambda p: p.name)
    unknown = [p.stem for p in files if p.stem not in BOOKS]
    if unknown:
        raise SystemExit(f"Unknown book filenames: {unknown}")
    if len(files) != 23:
        raise SystemExit(f"Expected 23 books, found {len(files)}")

    for path in files:
        book_id, book_name = BOOKS[path.stem]
        count = 0
        with path.open("r", encoding="utf-8-sig") as handle:
            for line_number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                count += 1
                try:
                    row = json.loads(line)
                    head = clean_text(row.get("content", {}).get("word", {}).get("wordHead"))
                    if not head:
                        raise ValueError("missing content.word.wordHead")
                    key = word_key(head)
                    if key not in records:
                        records[key] = WordRecord(head)
                    records[key].merge(row, book_id, book_name)
                    if key not in records_by_book[book_id]:
                        records_by_book[book_id][key] = WordRecord(head)
                    records_by_book[book_id][key].merge(row, book_id, book_name)
                except Exception as exc:
                    parse_errors.append({"file": path.name, "line": line_number, "error": str(exc)})
        input_stats[book_id] = count

    output_path = args.output_dir / "full_merged.jsonl"
    sample_path = args.output_dir / "sample_100.jsonl"
    review_path = args.output_dir / "review_required.jsonl"
    sha = hashlib.sha256()
    review_count = 0
    no_phonetic_count = 0
    multi_book_count = 0
    sorted_records = sorted(records.values(), key=lambda x: word_key(x.word))
    with output_path.open("w", encoding="utf-8", newline="\n") as output, sample_path.open(
        "w", encoding="utf-8", newline="\n"
    ) as sample, review_path.open("w", encoding="utf-8", newline="\n") as review:
        for index, record in enumerate(sorted_records):
            item = record.export()
            if item["reviewRequired"]:
                review_count += 1
            if not (item["usphone"] or item["ukphone"] or item["phone"]):
                no_phonetic_count += 1
            if len(item["bookIds"]) > 1:
                multi_book_count += 1
            encoded = (json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
            output.write(encoded.decode("utf-8"))
            sha.update(encoded)
            if index < 100:
                sample.write(encoded.decode("utf-8"))
            if item["reviewRequired"]:
                review.write(encoded.decode("utf-8"))

    books_root = args.output_dir / "books"
    books_root.mkdir(parents=True, exist_ok=True)
    books_manifest: list[dict[str, Any]] = []
    file_by_stem = {path.stem: path for path in files}
    for source_name, (book_id, book_name) in BOOKS.items():
        book_dir = books_root / source_name
        book_dir.mkdir(parents=True, exist_ok=True)
        full_path = book_dir / "full.jsonl"
        missing_path = book_dir / "missing_phonetic.jsonl"
        source_rows_path = book_dir / "source_rows.jsonl"
        source_missing_path = book_dir / "source_rows_missing_phonetic.jsonl"
        unique_records = sorted(records_by_book[book_id].values(), key=lambda x: word_key(x.word))
        unique_missing = 0
        with full_path.open("w", encoding="utf-8", newline="\n") as full_handle, missing_path.open(
            "w", encoding="utf-8", newline="\n"
        ) as missing_handle:
            for record in unique_records:
                item = record.export()
                line = json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n"
                full_handle.write(line)
                if not (item["usphone"] or item["ukphone"] or item["phone"]):
                    missing_handle.write(line)
                    unique_missing += 1

        source_missing = 0
        source_rows = 0
        with file_by_stem[source_name].open("r", encoding="utf-8-sig") as source, source_rows_path.open(
            "w", encoding="utf-8", newline="\n"
        ) as source_output, source_missing_path.open("w", encoding="utf-8", newline="\n") as missing_output:
            for line in source:
                if not line.strip():
                    continue
                row = json.loads(line)
                head = clean_text(row.get("content", {}).get("word", {}).get("wordHead"))
                record = WordRecord(head)
                record.merge(row, book_id, book_name)
                item = record.export()
                encoded = json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n"
                source_output.write(encoded)
                source_rows += 1
                if not (item["usphone"] or item["ukphone"] or item["phone"]):
                    missing_output.write(encoded)
                    source_missing += 1

        if source_rows != input_stats[book_id]:
            raise SystemExit(f"Source-row count mismatch for {book_id}: {source_rows} != {input_stats[book_id]}")
        book_manifest = {
            "bookId": book_id,
            "bookName": book_name,
            "sourceFile": f"{source_name}.jsonl",
            "sourceRows": source_rows,
            "uniqueWords": len(unique_records),
            "duplicateRowsMerged": source_rows - len(unique_records),
            "missingPhoneticUniqueWords": unique_missing,
            "missingPhoneticSourceRows": source_missing,
            "fullFile": "full.jsonl",
            "missingPhoneticFile": "missing_phonetic.jsonl",
            "sourceRowsFile": "source_rows.jsonl",
            "sourceRowsMissingPhoneticFile": "source_rows_missing_phonetic.jsonl",
            "fullSha256": sha256_file(full_path),
            "missingPhoneticSha256": sha256_file(missing_path),
            "sourceRowsSha256": sha256_file(source_rows_path),
            "sourceRowsMissingPhoneticSha256": sha256_file(source_missing_path),
        }
        (book_dir / "manifest.json").write_text(
            json.dumps(book_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        books_manifest.append(book_manifest)

    (args.output_dir / "books_manifest.json").write_text(
        json.dumps(books_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    manifest = {
        "format": "JSON Lines (UTF-8, one merged word per line)",
        "source": "KyleBing/english-vocabulary/full_line_jsonl/full/正序",
        "sourceFiles": len(files),
        "sourceRows": sum(input_stats.values()),
        "uniqueWords": len(sorted_records),
        "multiBookWords": multi_book_count,
        "reviewRequired": review_count,
        "missingPhonetic": no_phonetic_count,
        "parseErrors": len(parse_errors),
        "inputRowsByBook": input_stats,
        "output": output_path.name,
        "reviewOutput": review_path.name,
        "booksRoot": "books",
        "perBookOutputs": len(books_manifest),
        "sha256": sha.hexdigest(),
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (args.output_dir / "parse_errors.json").write_text(
        json.dumps(parse_errors, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
