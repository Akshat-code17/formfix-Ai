FROM python:3.12.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/document/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock
COPY services/document/ .
RUN useradd --uid 10001 --create-home document
USER document
EXPOSE 8000
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000","--no-access-log","--limit-concurrency","4"]
