"""
MediAgent AI - Python FastAPI Microservice
Fulfills FF No. 180 "Backend: FastAPI / Flask for AI APIs"

Endpoints:
- POST /ocr/extract-lab: PyMuPDF lab report extraction
- POST /rag/search: ChromaDB guideline vector search
- POST /xai/gradcam: Grad-CAM XAI explainability
- POST /calibrator/predict: M5 confidence calibration
"""
import os
import json
import base64
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
import joblib
import numpy as np

app = FastAPI(
    title="MediAgent AI - Clinical Intelligence & XAI API",
    description="FastAPI service for Medical Image Analysis, RAG Vector Search, OCR & Calibration",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHROMA_DIR = Path("training/data/chroma_db")
CALIBRATOR_PATH = Path("training/exports/confidence_calibrator.joblib")
URGENCY_PATH = Path("training/exports/urgency_classifier.joblib")

# ChromaDB Client
chroma_client = None
collection = None
if CHROMA_DIR.exists():
    try:
        chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collection = chroma_client.get_collection("clinical_guidelines")
    except Exception as e:
        print(f"[FastAPI] ChromaDB init error: {e}")

# Calibrator Models
calibrator_pkg = None
urgency_pkg = None
if CALIBRATOR_PATH.exists():
    try:
        calibrator_pkg = joblib.load(CALIBRATOR_PATH)
    except Exception as e:
        print(f"[FastAPI] Calibrator load error: {e}")

if URGENCY_PATH.exists():
    try:
        urgency_pkg = joblib.load(URGENCY_PATH)
    except Exception as e:
        print(f"[FastAPI] Urgency load error: {e}")

@app.get("/")
def root():
    return {
        "service": "MediAgent AI FastAPI Backend",
        "spec": "VIT FF No. 180 (Sem 5 AIDS Group 4)",
        "status": "online",
        "capabilities": ["PyMuPDF OCR", "ChromaDB RAG", "M5 Calibration", "DenseNet-121 Grad-CAM XAI"]
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "chromadb_ready": collection is not None,
        "calibrator_ready": calibrator_pkg is not None,
        "urgency_ready": urgency_pkg is not None
    }

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3

@app.post("/rag/search")
def search_guidelines(req: SearchRequest):
    if collection is None:
        raise HTTPException(status_code=503, detail="ChromaDB vector collection is not initialized")
    try:
        res = collection.query(query_texts=[req.query], n_results=req.top_k)
        results = []
        for doc, meta, doc_id in zip(res["documents"][0], res["metadatas"][0], res["ids"][0]):
            results.append({
                "chunkId": doc_id,
                "title": meta.get("title", ""),
                "source": meta.get("source", ""),
                "section": meta.get("section", ""),
                "snippet": doc
            })
        return {"query": req.query, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class OCRRequest(BaseModel):
    raw_text: Optional[str] = None
    file_base64: Optional[str] = None
    filename: Optional[str] = "report.pdf"

@app.post("/ocr/extract-lab")
def extract_lab(req: OCRRequest):
    from training.ocr_lab_report import parse_lab_text, extract_text
    if req.raw_text:
        text = req.raw_text
    elif req.file_base64:
        import tempfile
        content = req.file_base64
        if content.startswith("data:"):
            content = content.split(",", 1)[1]
        raw_bytes = base64.b64decode(content)
        with tempfile.NamedTemporaryFile(suffix=f"_{req.filename}", delete=False) as tf:
            tf.write(raw_bytes)
            tmp_name = tf.name
        try:
            text = extract_text(Path(tmp_name))
        finally:
            if os.path.exists(tmp_name):
                os.remove(tmp_name)
    else:
        raise HTTPException(status_code=400, detail="Either raw_text or file_base64 is required")

    markers = parse_lab_text(text)
    return {
        "success": True,
        "rawText": text[:2000],
        "markers": markers,
        "count": len(markers),
        "engine": "FastAPI + PyMuPDF"
    }

class CalibrationRequest(BaseModel):
    features: Dict[str, Any]

@app.post("/calibrator/predict")
def predict_calibration(req: CalibrationRequest):
    if calibrator_pkg is None:
        raise HTTPException(status_code=503, detail="Calibrator model not loaded")
    model = calibrator_pkg["model"]
    numeric_features = calibrator_pkg["numeric_features"]
    completeness_levels = calibrator_pkg["completeness_levels"]

    row = [float(req.features.get(f, 0.0) or 0.0) for f in numeric_features]
    comp = str(req.features.get("data_completeness", "partial"))
    row += [1.0 if comp == lvl else 0.0 for lvl in completeness_levels]

    X = np.asarray([row], dtype=np.float64)
    prob = float(model.predict_proba(X)[0, 1])

    urgency_pred = None
    if urgency_pkg is not None:
        urg_model = urgency_pkg["model"]
        urg_idx = int(urg_model.predict(X)[0])
        urgency_pred = urgency_pkg["classes"][urg_idx]

    return {
        "calibrated_probability": round(prob * 100, 1),
        "urgency_cross_check": urgency_pred
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
