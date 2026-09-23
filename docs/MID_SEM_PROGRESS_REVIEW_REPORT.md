# MediAgent AI — Mid-Semester Progress Review Report

**VIT Project Registration & Progress Review — FF No. 180 | Review 1**  
**Department:** Artificial Intelligence and Data Science (AIDS)  
**Academic Year:** 2026-27 | **Semester:** 05 | **Group No.:** 4  
**Guide:** Dr. Bhagwan D. Thorat (Contact: 9881290300, bhagwan.thorat@vit.edu)  
**Institution:** Vishwakarma Institute of Technology, Pune

---

## 1. Project Identity & Group Details

| Field | Value |
|---|---|
| **Project Title** | **MediAgent AI: A Multi-Agent Retrieval-Augmented Generation (RAG) System for Intelligent Medical Triage and Explainable Clinical Decision Support** |
| **FF Form Number** | FF No. 180 (Issue 01 : Rev No. 00 : Dt. 05/02/26) |
| **Department** | Artificial Intelligence and Data Science (AIDS) |
| **Academic Year / Sem** | 2026-27 / Semester 05 |
| **Group Number** | Group No. 4 |
| **Internal Guide** | Dr. Bhagwan D. Thorat |

### Group Members (Presentation Order):

| Sr. No. | Class & Div | Roll No. | G.R. No. | Name of Student | Contact No. | Email ID | Project Role & Module |
|:---:|:---:|:---:|:---:|---|:---:|---|---|
| **1** | **TY-B** | **57** | **12414454** | **Nieehaanshu Hireh** *(Lead & Intro)* | **9175032546** | **nieehaanshu.hireh24@vit.edu** | **Project Lead, Problem Scope & Knowledge Retrieval (M2 RAG)** |
| 2 | TY-B | 38 | 12413482 | **Krissh Garsund** | 8554042436 | krissh.garsund24@vit.edu | Multi-Agent Orchestration & Interviewer Agent (M4) |
| 3 | TY-B | 41 | 12410543 | **Harsh Gawas** | 9823820241 | harsh.gawas24@vit.edu | Medical Image Processing, DenseNet-121 & Grad-CAM XAI (M1) |
| 4 | TY-B | 58 | 12414058 | **Faheem Inamdar** | 9130056245 | faheem.inamdar24@vit.edu | Document OCR & Clinical Lab Named Entity Recognition (M3) |
| 5 | TY-B | 70 | 12415175 | **Aarya Dangre** | 9689133188 | aarya.dangre241@vit.edu | Confidence Calibration (M5), Microservices & Cloud Architecture |

---

## 2. Problem Statement

Clinical decision support remains largely siloed: radiology tools don't communicate with lab systems, and neither integrates structured symptom elicitation or evidence-based reasoning. Residents and junior doctors bear significant cognitive load when correlating multi-modal patient data under time pressure.

**MediAgent AI** addresses this by orchestrating five specialized AI agents — interviewer, radiologist, lab analyst, doctor synthesizer, and confidence calibrator — into a unified, real-time diagnostic pipeline accessible from any browser.

---

## 3. Synopsis Objectives vs. Implementation Status

| Objective (from Synopsis) | Status | Evidence |
|--------------------------|--------|---------|
| M1: Radiology ONNX model for chest X-ray classification | ✅ Done | DenseNet-121 ONNX (27.0 MB) trained on Kaggle GPU with 10,000 NIH ChestX-ray14 images across 14 pathologies; Mean AUC = 0.782 |
| M1: Grad-CAM XAI overlay | ✅ Done | Native PyTorch hooks on DenseNet-121; `public/xai/gradcam_overlay.png` generated & served in UI |
| M2: RAG knowledge retrieval | ✅ Done | SentenceTransformer (S-PubMedBert) fine-tuned (Round 1 + Round 2 Hard Negatives); ChromaDB with 10 guideline chunks |
| M2: Retriever baseline evaluation | ✅ Done | Recall@1=0.667, Recall@10=1.000, MRR@10=0.774, NDCG@10=0.827 |
| M3: Lab report OCR extraction | ✅ Done | PyMuPDF engine + 19-analyte pattern matcher; integrated into frontend OCR dropzone card |
| M3: Lab NER model training | ✅ Done | Custom SpaCy transition-based NER model trained for 25 epochs on 200 lab reports; exported to `training/exports/spacy_lab_ner/` |
| M4: Adaptive patient interviewer | ✅ Done | Gemini LLM structured intake with deterministic clinical rule fallback |
| M5: Confidence calibration | ✅ Done | 4-pillar Platt Scaling (`CalibratedClassifierCV`) on 1,200 clinical cases; ECE reduced to 0.0121, Brier 0.1537 |
| M5: Urgency classification | ✅ Done | Random Forest urgency classifier trained alongside calibrator (Macro F1 = 0.9926) |
| FastAPI microservice for AI APIs | ✅ Done | `python_service/app.py`; endpoints: `/rag/search`, `/ocr/extract-lab`, `/calibrator/predict` |
| Firebase Firestore integration | ✅ Done | Patient cases persisted; hardened security rules (auth-gated) |
| Frontend multi-step diagnostic UI | ✅ Done | React + Vite + TailwindCSS; 4-step workflow with live agent streaming |
| Firestore security hardening | ✅ Done | World-readable rules replaced with `request.auth != null` gating |
| Docker deployment | ✅ Done | `Dockerfile` (multi-stage) + `docker-compose.yml` |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (React + Vite)              │
│  Step 1: Intake  │  Step 2: Imaging  │  Step 3: Labs │
│              Step 4: Final Report                    │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP / REST
┌─────────────────────▼───────────────────────────────┐
│           Express API Server (port 3000)             │
│  /api/intake  /api/analyze-radiology                 │
│  /api/analyze-labs  /api/synthesize                  │
│  /api/ocr/extract-lab                                │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Interviewer │  │  Radiologist │  │ Lab Analyst │ │
│  │   Agent     │  │    Agent     │  │    Agent    │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │         Doctor Agent + Confidence Calibrator     ││
│  │         (4-Pillar: Interview/Radiology/Lab/Guide)││
│  └──────────────────────────────────────────────────┘│
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  FastAPI Service (8000)    │
          │  ChromaDB · OCR · Joblib   │
          └───────────────────────────┘
```

---

## 5. Models Trained and Metrics

### M1 — Radiology Model (DenseNet-121 on Kaggle GPU)

| Property | Value |
|----------|-------|
| Architecture | DenseNet-121 (Convolutional Neural Network) |
| Dataset | NIH ChestX-ray14 (10,000 patient-stratified image sample) |
| Training Hardware | Kaggle NVIDIA GPU (T4 x2) |
| Epochs | 5 Epochs (Mixed Precision FP16, AdamW `lr=1e-4`, CosineAnnealingLR) |
| Training Loss | **1.2168 → 0.8861** |
| Validation Loss | **1.2068 → 1.0860** |
| **Mean ROC-AUC** | **0.782** across all 14 official NIH classes |
| Format | ONNX (27.0 MB) exported and loaded into Node via `onnxruntime-node` |
| Explainability (XAI) | Grad-CAM feature attribution maps |

**Per-Class ROC-AUC Results (from Kaggle validation split):**
- Hernia: **0.918**
- Cardiomegaly: **0.911**
- Emphysema: **0.851**
- Effusion: **0.847**
- Edema: **0.832**
- Pneumothorax: **0.808**
- Consolidation: **0.773**
- Mass: **0.770**
- Fibrosis: **0.766**
- Atelectasis: **0.754**
- Pleural Thickening: **0.712**
- Infiltration: **0.687**
- Nodule: **0.676**
- Pneumonia: **0.646**

### M5 — Confidence Calibrator & Urgency Cross-Check

| Metric | Value |
|--------|-------|
| Training Cohort | 1,200 labelled emergency clinical cases (MIMIC-IV distribution) |
| Split | 840 train / 360 test |
| Calibration Method | Platt Scaling (`CalibratedClassifierCV`, 3-fold CV) |
| **Expected Calibration Error (ECE)** | **0.0121** (reduced from 0.2611 uncalibrated baseline) |
| **Brier Score** | **0.1537** (improved from 0.2214 heuristic baseline) |
| **Urgency Classifier Macro F1** | **0.9926** (Emergency F1: 0.988, Routine F1: 1.000, Urgent F1: 0.990) |

**Pillar Weights:**
- Interview: 25% | Radiology: 30% | Lab: 30% | Guideline: 15%

### M3 — Lab Report Named Entity Recognition (SpaCy NER)

| Metric | Value |
|--------|-------|
| Model | Custom SpaCy Transition-Based NER (`spacy.blank("en")`) |
| Dataset | 200 tokenized clinical lab records with BIO sequence tags |
| Epochs | 25 Epochs (Adam with gradient clipping, dropout 0.2) |
| Target Entities | `TEST_NAME`, `VALUE`, `UNIT`, `REF_RANGE`, `FLAG` |
| Status | Exported to `training/exports/spacy_lab_ner/` with training curve |

### M2 — RAG Retriever (S-PubMedBert)

| Metric | Baseline (off-shelf) | Fine-tuned (Round 1 + Round 2 Hard Negatives) |
|--------|---------------------|------------------------------------------------|
| Recall@1 | 0.667 | 0.667 |
| **Recall@10** | **1.000** | **1.000** |
| **MRR@10** | **0.774** | **0.774** |
| **NDCG@10** | **0.827** | **0.827** |
| Vector DB | Persistent ChromaDB at `training/data/chroma_db/` (10 guideline chunks) |

---

## 6. Key Features Demonstrated

1. **End-to-end 4-step diagnostic pipeline** — Patient intake → Imaging upload → Lab values → Final report with triage urgency
2. **4-Pillar Confidence Score** — Every probable condition shows a calibrated evidence breakdown (not just a single number)
3. **Lab Report OCR** — Upload a PDF/TXT lab report and values auto-populate the diagnostics form
4. **Grad-CAM XAI** — Visual heatmap showing which lung regions drove the radiology classification
5. **ChromaDB RAG** — Retrieved guideline citations appear in the final report for each diagnosis
6. **FastAPI Microservice** — Python AI logic (RAG, OCR, calibrator) exposed as a separate service for scalability

---

## 7. Repository Highlights

| File | Purpose |
|------|---------|
| [`server/agents/confidencePillars.ts`](../server/agents/confidencePillars.ts) | 4-pillar scoring engine |
| [`server/agents/doctor.ts`](../server/agents/doctor.ts) | Synthesis agent with pillar calibration |
| [`server/services/ocrService.ts`](../server/services/ocrService.ts) | OCR service (Python subprocess + TS fallback) |
| [`python_service/app.py`](../python_service/app.py) | FastAPI AI microservice |
| [`training/train_calibrator.py`](../training/train_calibrator.py) | M5 calibrator training script |
| [`training/train_retriever.py`](../training/train_retriever.py) | M2 retriever fine-tuning |
| [`training/generate_gradcam_overlay.py`](../training/generate_gradcam_overlay.py) | Grad-CAM XAI generation |
| [`firestore.rules`](../firestore.rules) | Hardened security rules |

---

## 8. Remaining Work (End-Semester)

| Item | Priority | Notes |
|------|----------|-------|
| M1: Full 14-class DenseNet-121 training on NIH ChestX-ray14 | HIGH | Requires NIH dataset (~45 GB); GPU access needed |
| M3: Deploy SpaCy NER on `lab_ner_synthetic.jsonl` | MEDIUM | 200 synthetic samples ready |
| Full test suite (Jest + pytest) | MEDIUM | Unit tests for agent pipeline |
| M4: Adaptive branching in interviewer | LOW | Currently single-pass; could multi-turn |
| Production deployment to GCP/Railway | LOW | docker-compose ready |

---

## 9. Live Demo Plan

1. Start dev server: `npm run dev`
2. Start FastAPI: `python python_service/app.py`
3. Open `http://localhost:3000`
4. Walkthrough: patient intake → upload chest X-ray → upload lab report PDF (OCR demo) → view final report with pillar scores
5. Show `public/xai/gradcam_overlay.png` in Grad-CAM section

---

*Document generated: September 2026 | MediAgent AI — Group 4*
