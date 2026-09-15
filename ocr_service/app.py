from __future__ import annotations

import io
import os
import time
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from .extractor import OcrLine, extract_candidates

MAX_IMAGE_BYTES = int(os.getenv("OCR_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
MIN_CONFIDENCE = float(os.getenv("OCR_MIN_CONFIDENCE", "0.45"))
MAX_IMAGE_PIXELS = int(os.getenv("OCR_MAX_IMAGE_PIXELS", "24000000"))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}

app = FastAPI(title="Zhimi RapidOCR Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("OCR_CORS_ORIGIN", "*")],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_engine():
    from rapidocr import RapidOCR

    # rapidocr >= 3.9 配合 onnxruntime 包时默认使用官方 CPU 配置。
    return RapidOCR()


def decode_image(content: bytes) -> np.ndarray:
    try:
        image = Image.open(io.BytesIO(content))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="无法读取图片") from exc
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="图片像素过大")
    if image.mode not in {"RGB", "L"}:
        image = image.convert("RGB")
    return np.asarray(image)


@app.get("/health")
def health():
    return {"ok": True, "engine": "RapidOCR", "backend": "ONNX Runtime", "engineLoaded": get_engine.cache_info().currsize > 0}


@app.post("/ocr/words")
async def ocr_words(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="只支持 JPG、PNG、WebP 或 BMP 图片")
    content = await file.read(MAX_IMAGE_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="图片为空")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="图片超过 8 MB")

    image = decode_image(content)
    started = time.perf_counter()
    result = get_engine()(image)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    texts = tuple(result.txts or ())
    scores = tuple(result.scores or ())
    boxes = result.boxes.tolist() if result.boxes is not None else []
    lines = [
        OcrLine(
            text=str(text),
            confidence=float(scores[index]) if index < len(scores) else 0.0,
            box=boxes[index] if index < len(boxes) else None,
        )
        for index, text in enumerate(texts)
    ]
    candidates = extract_candidates(lines, min_confidence=MIN_CONFIDENCE)
    return {
        "engine": "RapidOCR",
        "elapsedMs": elapsed_ms,
        "lineCount": len(lines),
        "lines": [
            {"text": line.text, "confidence": round(line.confidence, 4), "box": line.box}
            for line in lines
        ],
        "candidates": candidates,
    }
