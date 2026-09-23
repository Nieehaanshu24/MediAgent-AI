# Build context must be the REPOSITORY ROOT (see docker-compose.yml), because
# app.py imports from the top-level `training` package (e.g. `from
# training.ocr_lab_report import ...`) and resolves ChromaDB / calibrator
# artifacts under ./training/... at runtime.
FROM python:3.11-slim

WORKDIR /app

# Install Python deps first for layer caching.
COPY python_service/requirements.txt ./python_service/requirements.txt
RUN pip install --no-cache-dir -r python_service/requirements.txt

# Copy the FastAPI service and the training package it depends on.
# (Datasets/weights are NOT baked in; the heavy artifacts are mounted read-only
# at runtime via docker-compose volumes.)
COPY python_service ./python_service
COPY training ./training

EXPOSE 8000

# Run the app module from the repo-root context so `training` is importable.
CMD ["uvicorn", "python_service.app:app", "--host", "0.0.0.0", "--port", "8000"]
