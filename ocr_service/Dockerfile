FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*
COPY ocr_service/requirements.txt /app/ocr_service/requirements.txt
RUN pip install --no-cache-dir -r /app/ocr_service/requirements.txt
COPY ocr_service /app/ocr_service

EXPOSE 8790
CMD ["python", "-m", "uvicorn", "ocr_service.app:app", "--host", "0.0.0.0", "--port", "8790"]
