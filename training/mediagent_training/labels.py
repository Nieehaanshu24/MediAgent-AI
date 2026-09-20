"""
Canonical label set and export contract for the MediAgent radiology classifier.

IMPORTANT — THIS MODULE IS A CROSS-LANGUAGE CONTRACT
----------------------------------------------------
Everything in here is mirrored by `server/models/radiologyModel.ts` on the
TypeScript side. If you change a label, a normalisation constant, a tensor
name, or the input size, you MUST change it in BOTH places in the same commit.
A silent mismatch maps sigmoid scores to the wrong disease names, which is the
single most dangerous bug this project can ship.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# 1. Canonical label order (NIH ChestX-ray14 — the official 14)
# ---------------------------------------------------------------------------
# This exact order defines the output-vector index mapping. It must match
# PATHOLOGY_LABELS in server/models/radiologyModel.ts after the M1 upgrade.
NIH_CHESTXRAY14_LABELS: tuple[str, ...] = (
    "Atelectasis",          # 0
    "Cardiomegaly",         # 1
    "Effusion",             # 2
    "Infiltration",         # 3  <- the NIH name; see NAMING NOTE below
    "Mass",                 # 4
    "Nodule",               # 5
    "Pneumonia",            # 6
    "Pneumothorax",         # 7
    "Consolidation",        # 8
    "Edema",                # 9
    "Emphysema",            # 10
    "Fibrosis",             # 11
    "Pleural_Thickening",   # 12
    "Hernia",               # 13
)

NUM_LABELS: int = len(NIH_CHESTXRAY14_LABELS)

# NAMING NOTE
# -----------
# The *currently deployed* ONNX model exposes 5 classes including a class
# literally named "Consolidation" and a class named "No Finding":
#
#   LEGACY_LABELS = ('No Finding', 'Cardiomegaly', 'Consolidation', 'Edema', 'Pneumothorax')
#
# ChestX-ray14 does NOT contain a "Consolidation" label — it has both
# "Infiltration" and "Consolidation" as separate findings, and "No Finding"
# is not a column at all (it is the row-level state of all-14-negative).
# Whoever trained the first model conflated these. Do not repeat it.
LEGACY_LABELS: tuple[str, ...] = (
    "No Finding",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Pneumothorax",
)

# ---------------------------------------------------------------------------
# 2. ONNX export contract — MUST match server/models/radiologyModel.ts
# ---------------------------------------------------------------------------
ONNX_INPUT_NAME: str = "radiograph_input"
ONNX_OUTPUT_NAME: str = "pathology_probabilities"

# Shape: (batch, channels, height, width), NCHW
ONNX_INPUT_CHANNELS: int = 3
ONNX_INPUT_SIZE: int = 224

# ImageNet normalisation. server/models/radiologyModel.ts hardcodes these,
# in this order, applied as (pixel/255 - mean) / std, planar NCHW.
IMAGENET_MEAN: tuple[float, float, float] = (0.485, 0.456, 0.406)
IMAGENET_STD: tuple[float, float, float] = (0.229, 0.224, 0.225)

# The graph must emit RAW LOGITS, not sigmoid probabilities. The TypeScript
# side applies sigmoid itself. Exporting a graph that already contains a
# sigmoid produces a double-sigmoid, which collapses every probability toward
# 0.5 and silently destroys the model's usefulness.
ONNX_OUTPUT_IS_LOGITS: bool = True

# ---------------------------------------------------------------------------
# 3. Deployed threshold policy
# ---------------------------------------------------------------------------
# The deployed code currently hardcodes `flaggedPositive = probability > 0.5`.
# That is wrong for triage: for Pneumothorax you want high sensitivity, which
# means a LOW threshold. `train/calibrate_thresholds.py` fits these on a
# held-out validation split and writes training/out/thresholds.json, which
# should then be ported into the TypeScript constant.
#
# These are sane starting points based on the clinical cost of a miss; they
# are REPLACED by the calibrated values.
DEFAULT_THRESHOLDS: dict[str, float] = {
    "Atelectasis": 0.45,
    "Cardiomegaly": 0.50,
    "Effusion": 0.45,
    "Infiltration": 0.55,
    "Mass": 0.40,
    "Nodule": 0.40,
    "Pneumonia": 0.45,
    "Pneumothorax": 0.30,        # never miss a pneumothorax
    "Consolidation": 0.45,
    "Edema": 0.45,
    "Emphysema": 0.50,
    "Fibrosis": 0.55,
    "Pleural_Thickening": 0.55,
    "Hernia": 0.35,
}

# Target sensitivity used when fitting calibrated thresholds. Higher = fewer
# misses, more false positives. Triage favours sensitivity.
TARGET_SENSITIVITY: float = 0.90


def label_index(label: str) -> int:
    """Return the output-vector index for a label, or raise with a clear message."""
    try:
        return NIH_CHESTXRAY14_LABELS.index(label)
    except ValueError as exc:
        raise KeyError(
            f"Unknown label {label!r}. Valid labels: {list(NIH_CHESTXRAY14_LABELS)}"
        ) from exc


def derive_no_finding(binary_vector) -> bool:
    """
    'No Finding' is not a ChestX-ray14 column — it is the derived state of a
    radiograph where all 14 findings are negative. Kept as a helper because the
    UI still displays the concept.
    """
    return not any(int(v) for v in binary_vector)
