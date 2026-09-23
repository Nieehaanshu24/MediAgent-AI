# MediAgent AI 🏥
### A Multi-Agent Retrieval-Augmented Generation (RAG) System for Intelligent Medical Triage and Explainable Clinical Decision Support

**VIT Project Registration & Progress Review — FF No. 180 | Group 4 | AY 2026-27 | Semester 5**  
**Department:** Artificial Intelligence and Data Science (AIDS), Vishwakarma Institute of Technology, Pune  
**Internal Guide:** Dr. Bhagwan D. Thorat (bhagwan.thorat@vit.edu)

---

## Overview

MediAgent AI is a multi-agent clinical decision support system that assists doctors and residents with rapid, evidence-based preliminary diagnoses. It combines:

- **M1 – Radiology Agent** — DenseNet-121 ONNX chest X-ray classification with Grad-CAM XAI overlays
- **M2 – RAG Knowledge Agent** — SentenceTransformer retriever + ChromaDB vector store over 10 clinical guidelines
- **M3 – Lab Analyst Agent** — PyMuPDF OCR lab report extraction + rule-based flagging (19 analytes)
- **M4 – Adaptive Interviewer** — Gemini LLM structured patient intake with symptom elicitation
- **M5 – Confidence Calibrator** — 4-pillar sklearn calibrator (Interview 25% + Radiology 30% + Lab 30% + Guideline 15%)

---

## Architecture

```
Browser (React + Vite)
       │
       ▼
Express API Server (port 3000)
  ├── /api/intake          ← Interviewer Agent (Gemini)
  ├── /api/analyze-radiology ← Radiology Agent (ONNX + Grad-CAM)
  ├── /api/analyze-labs    ← Lab Analyst Agent (Gemini + rule-based)
  ├── /api/synthesize      ← Doctor Agent (Gemini + pillar calibration)
  └── /api/ocr/extract-lab ← OCR Service (PyMuPDF subprocess)
       │
       ▼
FastAPI Microservice (port 8000)   [optional, for demo]
  ├── /rag/search          ← ChromaDB retrieval
  ├── /ocr/extract-lab     ← PyMuPDF OCR
  └── /calibrator/predict  ← M5 joblib inference
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS |
| Backend | Node.js 20, Express, TypeScript |
| AI/LLM | Google Gemini 2.5 Flash |
| Radiology Model | DenseNet-121 ONNX (HuggingFace) |
| Retriever | SentenceTransformer (S-PubMedBert-MS-MARCO), ChromaDB |
| OCR | PyMuPDF (pymupdf 1.28.2) |
| Calibrator | scikit-learn LogisticRegression + CalibratedClassifierCV |
| Database | Firebase Firestore |
| Python Service | FastAPI |

---

## Quick Start

### Prerequisites
- Node.js ≥ 20, npm ≥ 10
- Python ≥ 3.11
- A `.env` file with API keys (see below)

### Environment Setup

Create `.env` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}   # JSON string
```

### Install & Run (Development)

```bash
# Install Node dependencies
npm install

# Install Python dependencies (for OCR + Python service)
pip install pymupdf scikit-learn sentence-transformers chromadb fastapi uvicorn

# Start dev server (Express + Vite HMR)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

### Optional: Start FastAPI Microservice

```bash
cd python_service
pip install -r requirements.txt   # or: pip install fastapi uvicorn chromadb pymupdf scikit-learn sentence-transformers
python app.py
```

FastAPI runs on port 8000 with Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Training Pipeline

All model training artifacts live in `training/`. Run from the repo root.

```bash
# M5 – Confidence Calibrator (synthetic data already in training/data/mimic/)
python training/train_calibrator.py

# M2 – RAG Retriever fine-tuning (corpus already built in training/data/corpus/)
python training/train_retriever.py --skip-hard-negatives

# M2 – Build ChromaDB vector store
python training/build_chromadb_guidelines.py

# M2 – Export retriever embeddings
python training/export_retriever_onnx.py --skip-onnx --build-embeddings

# XAI – Generate Grad-CAM overlays (DenseNet-121, PyTorch)
python training/generate_gradcam_overlay.py
```

### Trained Artifacts

| Artifact | Path |
|---------|------|
| M5 Calibrator | `training/exports/confidence_calibrator.joblib` |
| M5 Urgency Classifier | `training/exports/urgency_classifier.joblib` |
| M2 Fine-tuned Retriever | `training/exports/mediagent-retriever/` |
| Corpus Embeddings | `training/data/corpus/embeddings.f16.bin` |
| ChromaDB Store | `training/data/chroma_db/` |
| Grad-CAM Overlay | `public/xai/gradcam_overlay.png` |
| Pillar Config | `training/out/pillar_weights.json` |
| Calibration Report | `training/out/calibration_m5_report.txt` |
| Retriever Ablation | `training/out/retriever_ablation.json` |

---

## Key Features

### 🧠 Multi-Agent Orchestration
Five specialized agents collaborate asynchronously: Interviewer → Radiologist → Lab Analyst → Doctor (synthesis). Each agent has a Gemini LLM path with a deterministic rule-based fallback.

### 📊 4-Pillar Confidence Calibration
Every probable condition gets a calibrated confidence score across four evidence pillars:
- **Interview** (25%) — symptom specificity
- **Radiology** (30%) — imaging correlation
- **Lab** (30%) — biomarker correlation  
- **Guideline** (15%) — evidence-base citation

### 🔬 OCR Lab Report Upload
Upload PDF or TXT lab reports. The system extracts values for 19 analytes (CBC, metabolic panel, etc.) via PyMuPDF and auto-populates the diagnostics form.

### 🩻 Grad-CAM XAI
DenseNet-121 chest X-ray analysis produces gradient-weighted class activation maps showing which image regions drove the classification.

### 🔒 Secure Firestore Rules
Patient data requires authentication. Firestore rules enforce `request.auth != null` for case read/write.

---

## Project Structure

```
mediagent-ai/
├── src/                    # React frontend
│   ├── components/         # DiagnosticsForm, FinalReportView, ...
│   └── types/              # clinical.ts type definitions
├── server/                 # Express backend
│   ├── agents/             # interviewer, radiologist, labAnalyst, doctor, confidencePillars
│   ├── models/             # radiologyModel.ts (ONNX runner)
│   └── services/           # ocrService.ts, firebaseService.ts
├── python_service/         # FastAPI microservice
│   └── app.py
├── training/               # All training scripts and data
│   ├── data/               # mimic, corpus, chroma_db, raw/guidelines
│   ├── exports/            # Trained model artifacts
│   └── out/                # Reports, Grad-CAM images
├── public/                 # Static assets (xai/, models/)
├── firestore.rules         # Hardened security rules
└── docs/                   # Project documentation
```

---

## Documentation

- [`docs/CODEBASE_VS_SYNOPSIS_AND_TRAINING_ROADMAP.md`](docs/CODEBASE_VS_SYNOPSIS_AND_TRAINING_ROADMAP.md) — Full gap analysis vs. synopsis
- [`docs/MID_SEM_PROGRESS_REVIEW_REPORT.md`](docs/MID_SEM_PROGRESS_REVIEW_REPORT.md) — Mid-semester review report
- [`training/README.md`](training/README.md) — Training pipeline documentation

---

## Team — Group No. 4 (AIDS, TY-B)

| Sr. No. | Roll No. | G.R. No. | Name of Student | Email ID | Primary Module Ownership | Presentation Order |
|:---:|:---:|:---:|---|---|---|:---:|
| **1** | **57** | **12414454** | **Nieehaanshu Hireh** | nieehaanshu.hireh24@vit.edu | **Project Lead, Problem Scope & RAG Knowledge Retrieval (M2)** | **Lead & Intro (Min 0–2)** |
| 2 | 38 | 12413482 | **Krissh Garsund** | krissh.garsund24@vit.edu | Multi-Agent Orchestration & Interviewer Agent (M4) | Module 2 (Min 2–4) |
| 3 | 41 | 12410543 | **Harsh Gawas** | harsh.gawas24@vit.edu | Medical Image Processing, DenseNet-121 & Grad-CAM XAI (M1) | Module 3 (Min 4–6) |
| 4 | 58 | 12414058 | **Faheem Inamdar** | faheem.inamdar24@vit.edu | Document OCR & Clinical Lab Named Entity Recognition (M3) | Module 4 (Min 6–8) |
| 5 | 70 | 12415175 | **Aarya Dangre** | aarya.dangre241@vit.edu | Confidence Calibration (M5), Microservices & Cloud Architecture | Module 5 (Min 8–10) |

**Internal Guide:** Dr. Bhagwan D. Thorat  
**Department:** Artificial Intelligence and Data Science (AIDS), Vishwakarma Institute of Technology, Pune  
**Academic Year:** 2026-27 | **Semester:** 5 (Review 1)
