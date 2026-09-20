"""
Central configuration for MediAgent model training.

Every path is relative to the repository root so scripts work regardless of the
directory you invoke them from. Override any value with an environment variable
where noted.
"""

from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# training/mediagent_training/config.py -> parents[2] is the repo root.
REPO_ROOT: Path = Path(__file__).resolve().parents[2]
TRAINING_ROOT: Path = REPO_ROOT / "training"

DATA_DIR: Path = TRAINING_ROOT / "data"
RAW_DATA_DIR: Path = DATA_DIR / "raw"
NIH_DIR: Path = DATA_DIR / "nih"
CORPUS_DIR: Path = DATA_DIR / "corpus"
MIMIC_DIR: Path = DATA_DIR / "mimic"

OUT_DIR: Path = TRAINING_ROOT / "out"
CHECKPOINT_DIR: Path = TRAINING_ROOT / "checkpoints"
EXPORT_DIR: Path = TRAINING_ROOT / "exports"
RUNS_DIR: Path = TRAINING_ROOT / "runs"

for _d in (
    DATA_DIR, RAW_DATA_DIR, NIH_DIR, CORPUS_DIR, MIMIC_DIR,
    OUT_DIR, CHECKPOINT_DIR, EXPORT_DIR, RUNS_DIR,
):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# NIH ChestX-ray14
# ---------------------------------------------------------------------------
# The official CSVs, distributed by the NIH with the image archives.
NIH_ENTRY_CSV: Path = NIH_DIR / "Data_Entry_2017.csv"
NIH_TRAINVAL_LIST: Path = NIH_DIR / "train_val_list.txt"
NIH_TEST_LIST: Path = NIH_DIR / "test_list.txt"
# Extracted PNG/JPG images
NIH_IMAGES_DIR: Path = NIH_DIR / "images"

# The official lists already partition by PATIENT, which is what prevents the
# leakage that inflates most coursework results. Use them; do not re-split
# randomly. Validate with data/verify_patient_split.py.
USE_OFFICIAL_SPLIT: bool = True
# Fraction of train_val carved out for validation + threshold fitting when the
# official split is used (the official split has no val set of its own).
VAL_FRACTION: float = 0.15

# ---------------------------------------------------------------------------
# M1 — radiology classifier hyperparameters
# ---------------------------------------------------------------------------
SEED: int = 42

IMAGE_SIZE_TRAIN: int = 320       # train at 320, evaluate/export at 224
IMAGE_SIZE_EVAL: int = 224

BATCH_SIZE: int = 64
NUM_EPOCHS: int = 30              # 25-40 is the useful range
LEARNING_RATE: float = 1e-4
WEIGHT_DECAY: float = 1e-5
WARMUP_EPOCHS: int = 1
NUM_WORKERS: int = int(os.environ.get("MEDIAGENT_NUM_WORKERS", "4"))

# Early stopping on mean validation AUC.
EARLY_STOP_PATIENCE: int = 6
EARLY_STOP_MIN_DELTA: float = 0.001

# Loss
USE_FOCAL_LOSS: bool = False      # start with BCEWithLogitsLoss + pos_weight
FOCAL_GAMMA: float = 2.0
FOCAL_ALPHA: float = 0.25

# Mixed precision. Set False on CPU-only machines.
USE_AMP: bool = True

# Where the trained checkpoint lands before ONNX export.
RADIOLOGY_CHECKPOINT: Path = CHECKPOINT_DIR / "radiology_densenet121_best.pt"

# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
ONNX_OPSET: int = 17
EXPORTED_ONNX: Path = EXPORT_DIR / "mediagent_radiology_densenet121.onnx"
# Hugging Face repo that server/models/radiologyModel.ts downloads from.
HF_REPO_ID: str = "nieehaanshu/mediagent-radiology-densenet121"
HF_ONNX_FILENAME: str = "mediagent_radiology_densenet121.onnx"

# ---------------------------------------------------------------------------
# M2 — retriever (bi-encoder) hyperparameters
# ---------------------------------------------------------------------------
RETRIEVER_BASE_MODEL: str = "pritamdeka/S-PubMedBert-MS-MARCO"
RETRIEVER_OUTPUT_DIR: Path = EXPORT_DIR / "mediagent-retriever"

CHUNK_TOKENS: int = 512
CHUNK_OVERLAP_TOKENS: int = 75
RETRIEVER_BATCH_SIZE: int = 32
RETRIEVER_EPOCHS: int = 3
RETRIEVER_LR: float = 2e-5
EMBEDDING_DIM: int = 768          # S-PubMedBert hidden size

# Reranker (cross-encoder) applied over the top-N dense results.
RERANKER_MODEL: str = "BAAI/bge-reranker-base"
RERANK_TOP_N: int = 50
FINAL_TOP_K: int = 4              # what gets handed to the Doctor agent

# Hybrid retrieval: fuse dense and BM25 ranks with Reciprocal Rank Fusion.
RRF_K: int = 60

# ---------------------------------------------------------------------------
# M3 — lab report OCR / NER
# ---------------------------------------------------------------------------
LAB_NER_BASE_MODEL: str = "dmis-lab/biobert-base-cased-v1.2"
LAB_NER_OUTPUT_DIR: Path = EXPORT_DIR / "lab-ner"
LAB_NER_EPOCHS: int = 10
LAB_NER_LR: float = 2e-5
LAB_NER_MAX_LEN: int = 256

# ---------------------------------------------------------------------------
# M5 — confidence calibration
# ---------------------------------------------------------------------------
CALIBRATION_MODEL_PATH: Path = EXPORT_DIR / "confidence_calibrator.joblib"
URGENCY_MODEL_PATH: Path = EXPORT_DIR / "urgency_classifier.joblib"

# Pillar weights for the deterministic ConfidencePillarScore. These MUST match
# the weights used in server/agents/doctor.ts when you port them.
PILLAR_MAX_WEIGHTS: dict[str, int] = {
    "interview": 25,
    "radiology": 30,
    "lab": 30,
    "guideline": 15,
}
