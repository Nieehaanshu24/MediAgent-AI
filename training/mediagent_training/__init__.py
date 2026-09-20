"""
MediAgent AI — model training package.

Modules
-------
labels      Canonical 14-label set and the cross-language ONNX export contract.
config      Paths and hyperparameters.
model       DenseNet-121 multi-label builder (logits-only, TS-contract safe).
dataset     NIH ChestX-ray14 loader with patient-level split and deployment-
            matched preprocessing.
metrics     Per-class AUC / AP / sensitivity@specificity / ECE / Brier.

The training scripts that USE these modules live one level up, in
training/*.py, so they can be run directly:

    python training/train_radiology.py
"""

from .labels import (  # noqa: F401
    DEFAULT_THRESHOLDS,
    IMAGENET_MEAN,
    IMAGENET_STD,
    LEGACY_LABELS,
    NIH_CHESTXRAY14_LABELS,
    NUM_LABELS,
    ONNX_INPUT_NAME,
    ONNX_INPUT_SIZE,
    ONNX_OUTPUT_IS_LOGITS,
    ONNX_OUTPUT_NAME,
    TARGET_SENSITIVITY,
    derive_no_finding,
    label_index,
)

__all__ = [
    "DEFAULT_THRESHOLDS",
    "IMAGENET_MEAN",
    "IMAGENET_STD",
    "LEGACY_LABELS",
    "NIH_CHESTXRAY14_LABELS",
    "NUM_LABELS",
    "ONNX_INPUT_NAME",
    "ONNX_INPUT_SIZE",
    "ONNX_OUTPUT_IS_LOGITS",
    "ONNX_OUTPUT_NAME",
    "TARGET_SENSITIVITY",
    "derive_no_finding",
    "label_index",
]
