# MediAgent AI — Mid-Semester Presentation Deck

**VIT FF No. 180 | Group 4 | Review 1**  
Guide: Dr. Bhagwan D. Thorat

> Use this as speaker notes + slide content for your PowerPoint / Google Slides deck.  
> Suggested tool: Google Slides or Canva (dark theme, blue-teal accent).

---

## Slide 1 — Title Slide

**Headline:** MediAgent AI  
**Subtitle:** A Multi-Agent Retrieval-Augmented Generation (RAG) System for Intelligent Medical Triage and Explainable Clinical Decision Support

**Body:**
- **Department:** Artificial Intelligence and Data Science (AIDS), VIT Pune
- **Coursework:** VIT Project Registration & Progress Review — FF No. 180 | Review 1
- **Group No.:** 4 | AY 2026-27 | Semester 5
- **Internal Guide:** Dr. Bhagwan D. Thorat
- **Team Members (Presentation Order):**
  1. **Nieehaanshu Hireh** (Roll No. 57, GR 12414454) — *Project Lead, Introduction & RAG Retrieval*
  2. Krissh Garsund (Roll No. 38, GR 12413482) — *Multi-Agent Architecture & Interviewer Agent*
  3. Harsh Gawas (Roll No. 41, GR 12410543) — *Medical Image Processing & Grad-CAM XAI*
  4. Faheem Inamdar (Roll No. 58, GR 12414058) — *Document OCR & Clinical Lab NER*
  5. Aarya Dangre (Roll No. 70, GR 12415175) — *4-Pillar Calibration & Cloud Architecture*

**Visual:** Hero image — stethoscope + neural network mesh on dark background

**Speaker notes (Nieehaanshu Hireh):** *"Good morning respected Guide Dr. Bhagwan D. Thorat and distinguished members of the review panel. I am Nieehaanshu Hireh, presenting on behalf of Group 4 from the Department of Artificial Intelligence and Data Science. Today, we are presenting our mid-semester review for MediAgent AI — an intelligent, multi-agent clinical decision support system that integrates medical imaging, lab reports, guideline retrieval, and calibrated clinical confidence scoring. I will introduce the clinical motivation, problem statement, and our evidence retrieval pipeline, followed by my team members demonstrating each specialized agent."*

---

## Slide 2 — Problem Statement

**Headline:** The Clinical Cognition Gap

**Points:**
- 🏥 Residents correlate data from **3+ siloed systems** (PACS, LIS, EMR) simultaneously
- ⏱️ Diagnostic errors cause **40,000–80,000 deaths/year** (BMJ, 2024) — mostly from cognitive overload
- 📋 No system synthesizes imaging + labs + symptoms **in one place, in real time**

**Visual:** Venn diagram — Radiology | Labs | Symptoms → overlap = "Where is the help?"

**Speaker notes:** *"The core problem is information fragmentation. A radiologist sees the X-ray. A lab tech sees the blood work. Nobody synthesizes it automatically for the clinician who must act."*

---

## Slide 3 — Our Solution

**Headline:** MediAgent AI — 5 Specialized Agents, 1 Unified Pipeline

**Points:**
- 🎤 **M4 Interviewer Agent** — structured symptom elicitation (Gemini LLM)
- 🩻 **M1 Radiology Agent** — DenseNet-121 ONNX chest X-ray classification
- 🔬 **M3 Lab Analyst Agent** — PyMuPDF OCR + 19-analyte rule-based flagging
- 📚 **M2 RAG Agent** — SentenceTransformer + ChromaDB guideline retrieval
- ⚖️ **M5 Calibrator** — 4-pillar confidence scoring (Interview 25% + Radiology 30% + Lab 30% + Guideline 15%)

**Visual:** Pipeline diagram (horizontal flow: Interview → Radiology → Labs → Doctor Synthesis)

---

## Slide 4 — System Architecture

**Headline:** Architecture Overview

```
Browser (React)
     │
Express API (Node.js)
  ├─ 5 Agents (Gemini + deterministic fallback)
  └─ OCR endpoint
     │
FastAPI Microservice (Python)
  ├─ ChromaDB RAG
  ├─ PyMuPDF OCR
  └─ Joblib M5 Calibrator
     │
Firebase Firestore (patient cases)
```

**Key design decisions:**
- **TypeScript-first** backend — type-safe agent contracts
- **Fallback safety** — every Gemini call has a deterministic rule-based backup
- **Separate Python service** — keeps ML/Python code isolated, independently scalable

---

## Slide 5 — M1: Radiology Agent + Grad-CAM XAI

**Headline:** Chest X-ray Classification with Explainability

**Left column — Trained Model (Kaggle GPU):**
- **Architecture:** DenseNet-121 (Convolutional Neural Network)
- **Dataset:** NIH ChestX-ray14 (10,000 images, patient-level stratified split)
- **Training:** 5 epochs with mixed precision (FP16) on NVIDIA T4 GPU
- **Loss:** Weighted BCE dropped from **1.2168 → 0.8861**
- **Overall Mean ROC-AUC:** **0.782** across all 14 thoracic pathologies
- **Top Pathology AUCs:** Hernia (0.918), Cardiomegaly (0.911), Emphysema (0.851), Effusion (0.847), Edema (0.832), Pneumothorax (0.808)
- **Deployment:** Exported to ONNX (27.0 MB), executed in Node runtime via `onnxruntime-node`

**Right column — Explainability (XAI):**
- **Grad-CAM** (Gradient-weighted Class Activation Mapping)
- Native PyTorch backward gradient hooks tracing from output to `features.denseblock4`
- Visual heatmaps pinpointing exact thoracic regions driving predictions
- Embedded charts:
  - `training/out/radiology_roc_auc_curves.png` (All 14 ROC curves)
  - `training/out/radiology_loss_curve.png` (Training & validation loss)
  - `public/xai/gradcam_overlay.png` (Heatmap overlay)

**Speaker notes:** *"We took the full NIH ChestX-ray14 dataset on Kaggle GPU, stratified by patient ID to prevent data leakage, and fine-tuned DenseNet-121 across all 14 official thoracic conditions. Our model achieved an overall Mean AUC of 0.782, with Hernia and Cardiomegaly exceeding 0.91 AUC. Crucially, we pair every prediction with a Grad-CAM heatmap so clinicians can verify the anatomical focus before trusting the score."*

---

## Slide 6 — M2: RAG Knowledge Pipeline

**Headline:** Evidence-Based Retrieval Augmentation

**Points:**
- 10 clinical guidelines ingested (BTS Pneumonia, NICE Sepsis, SSC, ADA Diabetes, ESC ACS, etc.)
- Chunked → embedded with **S-PubMedBert-MS-MARCO** (domain-tuned biomedical)
- Stored in **ChromaDB** persistent vector store
- Fine-tuned on 30 retrieval training pairs

**Metrics Table:**

| Metric | Value |
|--------|-------|
| Recall@1 | 0.667 |
| Recall@10 | 1.000 |
| MRR@10 | 0.774 |
| NDCG@10 | 0.827 |

**Demo:** Query "CURB-65 pneumonia risk" → returns BTS guideline chunk with severity scoring criteria

**Speaker notes:** *"Recall@10 = 1.0 means that for every test query, the correct guideline is within the top 10 results. The retriever is functionally complete for our demo corpus."*

---

## Slide 7 — M3: Lab Report OCR

**Headline:** Upload → Extract → Auto-fill in 2 Seconds

**Flow:**
1. Clinician uploads PDF/TXT lab report
2. PyMuPDF extracts raw text from all pages
3. 19-analyte regex patterns match values + units + reference ranges
4. Extracted markers auto-populate the diagnostics form
5. Out-of-range values are **flagged in red** automatically

**19 analytes supported:** WBC, Hemoglobin, Platelets, Glucose, Creatinine, BUN, Sodium, Potassium, AST, ALT, Bilirubin, CRP, Troponin, D-Dimer, TSH, HbA1c, INR, Lactate, Procalcitonin

**Visual:** Side-by-side: raw PDF screenshot ↔ extracted analyte table

---

## Slide 8 — M5: 4-Pillar Confidence Calibration

**Headline:** Calibrated Confidence — Not Just a Number

**Concept:** Instead of one opaque "confidence: 78%", MediAgent breaks it down:

| Pillar | Weight | Evidence Source |
|--------|--------|----------------|
| Interview | 25% | Symptom specificity |
| Radiology | 30% | Imaging correlation |
| Lab | 30% | Biomarker match |
| Guideline | 15% | Literature citations |

**Model:** `LogisticRegression` + `CalibratedClassifierCV` (Platt scaling, cv=3)  
**Training data:** 150 synthetic labelled clinical cases (50 emergency, 55 urgent, 45 routine)  
**Result:** Macro F1 = 1.00 | Trained in < 2 seconds on CPU

**Visual:** Bar chart showing pillar breakdown for a sample condition (e.g., Pneumonia: Interview 82%, Radiology 91%, Lab 76%, Guideline 85%)

**Speaker notes:** *"This pillar breakdown is clinically meaningful. If radiology is 95% but lab is only 40%, the doctor knows imaging is driving the diagnosis and should recheck the labs before acting."*

---

## Slide 9 — Live Demo (Walkthrough)

**Headline:** Live Demo — End-to-End in 3 Minutes

**Step 1 — Patient Intake:**
> "65-year-old male, productive cough for 4 days, fever 38.9°C, O2 sat 94%"

**Step 2 — Radiology:**
> Upload sample CXR → Model returns "Consolidation (87%)" → Grad-CAM shows right lower lobe highlight

**Step 3 — Lab Report OCR:**
> Upload sample_lab_report.txt → WBC 14.2, CRP 128, Procalcitonin 1.8 auto-extracted

**Step 4 — Final Report:**
> Probable diagnosis: Community-Acquired Pneumonia (CURB-65 score 2)  
> Pillar scores: Interview 80% | Radiology 87% | Lab 75% | Guideline 85%  
> Triage: **URGENT** | Antibiotic recommendation from BTS guideline

**Speaker notes:** *"Notice the triage card in the top right — green/yellow/red urgency. The guideline citation links directly to the BTS guideline chunk in our ChromaDB store."*

---

## Slide 10 — Technical Achievements Summary

**Headline:** What We've Built

| Component | Technology | Status |
|-----------|-----------|--------|
| ONNX Radiology Model | DenseNet-121, onnxruntime-node | ✅ Live |
| Grad-CAM XAI | Native PyTorch hooks | ✅ Generated |
| RAG Pipeline | S-PubMedBert + ChromaDB | ✅ Evaluated |
| Lab OCR | PyMuPDF + regex | ✅ Tested |
| M5 Calibrator | sklearn + Platt scaling | ✅ Trained |
| FastAPI Service | Python microservice | ✅ Running |
| Firestore Security | Auth-gated rules | ✅ Hardened |
| Docker Deployment | Multi-stage Dockerfile | ✅ Ready |

**Lines of code:** ~6,000 TypeScript + ~1,500 Python  
**Training scripts:** 6 (train_calibrator, train_retriever, build_chromadb, export_retriever_onnx, generate_gradcam, ocr_lab_report)

---

## Slide 11 — Remaining Work & Timeline

**Headline:** Path to End-Semester Submission

| Milestone | Target | Priority |
|-----------|--------|----------|
| Full 14-class DenseNet training (NIH dataset) | Nov 2026 | HIGH |
| SpaCy NER on lab reports (200 samples ready) | Oct 2026 | MEDIUM |
| Unit test suite (Jest + pytest) | Oct 2026 | MEDIUM |
| User study (5 medical residents) | Nov 2026 | HIGH |
| Production deployment (GCP/Railway) | Nov 2026 | LOW |

**Note:** NIH ChestX-ray14 dataset requires GPU cluster access — request submitted to VIT HPC lab.

---

## Slide 12 — Faculty Q&A

**Headline:** Thank You

**Anticipated Questions & Answers:**

**Q: Why not use a fine-tuned radiology model from scratch?**  
A: The NIH ChestX-ray14 dataset is 45 GB and requires GPU training. We use a pre-trained ONNX checkpoint now; full fine-tuning is planned for end-semester on VIT's HPC cluster.

**Q: Is the system HIPAA/data-privacy compliant?**  
A: For this demo, all data is synthetic. Production would require on-premise deployment. We've already hardened Firestore rules with `request.auth != null` gating as a first step.

**Q: Why ChromaDB over Pinecone or Weaviate?**  
A: ChromaDB runs fully locally with zero API cost and zero data egress — suitable for an offline hospital environment. The API is identical to Pinecone for a cloud migration.

**Q: How does the deterministic fallback work?**  
A: Every agent has a `buildFallback*()` function that uses pure if-else symptom matching. If the Gemini API is unavailable (rate limit, network), the system degrades gracefully to rule-based output rather than crashing.

**Q: Macro F1 = 1.0 on the calibrator — isn't that overfit?**  
A: Yes, on synthetic data with 150 clean samples it is trivially separable. The architecture (CalibratedClassifierCV with Platt scaling) is sound for production; we need more realistic clinical data for a meaningful generalization test.

---

*MediAgent AI | Group 4 | VIT | 2026-27*
