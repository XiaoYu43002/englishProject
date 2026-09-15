from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Sequence

WORD_PATTERN = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*")
IGNORED_TOKENS = {
    "http", "https", "www", "com", "jpg", "jpeg", "png", "pdf",
}


@dataclass(frozen=True)
class OcrLine:
    text: str
    confidence: float
    box: Sequence[Sequence[float]] | None = None


def normalize_word(value: str) -> str:
    return value.replace("’", "'").replace("-", "-").strip("'-").lower()


def is_candidate(value: str) -> bool:
    if not value or value in IGNORED_TOKENS:
        return False
    if len(value) > 36:
        return False
    if len(value) == 1 and value not in {"a", "i"}:
        return False
    return any(char.isalpha() for char in value)


def extract_candidates(lines: Iterable[OcrLine], min_confidence: float = 0.45, limit: int = 80) -> list[dict]:
    """从 OCR 行中提取英文候选词，按首次出现排序并保留最高置信度。"""
    ordered: list[str] = []
    candidates: dict[str, dict] = {}
    for line_index, line in enumerate(lines):
        confidence = max(0.0, min(1.0, float(line.confidence)))
        if confidence < min_confidence:
            continue
        for match in WORD_PATTERN.finditer(line.text):
            original = match.group(0)
            normalized = normalize_word(original)
            if not is_candidate(normalized):
                continue
            item = {
                "word": original,
                "normalized": normalized,
                "confidence": round(confidence, 4),
                "lineText": line.text,
                "lineIndex": line_index,
                "box": [list(map(float, point)) for point in line.box] if line.box is not None else None,
            }
            if normalized not in candidates:
                candidates[normalized] = item
                ordered.append(normalized)
            elif confidence > candidates[normalized]["confidence"]:
                candidates[normalized] = item
    return [candidates[key] for key in ordered[:limit]]
