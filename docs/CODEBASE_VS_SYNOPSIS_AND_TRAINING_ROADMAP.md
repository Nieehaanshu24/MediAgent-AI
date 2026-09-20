# MediAgent AI — Codebase Audit vs. Synopsis (FF No. 180) & Model-Training Roadmap

**Document type:** Gap analysis + training plan
**Reference document:** `edi.pdf` — *Project Registration & Progress Review*, FF No. 180, Group 4, AY 2026-27, Sem 05
**Codebase audited:** `mediagent-ai` (commit state as of 2026-09-20)
**Audit method:** Full source read of `server/`, `src/`, config files; `npx tsc --noEmit` executed; dependency tree verified from `package.json`.

---

## 1. Executive Summary — Where You Actually Are

**One-line status:** You have a **working, type-clean, genuinely impressive multi-agent triage application with one real trained deep-learning model in production**. What you do **not** have is a single line of training code — every model in the system was either (a) bought from Google as an API, or (b) trained somewhere else entirely and shipped as a binary.

### The honest picture

| Dimension | Status |
|---|---|
| Multi-agent orchestration | **DONE & BETTER THAN SPEC** — 5 specialist agents, parallel execution, live SSE streaming with per-agent timings |
| Retrieval-Augmented Generation | **WORKING BUT SHALLOW** — real embedding + cosine search, but over only **10 hardcoded guidelines** in an in-memory `Map` |
| Radiology AI | **REAL TRAINED MODEL, EXTERNALLY BUILT** — DenseNet-121 ONNX, downloaded from Hugging Face at runtime. Training code absent from repo |
| Laboratory analysis | **DONE WELL** — 25-analyte deterministic reference engine. Genuinely better than an LLM for this job |
| Explainability (XAI) | **STRONG ON PAPER, PARTIAL IN CODE** — evidence citations work; Grad-CAM absent; `confidencePillars` declared but never populated |
| OCR / document processing | **NOT STARTED** — zero OCR code. Lab reports must be typed or pasted as text |
| Local / trainable LLM | **NOT STARTED** — 100% dependent on the Gemini cloud API |
| Vector database | **NOT STARTED** — in-memory `Map`, no persistence, no ChromaDB/FAISS |
| Confidence calibration | **NOT STARTED** — `probabilityScore` is an LLM guess, not a calibrated probability |
| Training / MLOps infrastructure | **COMPLETELY ABSENT** — no Python, no notebooks, no datasets, no `requirements.txt`, no Dockerfile, no CI |
| Build health | **GREEN** — `npx tsc --noEmit` passes clean |

### The single most important finding

`server/models/radiologyModel.ts` line 8 downloads `mediagent_radiology_densenet121.onnx` from `huggingface.co/nieehaanshu/mediagent-radiology-densenet121`. The model metadata in that same file admits:

> *"Trained on a ~5,600-image sample of NIH ChestX-ray14 with a validation mean AUC of 0.834 — solid for a coursework prototype, but explicitly not clinical-grade, and weaker on classes with few training examples (Edema and Cardiomegaly had under 150 positive examples each in this training run)."*

**This is your only trained model, it is under-trained, and the code that produced it is not in this repository.** That is the gap the trainers on your team have to close. The good news: the *serving* infrastructure is already excellent, which means a better model drops in with a one-line URL change.

---

## 2. Synopsis Conformance Matrix

Every technology named in the `edi.pdf` "Technology Used" section, checked against the actual repository.

### 2.1 Programming Languages

| Spec | Status | Evidence |
|---|---|---|
| Python | **MISSING** | No `.py` files anywhere in the repository |
| JavaScript / TypeScript | **DONE** | TypeScript throughout; `tsconfig.json` target ES2022, strict-ish (`noEmit`) |

### 2.2 Frontend

| Spec | Status | Evidence |
|---|---|---|
| React.js | **DONE** | React 19.0.1, `src/App.tsx` + 13 components |
| HTML5 | **DONE** | `index.html` |
| CSS3 | **DONE** | `src/index.css` |
| Tailwind CSS | **DONE** | Tailwind v4.1.14 via `@tailwindcss/vite` plugin |

### 2.3 Backend

| Spec | Status | Evidence |
|---|---|---|
| FastAPI | **MISSING** | Express 4.21.2 used instead |
| Flask (optional) | **MISSING** | Not used |
| — | *Substitute* | Express, mounted **twice**: standalone in `server.ts` (port 3000) and as Vite dev middleware in `vite.config.ts`. Works correctly in both dev and prod |

### 2.4 Artificial Intelligence & Machine Learning

| Spec | Status | Evidence / Notes |
|---|---|---|
| LLMs (GPT/Llama/Gemini) | **DONE (cloud only)** | Gemini via `@google/genai` 2.4.0. Candidate chain in `server/utils/aiHelper.ts`: `gemini-3.6-flash` → `gemini-3.8-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` |
| CrewAI **or** AutoGen | **NOT USED** | Orchestration is hand-rolled in `server/api.ts` (`Promise.all` over three agents). *Arguably superior to CrewAI for this use case — real parallel execution, real per-agent latency telemetry, no framework lock-in. Recommend you justify this in your review rather than switching* |
| Retrieval-Augmented Generation | **PARTIAL** | Real embedding + cosine similarity, but corpus is 10 hardcoded strings in `server/rag/guidelines.ts` |
| LangChain | **NOT USED** | No dependency. Fine — you don't need it |
| Sentence Transformers | **NOT USED** | Substituted with Gemini `gemini-embedding-001` API |
| Hugging Face Transformers | **NOT USED (in repo)** | Only used implicitly: the ONNX artifact is *hosted* on HF, not produced by repo code |

### 2.5 Vector Database

| Spec | Status | Evidence |
|---|---|---|
| ChromaDB / FAISS | **MISSING** | `server/rag/guidelines.ts` uses a module-level `const embeddingsCache = new Map<string, number[]>()`. **Embeddings are recomputed on every cold start, lost on every restart, and never persisted** |

### 2.6 Medical Image Processing

| Spec | Status | Evidence |
|---|---|---|
| OpenCV | **MISSING** | Substituted with `sharp` 0.35.4 for resize/normalize — correct choice for Node.js |
| PyTorch / TensorFlow | **MISSING (in repo)** | Model was trained elsewhere; repo only *runs* the exported ONNX via `onnxruntime-node` 1.29.0 |
| Chest X-ray Classification (CheXpert) | **PARTIAL** | DenseNet-121, but trained on a 5,600-image NIH ChestX-ray14 **subset**, not CheXpert. Only **5** of 14 labels |

### 2.7 OCR & Document Processing

| Spec | Status | Evidence |
|---|---|---|
| Tesseract OCR / PaddleOCR | **NOT STARTED** | Zero OCR code. **This is a headline deliverable in your synopsis with no implementation at all** |
| PyMuPDF | **NOT STARTED** | No PDF parsing |

### 2.8 Database

| Spec | Status | Evidence |
|---|---|---|
| MongoDB / PostgreSQL | **MISSING** | Substituted with Firebase Firestore (`server/services/firestore.ts`), with an in-memory `Map` fallback |
| — | *⚠ Critical risk* | `firestore.rules` is `allow read, write: if true;` on `/cases/{caseId}` **and** a catch-all `/{document=**}`. Every patient case is world-readable and world-writable. Unacceptable for a medical system and a guaranteed question at your review |

### 2.9 Deployment

| Spec | Status | Evidence |
|---|---|---|
| Docker | **MISSING** | No `Dockerfile`, no `docker-compose.yml` |
| GitHub | **ASSUMED OK** | `.gitignore` present and sane, but see §3.4 (missing ignore rules) |

---

## 3. What Actually Exists — Code Inventory

### 3.1 Backend — `server/`

**`server/api.ts`** (the orchestrator; ~13 endpoints)

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Reports Gemini key presence + `MODEL_METADATA` |
| `POST /api/radiology/predict` | Standalone ONNX inference — **useful for your training evaluation harness** |
| `GET /api/guidelines` | Lists the 10 guidelines |
| `POST /api/rag/search` | Live vector similarity search |
| `GET/POST/DELETE /api/cases[/:id]` | Firestore CRUD |
| `POST /api/interviewer/followup` | Adaptive follow-up question generation |
| `POST /api/agents/{interviewer,radiologist,lab-analyst}` | **Individual agent test endpoints — invaluable for per-agent evaluation** |
| `POST /api/triage/stream` | **Full pipeline via Server-Sent Events** with live per-agent status, timing, and result streaming |
| `POST /api/triage/run` | Non-streaming fallback, returns the complete `ClinicalCase` |

**`server/agents/`** — five agents, each with a Gemini path **and** a deterministic rule-based fallback:

| File | Agent | Fallback quality |
|---|---|---|
| `interviewer.ts` | Synthesises history + classifies all 5 vitals against adult norms | **Strong** — full rule-based vital classification |
| `adaptiveInterviewer.ts` | 1–2 tailored follow-up questions + inline "Triage Logic:" reasoning | **Strong** — 6 chief-complaint-specific question banks (chest, dyspnoea, abdominal, neuro, fever, generic) |
| `radiologist.ts` | Structured regional findings `{id, region, observation, severity}`, grounded on ONNX output | **Strong** — branches on ONNX flags + clinical context |
| `labAnalyst.ts` | Marker flagging, derived indices (Shock Index, Anion Gap, BUN/Cr), organ-system flagging | **Strong** — `evaluateLabMarker()` reconciles LLM output against deterministic ranges |
| `doctor.ts` | Chief synthesiser. Handles `symptoms_only` / `partial` / `complete` data-completeness with **confidence caps** (35–55% / ≤70% / 75–95%) | **Very strong** — ~350-line deterministic synthesiser |

> **Note for your review:** the fallback paths are not a weakness — they are your **safety net against API quota exhaustion**, and they demonstrably produce clinically-structured output. Present them as a feature.

**`server/rag/guidelines.ts`** — 10 real, well-chosen guidelines: BTS CURB-65, NICE NG185 (ACS), SSC 2021 Sepsis-3, NICE NG158 (PE/Wells), ADA DKA, ACR appendicitis, Berlin ARDS, GOLD 2023 COPD, ESC heart failure, AHA/ASA stroke. Each carries `id`, `title`, `source`, `category`, `snippet`.
Retrieval: embed query → cosine vs. cached embeddings → sort → top-K. Keyword fallback on failure.

**`server/models/radiologyModel.ts`** — the one real ML artifact. Details in §4.1.

**`server/services/firestore.ts`** — Firestore client SDK + in-memory `Map`, merged on read.

**`server/utils/aiHelper.ts`** — retry + model-fallback wrapper. Strips markdown fences, forces `responseMimeType: 'application/json'`, temperature 0.2. **Correctly detects 429/503/404 and advances the model chain.**

### 3.2 Frontend — `src/`

13 components: `AuthScreen`, `PatientIntakeForm`, `AdaptiveInterviewSection`, `DiagnosticsForm`, `AgentProcessingView`, `FinalReportView`, `ClinicalHandoffNote`, `CaseHistoryDrawer`, `SampleCaseLoaderModal`, `QuickStartPanel`, `StepIndicator`, `Header`.

Fully typed domain model in `src/types/clinical.ts` (~230 lines) covering `InterviewerAnalysis`, `RadiologistAnalysis`, `LabAnalystAnalysis`, `DoctorSynthesis`, `EvidenceCitation`, `MissingDataSource`, `ConfidencePillarScore`, `ClinicalCase`, and live-pipeline progress state.

`src/utils/labReference.ts` — 25 analytes with aliases, ranges, critical thresholds, and generated interpretations. Also handles custom range strings (`< 5.0`, `> 50`, `4.5 - 11.0`). **Genuinely high-quality, and the right architectural decision — deterministic beats generative for reference-range checking.**

`src/data/clinicalScenarios.ts` — 4 demo cases (pneumonia+sepsis, NSTEMI, appendicitis, COPD) with **inline SVG "radiographs"**.

### 3.3 Build & Tooling

- Type check: **`npx tsc --noEmit` → clean, zero errors.**
- `npm run dev` → Vite on port 3000, API mounted as middleware.
- `npm start` → `node server.ts` (production).
- Package manager ambiguity: **both `bun.lock` and `package.json` present**, no `package-lock.json`, and `node_modules` was absent on first inspection. Pick one and commit its lockfile.

### 3.4 Housekeeping Debt (cheap to fix, improves review optics)

| Issue | Detail |
|---|---|
| Throwaway scripts at repo root | `fix_agent_view.cjs`, `fix_diagnostics.cjs`, `fix_intake.cjs`, `fix_report.cjs`, `fix_step_indicator.cjs`, `fix_urgency.cjs`, `rewrite_styles.cjs` — 7 one-shot repair scripts. **Delete them** |
| `README.md` | Still the default AI Studio boilerplate ("Run and deploy your AI Studio app"). **Rewrite it** |
| `.gitignore` gap | `.model_cache/` is **not** ignored — the ~28 MB ONNX download will be accidentally committed on the next `git add .` |
| Committed secrets | `firebase-applet-config.json` contains a live `apiKey` in version control |
| Package name | `package.json` → `"name": "react-example"` |

---
## 4. Gap Analysis — Ranked by Priority

### 🔴 P0 — Blocking or High-Risk

**G1. No training pipeline exists at all.**
The ONNX model is a binary fetched from a URL. Nobody on the team can reproduce, retrain, improve, or even inspect it from this repository. For a project whose stated objective is *"Reduce AI hallucinations by grounding responses in trusted medical knowledge"* and which claims a *"Chest X-ray Classification Model"*, having **zero training code** is the largest single gap.

**G2. Firestore security rules allow unauthenticated read/write on all patient data.**
`firestore.rules` grants `allow read, write: if true;` on `/cases/{caseId}` plus a global catch-all. Real patient vignettes are stored there. If this is demoed or deployed as-is, this is both an ethical and an academic-integrity problem.

**G3. No OCR anywhere, despite being a named technology.**
`edi.pdf` lists Tesseract OCR / PaddleOCR and PyMuPDF. `PatientIntakeForm` / `DiagnosticsForm` accept lab markers as structured input or as a pasted `rawReportText` string. A real hospital workflow receives a **photographed or PDF lab report** — there is no path for that today.

### 🟠 P1 — Core Synopsis Promises Not Yet Met

**G4. RAG retrieves from 10 documents.**
"Retrieval-Augmented Generation over a medical knowledge base" currently means a 10-element JavaScript array. Cosine similarity is real, but Recall@k is trivially high because the corpus is tiny. There is no chunking, no ingestion pipeline, no persistence, no citation-to-passage span mapping, and the corpus cannot grow without a code edit.

**G5. Radiology model is 5 classes / ~5,600 images / mean AUC 0.834.**
The six clinically most important ChestX-ray14 labels for triage (**Effusion, Atelectasis, Pneumonia, Nodule, Mass, Infiltrate**) are entirely absent. `Edema` and `Cardiomegaly` each had under 150 positives — statistically meaningless for those two classes. Note also that the class is named `Consolidation`, which is *not* a ChestX-ray14 label (the NIH label is `Infiltration`); this naming needs to be reconciled before any retraining.

**G6. Confidence scores are uncalibrated LLM output.**
`ProbableCondition.probabilityScore` is an integer the LLM writes into JSON. The prompt instructs it to "cap at 35–55%", so the number is a prompted convention, not a measured probability. A system that presents "88% probability" to a clinician without calibration is making a claim it cannot support — this is the most scientifically attackable part of the project.

**G7. `ConfidencePillarScore` is declared in `src/types/clinical.ts` but never populated.**
The type exists (`interview` / `radiology` / `lab` / `guideline` pillars with `maxWeight`, `contributedScore`, `isSupported`, `citationCount`) and `ProbableCondition.confidencePillars` is optional — but neither the LLM prompt in `server/agents/doctor.ts` nor `buildFallbackDoctorSynthesis()` ever sets it. **This is a free win**: a transparent, deterministic, weighted-bar confidence breakdown is both better XAI than an LLM-guessed number and trivial to compute from data you already have.

**G8. No explainability visual for imaging.**
The synopsis promises Explainable AI for *"Medical Image Analysis"*. There is no Grad-CAM, no saliency, no bounding box, no heatmap overlay on the radiograph. The radiologist agent explains in **text** but never shows *where* on the image it looked — the single most persuasive XAI demo you could build.

### 🟡 P2 — Architectural Improvability

**G9. Embeddings are recomputed on every cold start and lost on restart.**
`embeddingsCache` is a module-level `Map`. Costs API calls on every boot; makes reproduction non-deterministic; prevents the corpus from scaling.

**G10. Demo radiographs are inline SVG cartoons, not radiographs.**
`src/data/clinicalScenarios.ts` renders `createChestXrayDataUrl()` — hand-drawn SVG rib cages. These flow into `preprocessRadiograph()`, which calls `sharp()` on an SVG data URL and rasterises it. Sharp *can* rasterise SVG, so inference will "succeed" — but the DenseNet will be scoring a cartoon. **The four sample cases therefore produce meaningless model probabilities**, and any reviewer who uploads a real chest X-ray beside a sample case will see the model behave inconsistently. Ship real, licence-clear images (NIH ChestX-ray14 is public domain / CC0 for the images; verify per-image) in the demo set.

**G11. Gemini model identifiers look speculative.**
`aiHelper.ts` requests `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`. Verify these resolve against the live API for your key, and pin against the officially documented names for your project. The fallback chain masks a failure by silently degrading to rule-based output — which is robust, but means **a broken model ID looks like a working system** during a demo.

**G12. Single point of failure on one cloud vendor.** No offline capability, no cost control, no data-residency story, no ability to demo without internet.

**G13. Missing deployment artefacts.** No Dockerfile, no CI, no tests of any kind. There is not one test file in the repository — so no regression protection on `evaluateLabMarker()` (25 analytes of clinical logic), `cosineSimilarity()`, or the confidence-capping logic in `doctor.ts`.

---
## 5. Model Training Roadmap — What To Actually Train

You need **five** trained models, not one. Below, each is scoped by priority, dataset, recipe, evaluation, and — critically — **the exact integration point into this codebase**.

| # | Model | Priority | Replaces | Effort |
|---|---|---|---|---|
| M1 | Chest X-ray multi-label classifier (DenseNet-121 / ConvNeXt) | **P0** | Existing under-trained ONNX | 2–3 weeks |
| M2 | Medical bi-encoder retriever (Sentence-Transformers) | **P0** | Gemini `gemini-embedding-001` API | 1–2 weeks |
| M3 | Lab-report OCR + lab-entity extractor | **P1** | Nothing (new capability) | 3–4 weeks |
| M4 | Triage LLM (QLoRA on 7–8B) + guided decoding | **P2** | Gemini API (optional) | 2–4 weeks + GPU |
| M5 | Confidence calibrator + urgency cross-check classifier | **P1** | LLM-guessed `probabilityScore` | 1 week |

**Recommended execution order: M1 → M2 → M5 → M3 → M4.**
M1 and M2 are the two the synopsis explicitly promises and are directly demonstrable. M5 is one week of work that fixes the project's most attackable weakness. M3 is a genuinely new capability with high demo value. M4 is the most expensive and the least necessary to finish the degree.

---

## 6. M1 — Chest X-Ray Multi-Label Classifier

### 6.1 What Exists Today (exact facts)

From `server/models/radiologyModel.ts`:

```
MODEL_URL   = https://huggingface.co/nieehaanshu/mediagent-radiology-densenet121/resolve/main/mediagent_radiology_densenet121.onnx
CACHE_PATH  = .model_cache/mediagent_radiology_densenet121.onnx
LABELS      = ['No Finding','Cardiomegaly','Consolidation','Edema','Pneumothorax']   // 5 classes
Data        = NIH ChestX-ray14 (~5,600 images)
Reported    = validation mean AUC 0.834
```

Preprocessing contract the new model **must preserve** (`preprocessRadiograph`):
- input `float32`, shape `[1, 3, 224, 224]`, NCHW planar
- ImageNet normalisation: mean `[0.485, 0.456, 0.406]`, std `[0.229, 0.224, 0.225]`
- resize `224×224` with `fit: 'fill'`, alpha removed
- output tensor preferred name `pathology_probabilities`
- **output is raw logits**; the TS code applies sigmoid itself

> Keeping this contract means M1 drops in by changing one URL. Break it and you must also edit `radiologyModel.ts`. **Export with the same names.**

### 6.2 Target Specification

| Property | Current | Target |
|---|---|---|
| Labels | 5 | **14** (full ChestX-ray14) + optional CheXpert extensions |
| Training images | ~5,600 | **86,524 train / 25,596 test** (official NIH split, from 112,120 total) |
| Split integrity | Unknown — **likely patient leakage** | **Patient-level split** (30,805 unique patients) |
| Backbone | DenseNet-121 | DenseNet-121 (keep) or ConvNeXt-Tiny for accuracy |
| Input resolution | 224 | Train 320 → infer 224, or train at 384 for small nodules |
| Mean AUC target | 0.834 | **≥ 0.83 mean over 14 labels** (published DenseNet-121 baseline is 0.804–0.841) |
| Calibration | None | Platt/isotonic + per-class ECE measured |
| Explainability | None | **Grad-CAM** heatmap overlay |
| Export | Unknown opset | ONNX opset 17, dynamic batch |

**Target label set (NIH ChestX-ray14, official 14):**
`Atelectasis, Cardiomegaly, Effusion, Infiltration, Mass, Nodule, Pneumonia, Pneumothorax, Consolidation, Edema, Emphysema, Fibrosis, Pleural_Thickening, Hernia`

> ⚠ **Naming reconciliation required.** The current code uses `Consolidation` and `No Finding`; NIH uses `Infiltration` and derives "No Finding" as *none of the 14 labels positive*. Decide a canonical label order, then **update `PATHOLOGY_LABELS` and the `PathologyClassResult['label']` union in `src/types/clinical.ts` in the same commit as the model upload.** If you don't, sigmoid scores will be silently mapped to the wrong disease names — a catastrophic and easily-missed bug.

### 6.3 Dataset Preparation

```python
# data/nih_prepare.py  (concept)
# 1. Download NIH ChestX-ray14 images_001..012.tar.gz + Data_Entry_2017.csv + test_list.txt + train_val_list.txt
# 2. Build patient-level split: official train_val_list / test_list already partition by patient — USE THEM.
# 3. Multi-hot encode the 14 labels ('|' separated in the CSV).
# 4. 'No Finding' rows -> all-zero vector. Keep them (they act as negatives for every class).
# 5. Report positive counts per class. NIH is heavily imbalanced:
#      Hernia ~ 227 positives  vs  Infiltration ~ 19,894
#    -> pos_weight in BCEWithLogitsLoss, or focal loss (gamma=2).
```

**Use `torchxrayvision` as the shortcut.** `pip install torchxrayvision` gives Apache-2.0 DenseNet-121 weights already trained on NIH + CheXpert + MIMIC-CXR + PadChest with a documented, standard preprocessing pipeline. Fine-tuning from those weights will beat training from ImageNet weights by a wide margin and saves you weeks. Cite it properly.

**Licence notes for your report:** NIH ChestX-ray14 images are released publicly by the NIH (verify the current terms page); `torchxrayvision` code is Apache-2.0. **CheXpert requires you to agree to the Stanford RUA** and is *not* redistributable — fine to train on, but do not commit images to GitHub.

### 6.4 Training Recipe

```python
# train/train_radiology.py  (concept — put this in the repo)
import torch, torch.nn as nn, torchxrayvision as xrv
from torch.utils.data import DataLoader

LABELS = ["Atelectasis","Cardiomegaly","Effusion","Infiltration","Mass","Nodule",
          "Pneumonia","Pneumothorax","Consolidation","Edema","Emphysema","Fibrosis",
          "Pleural_Thickening","Hernia"]          # 14

model = xrv.models.DenseNet(weights="densenet121-res224-all")   # pretrained, Apache-2.0
model.classifier = nn.Linear(model.classifier.in_features, len(LABELS))  # replace head

criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)   # pos_weight = neg/pos per class
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-5)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
scaler    = torch.amp.GradScaler("cuda")

for epoch in range(EPOCHS):                # 25-40
    for x, y in train_loader:              # batch 64, 320x320 RandomResizedCrop -> 224
        with torch.amp.autocast("cuda"):
            loss = criterion(model(x), y)
        scaler.scale(loss).backward(); scaler.step(optimizer); scaler.update()
        optimizer.zero_grad(set_to_none=True)
    evaluate_per_class_auc(model, val_loader)     # log to TensorBoard / W&B
    scheduler.step()
```

**Augmentation policy:**
- `RandomResizedCrop(224, scale=(0.85, 1.0))` — mild; aggressive crops destroy subtle findings
- `RandomHorizontalFlip(p=0.5)` — **safe for the 14 NIH labels** because none of them encode laterality. Do **not** use it if you add CheXpert's `left`/`right`-specific extensions
- `RandomRotation(±10°)` — mild only; large rotations create anatomically impossible films
- `ColorJitter(brightness=0.1, contrast=0.1)` — simulates exposure variation
- **Do not** use CutMix/MixUp: mixing two chest films creates a hybrid image with a mixed label vector that does not correspond to any real pathology. It reliably hurts medical multi-label performance

**Class-imbalance handling, in order of preference:**
1. `pos_weight = num_negatives / num_positives` per class in `BCEWithLogitsLoss` (simplest, works)
2. Focal loss (`gamma=2, alpha=0.25`) if rare classes still lag
3. **Do not** resample to a balanced set — you will destroy the true prevalence and get badly calibrated probabilities

### 6.5 Evaluation Protocol (this is what earns marks)

Report all of the following, **per class**, not just a mean:

| Metric | Why |
|---|---|
| **Per-class ROC-AUC** | The standard for ChestX-ray14; directly comparable to published baselines |
| **Mean AUC over 14** | Headline number |
| **mAP / PR-AUC** | Correct metric for the rare classes (Hernia, Fibrosis) where ROC-AUC flatters |
| **Sensitivity @ 90% specificity** | Clinically meaningful operating point — a triage tool must not miss findings |
| **ECE + reliability diagram** | Proves your confidence scores are honest |
| **Brier score** | Joint calibration + discrimination |
| **Subgroup AUC (sex, age band)** | Shows you checked for bias — strong review point |
| **Confusion of the 4 original classes vs. retrained** | Direct before/after comparison for your progress review |

**Threshold policy.** The current code hardcodes `flaggedPositive = probability > 0.5`. That is wrong for a triage tool: for `Pneumothorax` you want ~0.90 sensitivity, which means a *low* threshold. **Tune a per-class threshold on a held-out validation set** to hit a target sensitivity, then make the threshold a constant passed to the model rather than a magic `0.5`.

### 6.6 Export to ONNX (must match the TS contract)

```python
torch.onnx.export(
    model.eval(), dummy, "mediagent_radiology_densenet121.onnx",
    input_names=["radiograph_input"],
    output_names=["pathology_probabilities"],      # <- radiologyModel.ts prefers this name
    dynamic_axes={"radiograph_input": {0: "batch"},
                  "pathology_probabilities": {0: "batch"}},
    opset_version=17,
    do_constant_folding=True,
)
```

Then verify — this is the step people skip and regret:

```bash
python -c "import onnxruntime as ort, numpy as np; s=ort.InferenceSession('mediagent_radiology_densenet121.onnx'); print(s.get_inputs()[0].name, s.get_inputs()[0].shape); print(s.get_outputs()[0].name, s.get_outputs()[0].shape)"
```

Confirm: input name `radiograph_input`, shape `[batch,3,224,224]`, output name `pathology_probabilities`, and that **outputs are logits, not probabilities** (if you accidentally export a model with a sigmoid in the graph, the TS code will sigmoid it again and every probability collapses toward 0.5).

### 6.7 Grad-CAM for Explainable AI (G8)

```python
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image

# target layer: model.features.denseblock4 (last conv block)
cam = GradCAM(model=model, target_layers=[model.features.denseblock4], use_cuda=torch.cuda.is_available())
grayscale_cam = cam(input_tensor=x, targets=[ClassifierOutputTarget(label_idx)])[0]
overlay = show_cam_on_image(rgb_img_float, grayscale_cam, use_rgb=True)
```

Two integration options:
1. **Offline**: generate the overlay during training/validation, ship pre-rendered examples in the demo gallery (`src/data/`). Lowest engineering cost, still visually convincing.
2. **Live**: export a gradient-tape ONNX graph — complicated and slow in `onnxruntime-node`. **Not recommended.**

> **Recommended architecture for Grad-CAM in production:** a tiny Python sidecar (`fastapi` + `pytorch-grad-cam`) exposing `POST /heatmap`, called from `server/agents/radiologist.ts`. Add an optional `heatmapDataUrl` field to `RadiologistAnalysis` in `src/types/clinical.ts` and render it in `FinalReportView.tsx` / `AgentProcessingView.tsx`. This is the highest-impact single feature you can add for your review — a clinician sees a chest X-ray with a red-hot region over the right lower lobe.

### 6.8 Integration Into This Codebase

| Change | File | Detail |
|---|---|---|
| New model URL + metadata | `server/models/radiologyModel.ts` | One-line `MODEL_URL` swap; update `MODEL_METADATA` with real numbers |
| New label set | `server/models/radiologyModel.ts` | Update `PATHOLOGY_LABELS` (14 entries) |
| New label union type | `src/types/clinical.ts` | Extend `PathologyClassResult['label']` |
| Per-class thresholds | `server/models/radiologyModel.ts` | Replace `> 0.5` with a per-class lookup constant |
| Radiologist prompt | `server/agents/radiologist.ts` | The prompt hardcodes nothing about labels — **no change needed**. It consumes `modelInference.classes` generically ✓ |
| Doctor grounding | `server/agents/doctor.ts` | Consumes `positiveFindings` generically ✓ |
| Grad-CAM (optional) | new `server/services/gradcam.ts` + `radiologist.ts` + a component | Optional field, render if present |

**The pipeline is already label-agnostic.** `radiologist.ts` and `doctor.ts` iterate over `modelInference.classes` without naming any disease. So M1 integration is genuinely a ~30-line diff. That is a strong position — tell your reviewers this.

### 6.9 M1 Acceptance Criteria

- [ ] Patient-level split with no patient appearing in both train and test
- [ ] Per-class AUC table, all 14 classes, published in the report
- [ ] Mean AUC ≥ 0.83; explicitly report `Hernia` and any class below 0.75 as a known limitation
- [ ] ECE < 0.05 after calibration
- [ ] ONNX verified: correct tensor names, logits-only output, `[1,3,224,224]` input
- [ ] End-to-end test: upload a real chest X-ray to `/api/radiology/predict` → plausible probabilities
- [ ] `npx tsc --noEmit` still clean after the type changes
- [ ] Model + training script + `requirements.txt` committed; weights on Hugging Face, not in git

---
## 7. M2 — Medical Bi-Encoder Retriever (replaces the Gemini embedding API)

### 7.1 What Exists Today

`server/rag/guidelines.ts`:
- Corpus: **10** `{id, title, source, category, snippet}` objects — hardcoded in the source file
- Embeddings: `ai.models.embedContent({ model: 'gemini-embedding-001' })` — a **cloud API call per document and per query**
- Storage: `const embeddingsCache = new Map<string, number[]>()` — process memory only
- Search: exact cosine similarity over ≤10 vectors; keyword-overlap fallback on failure
- No chunking, no persistence, no reranking, no citation spans

**Why this must be replaced:**
1. The synopsis explicitly lists *Sentence Transformers* as a technology — currently absent
2. A 10-document corpus makes "RAG" a misnomer. Reviewers will ask "how many documents?" and "10" is not a good answer
3. Every cold start re-embeds everything (wasted quota, non-reproducible)
4. Exact cosine over a real corpus (thousands of chunks) becomes O(n) per query in Node — you need an index
5. There is **no reranker**, so the top-4 passed to the Doctor agent are the top-4 by raw vector similarity — a well-known weak spot

### 7.2 Target Specification

| Property | Current | Target |
|---|---|---|
| Corpus | 10 hardcoded strings | **2,000–20,000 chunks** from NICE / WHO / CDC / BTS / GOLD / ICMR / ADA + PubMed abstracts |
| Chunking | None | 400–512 tokens, 64–80 token overlap, sentence-boundary aware, each chunk carries `{docId, title, source, section, pageSpan}` |
| Encoder | Gemini API | **Fine-tuned `pritamdeka/S-PubMedBert-MS-MARCO`** or `BAAI/bge-base-en-v1.5` |
| Vector store | In-memory `Map` | **FAISS** (`IndexFlatIP` for exact, `IndexIVFFlat`/HNSW for scale), persisted to disk |
| Reranker | None | Cross-encoder (`BAAI/bge-reranker-base`) or `ms-marco-MiniLM-L-6-v2` over top-50 → top-4 |
| Hybrid search | Keyword fallback only | **BM25 + dense, fused with Reciprocal Rank Fusion** — critical for drug names and lab values where exact tokens matter |
| Embedding dimension | 768 (Gemini) | 384 or 768, quantised to float16 for storage |
| Eval | None | Recall@1/5/10, MRR@10, nDCG@10 + end-to-end citation correctness |

### 7.3 Corpus Construction

```python
# rag/ingest.py (concept)
SOURCES = [
    # Publicly-redistributable guidelines (verify licence per source)
    "NICE_guidance",          # nice.org.uk — check re-use terms
    "WHO_guidelines",         # CC BY-NC-SA 3.0 IGO typically
    "CDC_guidelines",         # US public domain
    "GOLD_reports",           # goldcopd.org
    "ADA_StandardsOfCare",    # diabetesjournals.org
    "ICMR_STG",               # Indian Council of Medical Research — highly relevant for your context
    "BTS_guidelines",
    # Research literature
    "PubMed_abstracts",       # via NCBI E-utilities — abstracts are generally free to use
]

# Pipeline per document:
#   PDF -> PyMuPDF text extraction (per page, keeping page numbers)
#       -> section segmentation (heading regex / font-size heuristics)
#       -> sentence-aware chunking (512 tokens, 75 overlap)
#       -> attach metadata {docId, title, source, section, pageStart, pageEnd}
#       -> write rag/corpus/chunks.jsonl
```

**Metadata is the point.** Today a retrieved guideline is a title + a blob. With `{section, pageStart, pageEnd}` the Doctor agent can cite *"NICE NG158 §1.4.2, p.12"* — a genuinely auditable citation, which is exactly what your synopsis promises ("retrieved references").

### 7.4 Training the Bi-Encoder

```python
# rag/train_retriever.py (concept)
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

model = SentenceTransformer("pritamdeka/S-PubMedBert-MS-MARCO")   # medical-domain base

train_examples = [
    # (query, positive_chunk)  — negatives are mined in-batch + hard negatives
    InputExample(texts=[q, pos]) for q, pos in training_pairs
]

loader = DataLoader(train_examples, shuffle=True, batch_size=32)
loss   = losses.MultipleNegativesRankingLoss(model)   # contrastive, in-batch negatives

model.fit(
    train_objectives=[(loader, loss)],
    epochs=3,
    warmup_steps=int(0.1 * len(loader) * 3),
    optimizer_params={"lr": 2e-5},
    output_path="rag/models/mediagent-retriever",
)
```

**Where do the (query, positive) pairs come from?** Five sources, in order of value:

1. **Bootstrapped synthetic queries (start here — free, no annotation).** For each chunk, ask Gemini: *"Write 3 clinical questions this passage answers, in the voice of a triaging physician."* You get thousands of grounded pairs for the cost of some API calls. This is legitimate and standard practice; **document it clearly in your report as synthetic query generation.**
2. **Hard negatives.** After a first training round, retrieve top-50 for each query across the whole corpus, and label the non-positives with similarity 0.6–0.9 as hard negatives (the confusable-but-wrong passages). This is what actually moves MRR.
3. **Medical QA datasets** (query→answer, using the answer's source passage as the positive): PubMedQA, BioASQ, MedQuAD, MedMCQA.
4. **MS MARCO biomedical subset** — large and already in (query, passage) form.
5. **Your own 4 clinical scenarios** (`src/data/clinicalScenarios.ts`) — 4 hand-labelled cases, too few to train on but **perfect as a held-out evaluation set** because they're clinically curated by you.

```python
# Hard-negative mining (round 2)
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("rag/models/mediagent-retriever")
for q, pos in pairs:
    top = model.semantic_search(q, corpus_embeddings, top_k=50)[0]
    hard_negs = [c for c in top if c["corpus_id"] != pos_id and 0.6 < c["score"] < 0.9]
    triples.append(InputExample(texts=[q, pos, *hard_negs[:3]]))
# then retrain with TripletLoss or MultipleNegativesRankingLoss on triples
```

### 7.5 Evaluation

Build a gold set of **~150–300** (query → relevant chunk IDs) pairs. Use your 4 scenarios plus 30–50 synthetic clinician questions per guideline in the corpus.

| Metric | Target |
|---|---|
| Recall@1 | ≥ 0.55 |
| Recall@5 | ≥ 0.85 |
| Recall@10 | ≥ 0.92 |
| MRR@10 | ≥ 0.70 |
| nDCG@10 | ≥ 0.75 |
| **End-to-end citation correctness** | ≥ 0.80 — for each case, does the Doctor agent cite the guideline a clinician would pick? |
| **Reranker lift** | Report Recall@4 before vs. after cross-encoder reranking |

**Ablation table for your report** (this is what makes a training report strong):

| Configuration | R@1 | R@5 | nDCG@10 |
|---|---|---|---|
| Gemini `gemini-embedding-001` (baseline) | ? | ? | ? |
| Off-the-shelf S-PubMedBert | ? | ? | ? |
| Fine-tuned bi-encoder (in-batch negatives) | ? | ? | ? |
| + hard negatives | ? | ? | ? |
| + BM25 hybrid (RRF) | ? | ? | ? |
| + cross-encoder reranker | ? | ? | ? |

Run the **same query set against your existing Gemini embedding path** — you already have `POST /api/rag/search` — so you get a real baseline number instead of an assumption.

### 7.6 Serving — Two Options, One Recommended

**Option A — Python sidecar (recommended for correctness).**
`fastapi` service exposing `POST /embed` and `POST /search`. `server/rag/guidelines.ts` calls it. Simple, exact, uses FAISS properly.
Cost: a second process, must be started alongside Node. Add it to your Dockerfile / compose file.

**Option B — Pure Node via ONNX (recommended for deployment simplicity, and it fits this repo perfectly).**
This codebase **already has `onnxruntime-node@1.29.0` and `sharp` as dependencies**, and already has a working ONNX download-cache-session pattern in `server/models/radiologyModel.ts`. Reuse it:

```python
# Export the fine-tuned encoder for sentence-transformers
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
ort_model = ORTModelForFeatureExtraction.from_pretrained("rag/models/mediagent-retriever", export=True)
ort_model.save_pretrained("rag/models/mediagent-retriever-onnx")
AutoTokenizer.from_pretrained("rag/models/mediagent-retriever").save_pretrained("rag/models/mediagent-retriever-onnx")
```

Then in Node, mirror the `radiologyModel.ts` pattern: tokenise → ONNX → **mean-pool with attention mask** → L2-normalise → cosine. Store the corpus embeddings as a Float32Array in a binary sidecar file (`rag/corpus/embeddings.f16.bin` + `chunks.jsonl`) and do exact dot products. At ~5,000 chunks × 384 dims that is ~7.7 MB — **an exact cosine scan over 5,000 vectors in Node is ~1–3 ms.** For a corpus of this size you do not need FAISS at all.

> **Recommended:** Option B for the corpus up to ~50k chunks (exact search, one process, no Python at runtime), with a note in your report that FAISS HNSW would be the scaling path beyond that. This gives you the "vector database" deliverable in spirit and a *better* engineering story than adding a service you don't need.

### 7.7 Integration Into This Codebase

| Change | File | Detail |
|---|---|---|
| Replace embedding call | `server/rag/guidelines.ts` | Swap `ai.models.embedContent` for local ONNX encoder; keep `cosineSimilarity()` (already correct) |
| Load corpus from disk | new `server/rag/corpus.ts` | Read `chunks.jsonl` + `embeddings.f16.bin` at boot, cache in a module-level array |
| Add hybrid BM25 | new `server/rag/bm25.ts` | ~80 lines — build an inverted index at boot; fuse with RRF |
| Add reranker | new `server/rag/reranker.ts` | ONNX cross-encoder over top-50 → top-4 |
| Signature | `searchClinicalGuidelines(ai, query, topK)` | **Keep the same signature** so `server/api.ts` needs no change; drop the `ai` dependency inside |
| `CLINICAL_GUIDELINES` export | `server/rag/guidelines.ts` | Keep it — `GET /api/guidelines` and the `doctor.ts` prompt both use it |
| Chunk citations | `src/types/clinical.ts` | Add optional `section?`, `pageStart?`, `pageEnd?` to `ClinicalGuideline` |
| Doctor prompt | `server/agents/doctor.ts` | Already renders `g.title`, `g.source`, `g.category`, `g.similarityScore`, `g.snippet` — extend the template to include section/page |

**Key integration win:** `searchClinicalGuidelines` is called from exactly three places in `server/api.ts` (`/rag/search`, `/triage/stream`, `/triage/run`), always with the same signature. Keep the signature and **all three call sites keep working unchanged.**

### 7.8 M2 Acceptance Criteria

- [ ] Corpus ≥ 2,000 chunks from ≥ 5 named, licence-checked sources
- [ ] Every chunk carries `{docId, title, source, section, pageStart, pageEnd}`
- [ ] Chunking is sentence-aware with overlap — no chunk starts mid-sentence
- [ ] Fine-tuned encoder beats the Gemini baseline on the same gold query set (numbers in the report)
- [ ] Hard-negative round shows measurable MRR improvement over round 1
- [ ] Hybrid BM25+RRF ablation reported
- [ ] Reranker lift reported
- [ ] `searchClinicalGuidelines()` signature unchanged; `npx tsc --noEmit` clean
- [ ] Cold start no longer makes embedding API calls (`GET /api/rag/search` works with `GEMINI_API_KEY` unset)
- [ ] `GET /api/guidelines` still returns a sensible list

---
## 8. M3 — Laboratory Report OCR + Entity Extraction (new capability)

### 8.1 What Exists Today

**Nothing.** There is no OCR, no PDF parsing, no image-to-lab-value path anywhere in the repository. `LabPanelData` (`src/types/clinical.ts`) accepts `markers: LabMarker[]` and an optional `rawReportText: string` — both are populated only by typing or pasting.

This is the largest **missing feature** relative to the synopsis, and the one with the clearest clinical justification: a triage nurse photographs a printed lab report; the system extracts the values.

### 8.2 Target Specification — a Three-Stage Pipeline

Do **not** try to train a single end-to-end model. Triage OCR is a solved problem; the value you add is in **domain-specific extraction and validation**.

```
Stage 1: Document -> image            PyMuPDF (PDF) or direct camera/upload (JPEG/PNG)
Stage 2: image    -> raw text lines   PaddleOCR (PP-OCRv4/v5) or Tesseract 5 — pretrained, no training needed
Stage 3: text     -> LabMarker[]      YOUR trained token-classification model (this is the research contribution)
Stage 4: validate -> flags            existing evaluateLabMarker() in src/utils/labReference.ts  ← already built
```

**Stage 4 is already written and is excellent (25 analytes, aliases, critical thresholds).** This is the key insight: **you do not need to train anything to interpret the values** — you only need to train the model that maps messy OCR text to `{name, value, unit, referenceRange}`.

### 8.3 Stage 2 — OCR Engine (no training required)

| Engine | Recommendation |
|---|---|
| **PaddleOCR PP-OCRv4/v5** | **Recommended.** Better on rotated/skewed phone photos and dense tables; strong English + numeric accuracy; pretrained models are Apache-2.0 |
| Tesseract 5 LSTM | Viable fallback; weaker on table structure; fine-tunable if you insist on "training" an OCR model for the synopsis bullet |
| Cloud OCR (Vision/Document AI) | Highest accuracy, but defeats the point of the project and adds cost |

If your review specifically wants "we trained an OCR model", the honest and defensible move is: **use pretrained PaddleOCR as the recogniser, and train your own Stage-3 extractor.** That *is* a trained model, it is where the domain difficulty genuinely lies, and it is a much better story than fine-tuning a generic OCR net on 20 synthetic images.

### 8.4 Stage 3 — Train a Lab-Entity Tagger (the actual training task)

**Task:** token classification (NER) over OCR text.
**Labels (BIO scheme):** `TEST_NAME`, `VALUE`, `UNIT`, `REF_RANGE`, `FLAG`, `O`.

```python
# ocr/train_lab_ner.py (concept)
# Input:  "WBC 18.4 10^3/uL 4.5 - 11.0 H"
# Labels: TEST_NAME VALUE UNIT REF_RANGE FLAG

from transformers import AutoTokenizer, AutoModelForTokenClassification, Trainer

model = AutoModelForTokenClassification.from_pretrained(
    "dmis-lab/biobert-base-cased-v1.2",      # biomedical domain base
    num_labels=len(LABEL_LIST),
)
# ... standard Trainer loop: lr 2e-5, 10 epochs, eval on entity-level F1
```

**Base model options:** `dmis-lab/biobert-base-cased-v1.2` (recommended), `microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract`, or `allenai/scibert_scivocab_uncased`. Do **not** start from a general BERT — biomedical pretraining gives a large head start on analyte abbreviations (`Hgb`, `Cr`, `hs-TnI`, `HCO3`).

**Data construction — the pragmatic route:**

1. **Free synthetic ground truth (start here).** Write a renderer that takes your `LAB_REFERENCE_DATABASE` (25 analytes, units, ranges, aliases) and generates thousands of realistic lab-report layouts as images — vary fonts, column order, table borders, skew, blur, JPEG noise, shadows, paper tint, stamps, handwriting-style annotations. You now have **perfect ground-truth labels for free**, because you generated the images from known values.
2. **Run PaddleOCR on them** to get realistic OCR text with realistic OCR errors (this teaches the model to be robust to OCR mistakes — what the preprocessing actually produces, not clean text).
3. **Annotate a real set of ~100–300 genuine lab report images** (from public sources, or synthetic-adjacent samples) for a held-out, honest test set. **Do not report metrics only on synthetic data** — that is the trap and a reviewer will catch it.
4. **Bootstrapped real-world augmentation**: public sources such as the CORD receipt dataset or FUNSD help with layout understanding, though they are not medical — useful for pretraining a layout detector, weak as a lab-extraction evaluation.

**Handle the hard cases explicitly in your report:**
- Column-order ambiguity when the reference range is printed *before* the value
- Rows where OCR merges the value and unit (`18.410^3/uL`)
- Analytes not in `LAB_REFERENCE_DATABASE` → must fall back to `evaluateCustomRangeMarker()`, which already parses `< X`, `> X`, and `min - max` strings ✓
- Qualitative results (`Negative`, `Trace`, `0-2` HPF) → already handled by the `isNaN` branch in `evaluateLabMarker()` ✓
- Handwritten values → out of scope; state this limitation

### 8.5 Evaluation

| Metric | Target |
|---|---|
| Character Error Rate (CER), Stage 2 | < 5% on clean scans, < 12% on phone photos |
| Word Error Rate (WER), Stage 2 | < 10% clean |
| Entity-level F1, Stage 3 | **≥ 0.90** on the held-out real set |
| Per-entity F1 | Report `TEST_NAME`, `VALUE`, `UNIT`, `REF_RANGE` separately — `VALUE` will be weakest |
| **End-to-end marker accuracy** | ≥ 0.85 of true markers correctly extracted with correct numeric value |
| **Flagging accuracy** | Does the extracted value produce the same `status` as the manually-entered truth? (this is what actually matters clinically) |

### 8.6 Integration Into This Codebase

| Change | File | Detail |
|---|---|---|
| New endpoint | `server/api.ts` | `POST /api/labs/extract` — accepts `{fileDataUrl, mimeType}` → returns `LabMarker[]` |
| New service | `server/services/labOcr.ts` | PDF→image (pdf.js or PyMuPDF sidecar) → OCR → NER → `LabMarker[]` |
| Then reuse existing logic | `src/utils/labReference.ts` | **Call `evaluateLabMarker()` on each extracted marker** — zero new validation code |
| UI | `src/components/DiagnosticsForm.tsx` | Add an "Upload lab report" control; on success, pre-fill the marker rows **for user confirmation** |
| Type | `src/types/clinical.ts` | Add `LabPanelData.sourceFile?: string` and `extractionConfidence?: number` |

**Critical UX rule:** extracted values must be shown as **editable suggestions with a confidence indicator**, never silently committed. A misread `18.4` as `78.4` changes the triage. Make the clinician confirm — this is also the correct governance answer for a clinical decision-support tool.

### 8.7 M3 Acceptance Criteria

- [ ] PDF and image (JPEG/PNG) both accepted
- [ ] PaddleOCR (or Tesseract) integrated and version-pinned
- [ ] Lab-entity NER model trained, base model and hyperparameters documented
- [ ] Entity F1 ≥ 0.90 on a **real, held-out** annotated set (not synthetic)
- [ ] End-to-end: uploaded report → `LabMarker[]` → `evaluateLabMarker()` → correct flags
- [ ] Extracted values are user-editable with visible confidence; nothing auto-committed
- [ ] Graceful failure: unreadable image returns a clear error, never a fabricated marker
- [ ] Explicitly documented limitations (handwriting, non-`LAB_REFERENCE_DATABASE` analytes, non-English reports)

---

## 9. M4 — Local Triage LLM (optional; highest cost, lowest necessity)

### 9.1 What Exists Today

Every generative step is a Gemini cloud call via `server/utils/aiHelper.ts`. Its candidate chain is `gemini-3.6-flash` → `gemini-3.8-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest`, with a rule-based fallback for each agent.

**Problems:** quota limits and cost; no offline operation; PHI leaving your infrastructure; **silent degradation** (a failed call produces rule-based output indistinguishable from success at the API level).

### 9.2 The Most Important Point About M4

**Fine-tuning is not your biggest reliability win — constrained decoding is.**

The single most common failure of an LLM in this codebase is `JSON.parse()` throwing on malformed output. Today `aiHelper.ts` mitigates this by stripping markdown fences and by falling back to a rule-based path on failure. That is a workaround.

**Grammar-constrained decoding guarantees schema-valid JSON by construction** — the model literally cannot emit a token that violates `src/types/clinical.ts`. This eliminates an entire class of failure, works with *any* model (including Gemini), and requires no training at all.

### 9.3 Priority Order

1. **Guided decoding / JSON-schema enforcement** (1–2 days, no training, works on the current Gemini setup via `responseSchema`/`responseJsonSchema`) — **do this first**
2. **Build the gold triage evaluation dataset** (2–3 weeks, needed regardless of whether you ever fine-tune) — this is the real asset
3. **Fine-tune a local model with QLoRA** (only if time remains and you want the offline/privacy story)

> **Be honest with your reviewers about (3).** A 7–8B QLoRA model trained on a few thousand vignettes will **not** beat Gemini on open-ended clinical reasoning. Claiming otherwise is not credible. The defensible claims are: *offline capability, PHI never leaves the host, zero marginal cost, deterministic latency, and a reproducible, auditable model you control.*

### 9.4 Building the Gold Triage Dataset (do this even without fine-tuning)

Format each example as a direct match to your existing types:

```json
{
  "system": "<the doctor.ts system instruction verbatim>",
  "user":   "<the doctor.ts user prompt with a real patient payload>",
  "assistant": "<a DoctorSynthesis JSON object valid against src/types/clinical.ts>"
}
```

**Sources, in order of value:**

| Source | Size | Access |
|---|---|---|
| **Your own pipeline output, physician-reviewed** | grow to 2–5k | Free. Run `POST /api/triage/run` on the 4 scenarios + synthetic variants, then have a clinician correct the output. **Highest value per hour spent.** |
| **MIMIC-IV-ED** | ~425k ED stays | Requires PhysioNet credentialing + CITI training + DUA. Contains real triage vitals, chief complaints, and **ESI acuity** — the ideal label for M5 |
| **MedQA (USMLE)** | 12k+ | Public |
| **MedMCQA** | 194k | Public |
| **PubMedQA** | 273k | Public |
| **MedQuAD** | 47k QA pairs | Public |
| **Synthetic vignettes** | unlimited | Generate with Gemini across the guideline taxonomy, then have a clinician review a sample. **Label these clearly as synthetic.** |

**Split discipline:** split by **patient/case**, not by row. Vignettes derived from the same source case must never appear in both train and eval.

### 9.5 QLoRA Recipe

```python
# llm/train_triage_qlora.py (concept)
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from trl import SFTTrainer

bnb = BitsAndBytesConfig(
    load_in_4bit=True, bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True,
)
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct", quantization_config=bnb, device_map="auto"
)

lora = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
)
model = get_peft_model(model, lora)

args = TrainingArguments(
    output_dir="llm/out", num_train_epochs=3, per_device_train_batch_size=2,
    gradient_accumulation_steps=8, learning_rate=2e-4, lr_scheduler_type="cosine",
    warmup_ratio=0.03, bf16=True, logging_steps=10, save_strategy="epoch",
    gradient_checkpointing=True, max_length=4096,
)
SFTTrainer(model=model, args=args, train_dataset=ds, tokenizer=tok).train()
```

**Hardware:** 1× A100 40GB comfortably; 2× RTX 4090 24GB or 2× T4 in Colab/Kaggle workable; a single 24GB card works with batch 1 + grad-accum 16 + `max_length=2048` (careful: truncating the system prompt would be catastrophic — **verify your tokenised length distribution before choosing 2048**).

### 9.6 Serving & Integration

Serve via **Ollama / llama.cpp / vLLM** and add it as another provider behind the existing abstraction — **do not touch the agents.**

`server/utils/aiHelper.ts` already exposes exactly the right seam: `generateContentWithFallback(ai, {contents, systemInstruction, temperature})`. Add a sibling function `generateWithLocalModel(...)` with the identical signature, and select the provider from an env var (`LLM_PROVIDER=gemini|local`). **All five agent files stay unchanged.**

For guaranteed-valid JSON in the local path: `vLLM` with `guided_json` (a JSON schema derived from `DoctorSynthesis`), or `llama.cpp` GBNF grammars, or `outlines`.

### 9.7 Evaluation

| Metric | What it proves |
|---|---|
| **JSON schema validity rate** | Must be ~100% with guided decoding; baseline is the current Gemini fence-stripping rate |
| **Urgency macro-F1** vs. ground truth | The headline clinical metric |
| **ICD-10 code agreement** | Partial credit; report exact-match and 3-character-prefix-match separately |
| **Citation faithfulness** | For every `EvidenceCitation` with `sourceType: "guideline"`, verify the quoted text **actually appears** in the retrieved guideline set. Any citation whose text is not in the retrieved set is a **fabricated citation** — measure this rate. It should be near zero; this is your anti-hallucination proof. |
| **Diagnosis top-1 / top-3 accuracy** | Against gold |
| **Latency p50 / p95** | Compare against Gemini |
| **Physician rating** | 20–30 cases, 1–5 scale, blinded. Small but very persuasive. **Must be labelled clearly as a small-scale review, not a clinical validation.** |

### 9.8 M4 Acceptance Criteria

- [ ] **Guided/constrained decoding implemented for every generative call** (do this even if you never fine-tune)
- [ ] Gold triage dataset built with a patient-level split and documented provenance
- [ ] JSON validity ≈ 100%; fabricated-citation rate measured and reported
- [ ] `LLM_PROVIDER` env switch; all 5 agents unchanged
- [ ] Offline demo works with `GEMINI_API_KEY` unset
- [ ] Report explicitly states the fine-tuned model is **not** claimed to beat Gemini on reasoning

---

## 10. M5 — Confidence Calibration + Urgency Cross-Check (1 week, highest value-per-hour)

### 10.1 The Problem, Precisely

`ProbableCondition.probabilityScore` is currently produced like this, in `server/agents/doctor.ts`:

```typescript
const cappedScore = idx === 0 ? Math.min(cond.probabilityScore || 50, 55) : Math.min(cond.probabilityScore || 25, 30);
```

That is prompting, not probability. The system displays "88%" to a clinician with no statistical basis. **Fix this — it is one week of work and it is the weakness a sharp examiner will find.**

### 10.2 Two Models

**M5a — Diagnostic confidence calibrator (regression).**

```
Features (all already available in the codebase):
  - radiologist.modelInference.classes[k].probability       (per class)
  - number of modelInference.positiveFindings
  - labAnalyst: count of CRITICAL_HIGH / CRITICAL_LOW markers
  - labAnalyst: number of organSystemsFlagged
  - interviewer.redFlagSymptoms.length
  - vitals derangement count (each vital classified non-NORMAL)
  - dataCompletenessLevel  -> one-hot (symptoms_only | partial | complete)
  - retrievedGuidelines[0].similarityScore
  - evidenceCitations.length, split by sourceType

Label: did the top-1 probable condition match the gold diagnosis?  (0/1)

Model:   GradientBoostingClassifier / LogisticRegression  (small data -> keep it simple)
Output:  P(correct), then calibrate with isotonic regression on a held-out fold
Metrics: ECE, Brier, reliability diagram
```

This converts a guess into a **measured** probability, and the input features come from data the pipeline *already produces* — no new collection needed.

**M5b — Urgency cross-check classifier (3-class).**

Train a small classifier (`routine` / `urgent` / `emergency`) over the case text. Use it as an **independent second opinion** against the LLM's `urgencyLevel`. On disagreement, surface a warning in `FinalReportView.tsx`: *"Automated urgency cross-check disagrees with the primary assessment — clinician review advised."*

This is a genuinely good clinical-safety design — a cheap, deterministic safety net on the highest-stakes output the system produces. **Label source:** MIMIC-IV-ED `triage_acuity` (ESI 1–5) → map ESI 1–2 → `emergency`, ESI 3 → `urgent`, ESI 4–5 → `routine`. Fall back to your 4 curated scenarios plus physician-labelled vignettes if MIMIC access is not available.

### 10.3 And Implement `ConfidencePillarScore` (G7) — deterministically

The type already exists in `src/types/clinical.ts` and is never populated. Populate it in `doctor.ts` with **deterministic arithmetic**, not LLM output:

| Pillar | maxWeight | contributedScore |
|---|---|---|
| interview | 25 | 25 if `clinicalSummary` + vitals present && ≥2 red flags |
| radiology | 30 | `25 + 5 × (has positive imaging findings)` if imaging present, else **0** |
| lab | 30 | `25 + 5 × (has critical alert)` if labs present, else **0** |
| guideline | 15 | `15 × topSimilarityScore` if guidelines retrieved, else 0 |

Then `probabilityScore = round(100 × Σ contributedScore / Σ maxWeight)` for supported pillars only. This yields a **transparent, reproducible, auditable** confidence number where every point traces to a named evidence source — strictly better XAI than an LLM integer, and it directly satisfies the synopsis's *"explainable diagnosis, confidence score"* objective.

### 10.4 M5 Acceptance Criteria

- [ ] Calibrator trained; ECE and Brier reported with a reliability diagram
- [ ] `probabilityScore` derived from the calibrated model, not from the prompt
- [ ] `confidencePillars` populated in **both** the LLM path and `buildFallbackDoctorSynthesis()`
- [ ] `FinalReportView.tsx` renders the pillar breakdown as a weighted bar
- [ ] Urgency cross-check implemented with a visible disagreement warning
- [ ] Prompt-cap constants removed or demoted to a documented fallback-only path

---
## 11. Compute & Data Access Plan

### 11.1 Compute Requirements

| Model | Minimum | Comfortable | Notes |
|---|---|---|---|
| M1 radiology (full NIH, 25–40 epochs) | 1× T4 16GB, ~30 h | 1× A100 40GB, ~6 h | Mixed precision mandatory. Colab Pro / Kaggle (30 h/week free T4) is sufficient if you're patient |
| M1 Grad-CAM | CPU only | CPU only | Inference-time only |
| M2 retriever fine-tune | 1× T4 16GB, ~2 h | 1× A100, ~30 min | Small model (110M params); very cheap |
| M3 OCR (PaddleOCR inference) | CPU | CPU or T4 | Pretrained — inference only |
| M3 lab NER fine-tune | 1× T4 16GB, ~1 h | Same | 110M params, 10 epochs |
| M4 QLoRA 7–8B | 1× T4 16GB (slow, batch 1 + accum 16) | 1× A100 40GB | The only genuinely heavy job. Do it last |
| M5 calibrator | CPU, seconds | CPU | sklearn on a few thousand rows |

**Total practical GPU budget if using free tiers:** Colab Pro (~₹1,000/month), Kaggle (free 30 h/week), or your institute's lab cluster. **You do not need to buy a GPU for this project** except possibly for M4.

### 11.2 Data Access & Compliance Checklist

| Dataset | Access | Action required |
|---|---|---|
| NIH ChestX-ray14 | Public download | Verify current NIH terms page; cite the Wang et al. 2017 CVPR paper |
| CheXpert | Stanford registration | Sign the RUA. **Do not redistribute images.** Not required if NIH alone suffices |
| MIMIC-IV-ED | PhysioNet credentialed | Complete CITI "Data or Specimens Only Research" training; sign the DUA; allow 1–3 weeks for approval. **Start this early if you want ESI labels for M5b** |
| PubMedQA / MedQA / MedMCQA | Public (check each) | Cite properly |
| Public clinical guidelines | Varies by publisher | **Check each publisher's reuse terms.** Prefer WHO / CDC / ICMR (generally permissive or public domain) over commercial publishers |
| Synthetic vignettes | Self-generated | Label explicitly as synthetic in the report |

> **Ethics note for your review:** even though every sample case in `src/data/clinicalScenarios.ts` is synthetic, once you ingest MIMIC-IV-ED you are working with **real de-identified patient data**. You need to state your data-handling policy: no PHI leaves the host, no data committed to GitHub, `.gitignore` covers all dataset directories.

---

## 12. Schedule Mapped to Review 1 and Review 2

The synopsis defines **Review 1 (mid-semester)** and **Review 2 (end of semester)** with a Progress Review Report each. Map the work accordingly.

### Review 1 — ready-to-report, demonstrable increments

| Item | Deliverable evidence | Effort |
|---|---|---|
| **Fix P0 security** | Rewritten `firestore.rules` with auth-gated access; screenshot of a denied unauthenticated read | 2 h |
| **Ship a real training repo** | `training/` folder with `requirements.txt`, dataset prep scripts, training scripts, and a `README` — even before models are trained | 1 day |
| **M5 confidence pillars** | `confidencePillars` populated deterministically in `doctor.ts`; rendered as a weighted bar in `FinalReportView.tsx` | 2 days |
| **M1 first training run** | Full NIH ChestX-ray14, 14 labels, patient-level split; per-class AUC table in the report | 1–2 weeks |
| **M2 corpus + baseline** | ≥ 2,000 chunks ingested with metadata; Recall@k of the **current Gemini** retriever measured as a baseline | 4 days |
| **Housekeeping** | Delete the 7 `fix_*.cjs` scripts; rewrite `README.md`; add `.model_cache/` to `.gitignore`; rename the package | 1 h |
| **Deploy artefact** | Working `Dockerfile` + `docker-compose.yml` | 1 day |

### Review 2 — research contribution and honest evaluation

| Item | Deliverable evidence | Effort |
|---|---|---|
| **M1 final model** | ONNX exported, verified, uploaded to HF; model URL swapped; `/api/radiology/predict` returns 14-class output | 3 days |
| **M1 Grad-CAM** | Heatmap overlay visible in the UI on a real chest X-ray | 3 days |
| **M2 fine-tuned retriever** | Ablation table (Gemini baseline → off-the-shelf → fine-tuned → +hard negatives → +BM25 → +reranker) | 1 week |
| **M5 calibration** | Reliability diagram, ECE, Brier; urgency cross-check with disagreement warning | 4 days |
| **M3 OCR pipeline** | Upload a photographed lab report → extracted markers → correct flags; entity F1 on the real held-out set | 2 weeks |
| **Test suite** | Jest/Vitest covering `evaluateLabMarker()`, `cosineSimilarity()`, confidence capping, and each API endpoint | 4 days |
| **Progress Review Report ×2** | Filled FF No. 180 forms with the tables above | 2 days |
| **M4 (stretch)** | QLoRA fine-tune + guided decoding + offline demo | 2–3 weeks |

### Critical path

```
M1 training (GPU-bound, longest)
    └─> M1 ONNX export + verify
            └─> M1 integration (30-line diff) + Grad-CAM
M2 corpus ingest ──> M2 fine-tune ──> M2 integration (signature-preserving)
M5 needs the gold dataset → which M1/M2 outputs help build
M3 independent (start anytime; uses pretrained OCR)
M4 last, optional
```

**Start M1 and M2 in parallel on day one** — they share no dependencies and both are GPU-bound at different times.

---

## 13. Immediate Action List — Do These This Week

Ordered so that each step is independently valuable.

1. **Add `.model_cache/` to `.gitignore`** — before someone commits 28 MB of weights. *(1 minute)*
2. **Delete the 7 `fix_*.cjs` / `rewrite_styles.cjs` scripts.** *(1 minute)*
3. **Fix `firestore.rules`.** At minimum require `request.auth != null`; better, restrict to the owning user. Then re-verify with `POST /api/cases` unauthenticated and confirm it fails. *(2 hours)*
4. **Verify the Gemini model IDs actually resolve** by calling `POST /api/health` and then `POST /api/agents/interviewer` with a sample patient. If it silently falls back to rule-based output, your demo is not exercising the LLM at all. *(15 minutes)*
5. **Create `training/` with `requirements.txt`** (`torch`, `torchvision`, `torchxrayvision`, `timm`, `scikit-learn`, `sentence-transformers`, `transformers`, `datasets`, `optimum[onnxruntime]`, `onnx`, `onnxruntime`, `pdf2image`, `pytesseract`), plus an empty `training/README.md` describing M1–M5. **This alone converts "no training code" into "training infrastructure exists."** *(1 hour)*
6. **Kick off the NIH ChestX-ray14 download** (it is ~45 GB and slow). Start it now; it will run while you do everything else. *(15 minutes to start, hours to complete)*
7. **Start PhysioNet / CITI credentialing for MIMIC-IV-ED** if you want ESI-based urgency labels for M5b. Approval takes weeks — start now or lose the option. *(2 hours)*
8. **Implement `confidencePillars`** in `doctor.ts` using the deterministic weights in §10.3. It is a pure function over data you already have, it fixes G7, and it needs no training or GPU. *(1 day)*
9. **Measure your RAG baseline** — run ~50 clinical queries through `POST /api/rag/search` and record top-4 results. You now have a number to beat, which is what makes the M2 ablation table meaningful. *(half a day)*
10. **Replace the SVG demo radiographs** with real, licence-cleared chest X-rays from ChestX-ray14. The model currently scores cartoons in the demo path. *(half a day)*

---

## 14. Quick-Reference Gap → Action Table

| Gap | Action | Owner type | Est. |
|---|---|---|---|
| G1 No training code | Create `training/` with M1–M5 scripts | ML engineer | 1–6 weeks |
| G2 Open Firestore rules | Rewrite `firestore.rules` with auth | Backend | 2 h |
| G3 No OCR | M3: PaddleOCR + BioBERT NER | ML engineer | 3–4 weeks |
| G4 10-document RAG | M2: ingest 2,000+ chunks, fine-tune encoder, add reranker | ML engineer | 1–2 weeks |
| G5 Weak radiology model | M1: 14 labels, full NIH, patient split | ML engineer | 2–3 weeks |
| G6 Uncalibrated confidence | M5a: calibrator + ECE report | ML engineer | 1 week |
| G7 Empty `confidencePillars` | Deterministic pillar scoring in `doctor.ts` | Full-stack | 1 day |
| G8 No imaging XAI | M1: Grad-CAM + UI overlay | ML + frontend | 3 days |
| G9 Non-persistent embeddings | M2 Option B: binary embedding sidecar | Backend | 3 days |
| G10 SVG demo images | Replace with real CXRs | Any | half day |
| G11 Speculative model IDs | Verify + pin documented names | Backend | 15 min |
| G12 Single-vendor LLM | M4: local provider behind `aiHelper.ts` seam | ML engineer | 2–4 weeks |
| G13 No tests / no Docker | Test suite + `Dockerfile` | Full-stack | 1 week |

---

## 15. What Is Already Strong (Say This In Your Review)

Do not let the gap list obscure genuine achievements — several are well above typical undergraduate-project quality, and you should present them as such:

1. **Real, working multi-agent orchestration with genuine concurrency.** `Promise.all` over three specialist agents with **per-agent latency telemetry** streamed live over SSE. This is more sophisticated than most CrewAI tutorials.
2. **Every agent has a substantive deterministic fallback.** The system does not collapse when the LLM is unavailable — it degrades to rule-based clinical reasoning that still produces structured output. Most projects have no fallback at all.
3. **`src/utils/labReference.ts` is genuinely good engineering.** 25 analytes, alias matching, critical thresholds, generated interpretations, and custom-range parsing. Deterministic, testable, and the correct design choice — an LLM should never be the authority on whether K+ of 6.2 is critical.
4. **`buildFallbackDoctorSynthesis()` is a ~350-line clinical reasoner.** It handles data-completeness levels, caps confidence appropriately, and cites evidence. That is real domain modelling.
5. **The evidence-citation chain is implemented end-to-end.** `EvidenceCitation` with `sourceType` discriminated across interview / radiology / lab / guideline is exactly the right structure for explainability, and it is populated by both the LLM and fallback paths.
6. **The `dataCompletenessLevel` handling is clinically thoughtful.** Capping confidence at 35–55% for a symptoms-only presentation and explicitly listing missing data sources with recommended actions is the kind of nuance that usually appears only in mature clinical software.
7. **The label-agnostic agent pipeline.** Because `radiologist.ts` and `doctor.ts` iterate over `modelInference.classes` generically, upgrading from 5 to 14 classes is a ~30-line diff. That architectural decision is paying off directly.
8. **The ONNX pipeline is production-shaped.** Download once → cache to disk → single `InferenceSession` reused via a memoised promise → `sharp`-based preprocessing matching the training normalisation exactly. Correct, and it means M1 integration is a URL swap.

---

## 16. One-Paragraph Summary

**Where you are:** MediAgent AI is a working, type-clean multi-agent clinical triage application with five collaborating agents, live SSE streaming, a real evidence-citation chain, a strong deterministic lab-reference engine, and — uniquely — one genuine trained deep-learning model (DenseNet-121 chest X-ray classifier) running in production via ONNX. **The problem is that you built the entire serving layer and none of the training layer:** the ONNX model was trained outside this repository on only 5,600 images across 5 classes, the RAG retriever embeds 10 hardcoded strings through a cloud API into a `Map` that evaporates on restart, the confidence scores are prompted integers rather than calibrated probabilities, and the OCR that your synopsis promises does not exist at all. **What to do:** stand up a `training/` directory and execute five models in order — **(M1)** retrain the DenseNet-121 on the full 112,120-image NIH ChestX-ray14 set across all 14 labels with a patient-level split, per-class AUC reporting, per-class thresholds, and Grad-CAM for explainability; **(M2)** fine-tune a `S-PubMedBert` bi-encoder over 2,000+ properly-chunked guideline documents from WHO/NICE/CDC/ICMR, add BM25 hybrid retrieval and a cross-encoder reranker, and serve it through the `onnxruntime-node` dependency you already have; **(M5)** replace the LLM's guessed confidence with a calibrated model and deterministically populate the `ConfidencePillarScore` type that is already declared but never filled; **(M3)** add a PaddleOCR + BioBERT-NER pipeline so a photographed lab report becomes `LabMarker[]`, reusing `evaluateLabMarker()` for validation; and **(M4)**, only if time allows, QLoRA fine-tune a 7–8B model with grammar-constrained decoding for offline operation — while implementing guided decoding *regardless*, because guaranteed-valid JSON is worth more than any amount of fine-tuning. Do M1 and M2 first; they are what the synopsis actually promises, and the serving infrastructure is already good enough that both drop in with minimal code change.
