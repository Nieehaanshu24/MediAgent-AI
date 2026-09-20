# MediAgent AI — Codebase vs. Synopsis Analysis (edi.pdf)

**Audit date:** 2026-09-20
**Reference document:** `edi.pdf` — Project Registration & Progress Review, FF No. 180, Group 4, AY 2026-27, Sem 05, VIT (AIDS)
**Codebase audited:** `C:\Users\nieeh\Downloads\mediagent-ai` (working tree as of audit date)
**Method:** Full read of `server/`, `python_service/`, `training/`, `src/`, infra configs, and training evaluation outputs; comparison against every objective and technology named in the synopsis.

> ⚠ **Note on an existing doc.** `docs/CODEBASE_VS_SYNOPSIS_AND_TRAINING_ROADMAP.md` contains an older audit whose claims are now stale — it asserts "no Python", "no training code", "no Dockerfile", "open Firestore rules", "no OCR", and "5-class radiology model". **The current codebase has moved well past that audit.** This report supersedes it.

---

## 1. Executive Summary

**One-line status:** The synopsis's promises are now *mostly built*, including a real training layer — but several headline deliverables exist only as **pipelines and artefacts, not yet wired into the running app**, and two of the four trained models report **evaluation numbers too weak to present as finished work**.

### Conformance at a glance

| Synopsis promise | Status | One-line evidence |
|---|---|---|
| Multi-agent system (Interview / Radiology / Lab / Doctor agents) | **DONE** | 5 agents in `server/agents/`, run concurrently with live SSE streaming in `server/api.ts` |
| RAG over verified medical guidelines | **PARTIAL (two generations coexist)** | Production path uses Gemini embeddings over 10 hardcoded guidelines; a full ChromaDB + fine-tuned retriever pipeline exists in `training/` but is **not wired into the Express runtime** |
| Separate agents for interview, radiology, lab, diagnosis | **DONE** | `interviewer.ts`, `radiologist.ts`, `labAnalyst.ts`, `doctor.ts`, plus `adaptiveInterviewer.ts` |
| Explainable reports + confidence scores | **DONE (partially calibrated)** | `EvidenceCitation` chain end-to-end; deterministic 4-pillar `ConfidencePillarScore` now populated in `doctor.ts` |
| Reduce hallucination via grounding | **PARTIAL** | Real guideline retrieval grounds the Doctor agent, but citations are not programmatically verified against retrieved text |
| Interactive web app (upload symptoms, labs, images) | **DONE** | React 19 + Vite + Tailwind, 13 components, Firestore case persistence |
| Preliminary triage recommendations | **DONE** | `urgencyLevel` (routine/urgent/emergency) + rationale + next steps |
| Python | **DONE** | `python_service/` (FastAPI) + `training/` (16 scripts) |
| FastAPI | **DONE** | `python_service/app.py` — RAG search, OCR, calibrator inference |
| React / HTML5 / CSS3 / Tailwind | **DONE** | React 19, Tailwind v4 |
| LLM (GPT/Llama/Gemini) | **DONE (cloud-only)** | Gemini via `@google/genai`; no local model |
| CrewAI / AutoGen | **DEVIATION (justifiable)** | Hand-rolled `Promise.all` orchestration — real parallelism + per-agent latency telemetry; defensible, but must be explained at review |
| LangChain | **NOT USED** | No dependency (fine — not needed) |
| Sentence Transformers | **DONE (training-side)** | Fine-tuned `mediagent-retriever` exported to `training/exports/` — but **not used at runtime** |
| Hugging Face Transformers | **DONE** | Used in training pipeline; radiology ONNX hosted on HF |
| ChromaDB / FAISS | **DONE (offline)** | `training/data/chroma_db/` built + served by FastAPI; **Express runtime still uses an in-memory `Map`** |
| OpenCV / PyTorch / CheXpert model | **PARTIAL** | PyTorch used in training; DenseNet-121 on **NIH ChestX-ray14 (not CheXpert)**, 14 labels; OpenCV not used (sharp instead) |
| Tesseract / PaddleOCR + PyMuPDF | **PARTIAL** | PyMuPDF OCR works (`training/ocr_lab_report.py` + FastAPI + Express subprocess); Tesseract/PaddleOCR not used |
| MongoDB / PostgreSQL | **DEVIATION** | Firebase Firestore instead |
| Docker | **DONE** | Multi-stage `Dockerfile` + `docker-compose.yml` |
| GitHub | **DONE** | Sane `.gitignore` |

---

## 2. What Is Genuinely Complete and Strong

These are real, verifiable strengths — say them at your review.

1. **Real multi-agent orchestration with concurrency and telemetry.** `server/api.ts` runs Interviewer, Radiologist and Lab Analyst in parallel via `Promise.all`, streams per-agent status/timing over Server-Sent Events (`POST /api/triage/stream`), and records `agentExecutionTimes` per case. More sophisticated than a CrewAI tutorial.
2. **Every agent has a substantive deterministic fallback.** When Gemini is unavailable, the system degrades to rule-based clinical reasoning (e.g. `buildFallbackDoctorSynthesis()` is a ~350-line reasoner handling data-completeness levels). This is a genuine safety feature, not a weakness — present it as one.
3. **Deterministic 4-pillar confidence scoring is now implemented.** `server/agents/confidencePillars.ts` computes `interview 25 / radiology 30 / lab 30 / guideline 15` with blunt, falsifiable support rules, clamps the LLM's `probabilityScore` to the evidence ceiling, and renders in `FinalReportView.tsx` as a segmented gauge. This directly fixes the previously-attackable "confidence is an LLM guess" problem.
4. **The lab-reference engine is the right architecture.** `src/utils/labReference.ts` (25 analytes, aliases, critical thresholds, custom-range parsing) keeps numeric range-checking deterministic — an LLM is never the authority on whether K⁺ 6.2 is critical.
5. **A real training layer now exists.** `training/` has 16 Python scripts and an importable `mediagent_training` package covering M1 (radiology), M2 (retriever), M3 (lab NER) and M5 (calibrator), with explicit dataset-split discipline, ONNX contract verification, and per-class metrics. This alone converts the biggest historical gap ("no training code") into infrastructure.
6. **The radiology model is now a 14-label NIH model, trained in-repo.** `radiologyModel.ts` serves a 14-class DenseNet-121 (labels = the official NIH ChestX-ray14 set) and auto-detects 5- vs 14-output graphs. `train_radiology.py` → `calibrate_thresholds.py` → `export_radiology_onnx.py` → `evaluate_radiology.py` is a complete, self-verifying loop.
7. **Deployment and security housekeeping are fixed.** Multi-stage `Dockerfile`, `docker-compose.yml` (app + FastAPI), hardened `firestore.rules` (auth-gated cases, admin-only guideline writes, deny-all catch-all), and a thorough `.gitignore` covering weights, datasets and training outputs.
8. **Label-agnostic agent pipeline.** `radiologist.ts` and `doctor.ts` iterate over `modelInference.classes` generically — upgrading the model is a small diff, exactly as designed.

---

## 3. Gap Analysis — Ranked by Priority

### 🔴 P0 — Demonstrable weaknesses a sharp examiner will find

**G1. The runtime RAG is still the old 10-string Gemini path.**
`server/rag/guidelines.ts` embeds 10 hardcoded guidelines via `gemini-embedding-001` into a module-level `Map`, recomputed on every cold start and lost on restart. Meanwhile `training/` has built a **real** ChromaDB store (`training/data/chroma_db/`), corpus chunks + embeddings (`training/data/corpus/`), and a fine-tuned `mediagent-retriever` — but **the Express pipeline never calls it**. Only the optional FastAPI sidecar (`python_service/app.py`, `/rag/search`) serves ChromaDB. Result: in the main app, "RAG" still means 10 documents. **The synopsis's central promise is implemented but not connected.**

**G2. The fine-tuned retriever shows zero measurable lift.**
`training/out/retriever_ablation.json` and the round-2 eval CSV report **identical** metrics for baseline off-the-shelf, round-1 (in-batch negatives) and round-2 (hard negatives): Recall@1 0.667, Recall@5 0.833, nDCG@10 0.827, MRR@10 0.774. Either the eval set is too small/trivially easy, or hard-negative mining did nothing. As reported, the ablation table argues *against* the training effort. Fix the evaluation (larger gold set, genuinely confusable negatives) before presenting.

**G3. The M3 lab-entity extractor is far below usable quality.**
`training/out/lab_ner_evaluation.json`: overall **F1 = 0.273**, with `REF_RANGE` F1 = 0.161 and `FLAG` F1 = 0.198. This model cannot be shown as "working OCR extraction". The regex/PyMuPDF path (`ocr_lab_report.py` + `ocrService.ts`) is the usable path today; the trained NER is a liability if demoed. Either iterate on the NER (more real annotated data, better base, class imbalance handling) or scope the demo to the deterministic parser and describe the NER as in-progress research.

**G4. The confidence calibrator discriminates barely better than chance.**
`training/out/calibration_m5_metrics.json`: calibrated **ROC-AUC = 0.551** (logistic reference 0.605) on 1,200 synthetic cases. Calibration metrics look fine (ECE 0.012, Brier 0.154, beating the constant-0.55 heuristic) — but an AUC of 0.55 means the model cannot actually tell a correct top-1 diagnosis from an incorrect one. This is expected on purely synthetic labels and **must be disclosed as synthetic**; it is not yet evidence of a calibrated clinical score.

**G5. Demo radiographs are still SVG cartoons.**
`src/data/clinicalScenarios.ts` builds `createChestXrayDataUrl()` — hand-drawn SVG rib cages for all four sample cases. These are rasterised by `sharp` and scored by the real DenseNet-121, so **the four flagship demo cases produce meaningless model probabilities**. Any reviewer who uploads a real chest X-ray next to a sample case will see inconsistent behaviour. Ship licence-cleared real NIH images (public domain) in the demo set.

### 🟠 P1 — Synopsis promises only partially met

**G6. Grad-CAM XAI is offline-only and pre-baked.**
`training/gradcam.py` / `generate_gradcam_overlay.py` exist and produce overlays, but only **two static images** are shipped (`public/xai/gradcam_overlay.png`, `gradcam_composite.png`). The live pipeline does **not** generate a heatmap for an uploaded scan; `RadiologistAnalysis` has no `heatmapDataUrl` populated at runtime, and the FastAPI `/xai/gradcam` endpoint advertised in `app.py`'s docstring **does not exist** (the file only implements `/rag/search`, `/ocr/extract-lab`, `/calibrator/predict`). The synopsis promises XAI for medical image analysis — today it is a static gallery, not per-case explainability.

**G7. Two retrieval stacks coexist without a decision.**
Gemini-embedding `Map` (Express) vs. ChromaDB + S-PubMedBert (FastAPI/training). The `training/README.md` itself flags this: "Decide one query-encoding path and document it." Until the Express runtime consumes the built corpus (or the FastAPI sidecar is made a hard dependency of the triage pipeline), the architecture is ambiguous.

**G8. `docker-compose.yml` depends on gitignored artefacts.**
The `python_service` volume-mounts `./training/exports` and `./training/data/chroma_db` (read-only) — all excluded by `.gitignore`. A fresh clone + `docker compose up` yields a FastAPI container with no calibrator and no vector store. Reproducibility requires either committing small artefacts, a bootstrap download script, or documented manual steps.

**G9. No tests.**
There is not one automated test in the repo. `evaluateLabMarker()` (25 analytes of clinical logic), `cosineSimilarity()`, the pillar arithmetic in `confidencePillars.ts`, and the confidence capping in `doctor.ts` all carry clinical weight and have zero regression protection.

### 🟡 P2 — Architectural / housekeeping

**G10. No local/open LLM path.** 100% Gemini dependency: no offline mode, no cost control, PHI leaves the host. The training README is admirably honest that a QLoRA 7–8B model won't beat Gemini — but guided/structured decoding (guaranteed schema-valid JSON) is cheap and would remove an entire failure class.

**G11. Citation faithfulness is unverified.** The Doctor agent quotes guideline passages, but nothing checks the quoted text actually appears in the retrieved set. A fabricated-citation rate measured and reported would be the strongest anti-hallucination evidence you can show.

**G12. Minor doc drift.** `README.md` still says "19 analytes" for OCR while the reference engine handles 25, and lists FastAPI endpoints (`/xai/gradcam`) that aren't implemented. `python_service/app.py`'s module docstring advertises `/xai/gradcam` that doesn't exist.

---

## 4. Objective-by-Objective Verdict (from the synopsis "Objectives")

| # | Objective | Verdict |
|---|---|---|
| 1 | Multi-agent collaborative analysis | **Met** — 5 agents, parallel, streamed |
| 2 | RAG to retrieve verified guidelines | **Partially met** — pipeline built, runtime still on 10-doc Gemini path |
| 3 | Separate agents for interview/radiology/lab/diagnosis | **Met** |
| 4 | Explainable reports + confidence scores | **Met** — evidence citations + deterministic 4-pillar confidence |
| 5 | Reduce hallucination by grounding | **Partially met** — grounding exists; citation verification absent |
| 6 | Interactive web app for symptoms/labs/images upload | **Met** |
| 7 | Preliminary triage recommendations | **Met** — 3-level urgency + rationale + next steps |

---

## 5. Recommended Actions (ordered, independently valuable)

1. **Wire the real retriever into the runtime.** Point `searchClinicalGuidelines()` at the built corpus (ChromaDB via the FastAPI sidecar, or serve `embeddings.f16.bin` + chunks directly in Node via `onnxruntime-node`, which you already depend on). Keep the function signature so all three call sites in `api.ts` work unchanged. *(Closes G1, G7.)*
2. **Replace SVG demo images with real NIH chest X-rays** in `clinicalScenarios.ts`. *(Closes G5; half a day.)*
3. **Fix the M2 evaluation** — larger gold query set, genuinely confusable hard negatives — so the ablation table shows real lift. *(G2.)*
4. **Decide M3's story:** either invest in real annotated lab reports to lift NER F1, or demo the deterministic PyMuPDF/regex extractor and label the NER as ongoing. Do not demo the 0.27-F1 model as finished. *(G3.)*
5. **Disclose the calibrator's synthetic basis** and, if possible, retrain M5 on real labelled outcomes (MIMIC-IV-ED ESI). A 0.55-AUC calibrator is a placeholder, not a result. *(G4.)*
6. **Make Grad-CAM live or be honest about it:** either add a real per-case heatmap (a small FastAPI endpoint is the clean path — and implement the `/xai/gradcam` that `app.py` already advertises), or present the two overlays as illustrative only. *(G6.)*
7. **Add a minimal test suite** (Vitest) over `evaluateLabMarker`, `cosineSimilarity`, pillar arithmetic, and confidence capping. *(G9.)*
8. **Fix deployment reproducibility:** commit the small calibrator/urgency artefacts or add a bootstrap download for the vector store so `docker compose up` works from a clean clone. *(G8.)*
9. **Add guided/structured JSON decoding** for every generative call (works with Gemini today via `responseSchema`). *(G10.)*
10. **Measure and report the fabricated-citation rate.** *(G11.)*

---

## 6. One-Paragraph Summary

Against the synopsis in `edi.pdf`, MediAgent AI has moved from "a serving layer with no training" to **a substantially complete system**: five collaborating agents with live streaming, a deterministic 4-pillar confidence engine, an in-repo training pipeline that produced a 14-label NIH radiology model, a fine-tuned medical retriever with a built ChromaDB store, PyMuPDF OCR, hardened Firestore rules, and Docker deployment. The remaining work is **integration and honesty of evidence**, not greenfield construction: the built retriever and vector store are not yet what the running app queries, the demo cases still feed SVG cartoons to a real neural network, the retriever's ablation shows no lift, the lab-NER extractor (F1 0.27) and the synthetic confidence calibrator (AUC 0.55) are not yet results you can defend, and Grad-CAM explainability is a static gallery rather than a per-case output. Closing those gaps — chiefly wiring the trained retriever into the runtime, shipping real demo images, and tightening the evaluations — converts this from "impressive prototype" into a project that fully and demonstrably delivers the synopsis's promises.
