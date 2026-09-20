# MediAgent AI — Model Training

This directory is the **training layer** for MediAgent AI. Before it existed, the
repository could *serve* a model but could not *produce* one — the radiology ONNX
file was downloaded from Hugging Face and nothing else was trained at all.

Companion document: `docs/CODEBASE_VS_SYNOPSIS_AND_TRAINING_ROADMAP.md` — the full
gap analysis against the project synopsis (FF No. 180).

---

## What is trained here

| # | Model | Script | Replaces | Priority |
|---|---|---|---|---|
| **M1** | Chest X-ray multi-label classifier (DenseNet-121, 14 labels) | `train_radiology.py` | The under-trained 5-class ONNX | **P0** |
| **M2** | Medical bi-encoder retriever (S-PubMedBert) | `train_retriever.py` | Gemini `gemini-embedding-001` API over 10 hardcoded strings | **P0** |
| **M3** | Lab-report entity extractor (BioBERT NER) | `train_lab_ner.py` | Nothing — brand new capability | P1 |
| **M5** | Confidence calibrator + urgency cross-check | `train_calibrator.py` | LLM-guessed `probabilityScore` | P1 |
| **M4** | Local triage LLM (QLoRA) | *not implemented here* | Gemini API | P2 / optional |

M1 and M2 are the two the synopsis explicitly promises. Do those first.

---

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
source .venv/bin/activate          # Linux / macOS

# Install the CUDA build of torch for your driver FIRST, then the rest:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r training/requirements.txt
```

Verify the package imports before anything else:

```bash
python -c "from mediagent_training import NUM_LABELS, NIH_CHESTXRAY14_LABELS; print(NUM_LABELS, NIH_CHESTXRAY14_LABELS)"
# expected: 14 ('Atelectasis', 'Cardiomegaly', 'Effusion', ...)
```

### Layout

```
training/
├── mediagent_training/        # importable package
│   ├── labels.py              # THE CROSS-LANGUAGE CONTRACT (read this first)
│   ├── config.py              # paths + hyperparameters
│   ├── model.py               # DenseNet-121 builder, logits-only
│   ├── dataset.py             # NIH loader, patient-level split, preprocessing
│   └── metrics.py             # per-class AUC, AP, sensitivity@spec, ECE, Brier
├── train_radiology.py         # M1 train
├── calibrate_thresholds.py    # M1 per-class operating points
├── export_radiology_onnx.py   # M1 export + contract verification
├── evaluate_radiology.py      # M1 held-out test + ONNX parity
├── gradcam.py                 # M1 explainability
├── ingest_guidelines.py       # M2 corpus build
├── build_retrieval_pairs.py   # M2 training pairs
├── train_retriever.py         # M2 train + ablation
├── export_retriever_onnx.py   # M2 export + corpus embeddings
├── train_lab_ner.py           # M3
└── train_calibrator.py        # M5
```

Data, checkpoints, exports and metrics all land in gitignored directories
(`training/data/`, `training/out/`, `training/checkpoints/`, `training/exports/`,
`training/runs/`).

---

## M1 — Radiology classifier

**Step 0. Get the data.** ~45 GB, so start this early.

Download from <https://nihcc.app.box.com/v/ChestXray-NIHCC>:

```
training/data/nih/
├── Data_Entry_2017.csv
├── train_val_list.txt
├── test_list.txt
└── images/                 # extract images_001.tar.gz .. images_012.tar.gz here
```

The official lists already split by **patient**, which is the whole point — a
random image-level split leaks the same patient into train and test and inflates
AUC. `dataset.py` carves the validation set out of `train_val` at the patient
level too.

**Step 1. Smoke test** (a few minutes, catches shape and path errors early):

```bash
python training/train_radiology.py --epochs 1 --limit 200 --num-workers 0
```

**Step 2. Train.**

```bash
python training/train_radiology.py                 # xrv transfer (default)
python training/train_radiology.py --init imagenet # ablation baseline
python training/train_radiology.py --init scratch  # proves pretraining matters
```

Writes `training/checkpoints/radiology_densenet121_best.pt` and per-class metrics
under `training/out/`. ~6 h on an A100, ~30 h on a free T4.

**Step 3. Fit per-class thresholds.**

```bash
python training/calibrate_thresholds.py
```

Replaces the hardcoded `probability > 0.5` with thresholds tuned to hit 90%
sensitivity per class, plus isotonic calibration. Writes
`training/out/thresholds.json`.

**Step 4. Export and verify.**

```bash
python training/export_radiology_onnx.py
```

This asserts the tensor names, the shapes, numerical parity with PyTorch, and —
critically — that the graph emits **raw logits and not a sigmoid**. A graph with a
baked-in sigmoid makes `radiologyModel.ts` sigmoid twice and collapses every
probability toward 0.5 while still looking "trained". The script fails loudly
instead.

**Step 5. Evaluate.**

```bash
python training/evaluate_radiology.py
```

Per-class AUC/AP/sensitivity, ECE, Brier, subgroup AUC by sex and age band, and
an **ONNX parity check on real radiographs** — the end-to-end proof that the
artefact you deploy matches the model you trained.

**Step 6. Explainability.**

```bash
python training/gradcam.py --image path/to/cxr.png --all-flagged
```

Writes original | heatmap | overlay side by side. This is the single most
persuasive thing you can put in front of a reviewer.

**Step 7. Deploy.** Update `server/models/radiologyModel.ts`:
`MODEL_URL`, `PATHOLOGY_LABELS` (14 entries, in the order `labels.py` defines),
`MODEL_METADATA`, and the threshold constant. Then update the
`PathologyClassResult['label']` union in `src/types/clinical.ts` to match, delete
`.model_cache/`, and run `npx tsc --noEmit`.

> ⚠ The label list is a **cross-language contract**. A mismatch does not crash —
> it silently maps sigmoid scores to the wrong disease names. Change both sides
> in one commit.

---

## M2 — Retriever

**Step 1. Build the corpus.**

```bash
python training/ingest_guidelines.py --dir training/data/raw/guidelines --source "NICE"
```

Sentence-aware chunking with metadata (`section`, `page_start`, `page_end`) so the
Doctor agent can cite an auditable location instead of a blob. Check each
publisher's reuse terms — the output is gitignored for that reason.

**Step 2. Measure the baseline before training anything.**

```bash
python training/build_retrieval_pairs.py --strategy template
python training/train_retriever.py --baseline-only
```

You now have a real Recall@k to beat, rather than an assumption.

**Step 3. Train.**

```bash
python training/train_retriever.py
```

Round 1 uses in-batch negatives; round 2 mines hard negatives (similarity
0.60–0.90) and retrains. Writes the ablation table to
`training/out/retriever_ablation.json`.

**Step 4. Export.**

```bash
python training/export_retriever_onnx.py --build-embeddings --verify
```

Builds `embeddings.f16.bin` (L2-normalised float16, so the Node side only needs a
dot product) and checks that ONNX mean-pooling respects the attention mask — the
most common silent failure.

Then keep `searchClinicalGuidelines(ai, query, topK)`'s signature so all three
call sites in `server/api.ts` keep working unchanged. Decide one query-encoding
path and document it: either add `@huggingface/transformers` to `package.json`, or
keep a small Python sidecar for embedding only.

---

## M3 — Lab-report OCR extractor

```bash
python training/train_lab_ner.py --generate-only --count 4000   # inspect a few lines first
python training/train_lab_ner.py
python training/train_lab_ner.py --eval-jsonl training/data/raw/lab_real_eval.jsonl
```

Synthetic reports are rendered from the analyte reference table, so ground truth
is exact and free. **Report the real-set F1, not the synthetic one** — the gap
between them is itself a finding, and synthetic layouts are far cleaner than a
photographed report.

---

## M5 — Confidence calibration

```bash
python training/train_calibrator.py --print-schema    # expected input format
python training/train_calibrator.py --pillar-demo     # deterministic pillar arithmetic
python training/train_calibrator.py --cases training/data/mimic/labelled_cases.jsonl
```

Trains a calibrated `P(top-1 diagnosis correct)` and an independent urgency
classifier, and prints the reliability table next to the current prompted
heuristic so the improvement is measurable rather than asserted.

---

## Honest notes for the review

1. **M4.5 is not a substitute for M1/M2.** Fine-tuning a local 7–8B model will not
   beat Gemini on open-ended clinical reasoning, and claiming otherwise is not
   credible. What guided decoding *does* buy you — guaranteed schema-valid JSON —
   is worth more than the fine-tune and needs no GPU. Do that regardless.

2. **Every synthetic number must be labelled synthetic.** In M2 the training
   queries are generated from the chunks; in M3 the reports are generated from the
   reference table. Both are legitimate, and both must be reported as such
   alongside a real held-out evaluation.

3. **The preprocessing contract is not cosmetic.** `dataset.py` deliberately uses
   a non-uniform resize to match `sharp(..., { fit: 'fill' })` in
   `radiologyModel.ts`. Train/serve geometry mismatch is a real accuracy leak that
   produces no error message.

4. **Nothing here ships a model by itself.** Each script produces artefacts and
   prints the exact TypeScript changes required. The pipeline is already
   label-agnostic in `radiologist.ts` and `doctor.ts`, so M1 integration is a
   ~30-line diff — but it is still a diff you must make.
