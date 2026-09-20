"""
M1 - Fit per-class decision thresholds and calibrate probabilities.

Usage
-----
    python training/calibrate_thresholds.py
    python training/calibrate_thresholds.py --target-sensitivity 0.92
    python training/calibrate_thresholds.py --split val      # default
    python training/calibrate_thresholds.py --split test     # final reported numbers

Outputs
-------
    training/out/thresholds.json          per-class threshold + achieved sensitivity/specificity
    training/out/reliability_{split}.csv  reliability-curve data for the report diagram
    training/out/calibration_report.txt   ECE/Brier before and after isotonic calibration

Why this matters
----------------
server/models/radiologyModel.ts currently hardcodes:

    const flaggedPositive = probability > 0.5;

0.5 is an arbitrary, clinically meaningless operating point. For triage you want
HIGH SENSITIVITY on the dangerous findings - a missed pneumothorax or effusion is
far worse than a false alarm that a clinician then dismisses. This script picks,
per class, the threshold that achieves a target sensitivity on held-out data, and
reports the specificity you pay for it.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys

import numpy as np
import torch
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import roc_curve

from mediagent_training.config import (
    OUT_DIR,
    RADIOLOGY_CHECKPOINT,
    TARGET_SENSITIVITY,
)
from mediagent_training.dataset import build_dataloaders, load_nih_dataframe
from mediagent_training.labels import NIH_CHESTXRAY14_LABELS, NUM_LABELS
from mediagent_training.metrics import (
    expected_calibration_error,
    mean_brier_score,
    reliability_curve,
)
from mediagent_training.model import build_model

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("calibrate")


@torch.no_grad()
def collect_probabilities(loader, device) -> tuple[np.ndarray, np.ndarray]:
    """Return (targets, probabilities) for a loader."""
    all_targets, all_probs = [], []
    for images, targets, _ in loader:
        images = images.to(device, non_blocking=True)
        logits = model_forward(images)
        all_targets.append(targets.numpy())
        all_probs.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(all_targets, axis=0), np.concatenate(all_probs, axis=0)


# Set by main() before collect_probabilities is used. Module-level forward makes
# the torch.no_grad decorator above work without threading the model through.
_model = None


def model_forward(images: torch.Tensor) -> torch.Tensor:
    if _model is None:
        raise RuntimeError("Model not initialised - call main()")
    return _model(images.float())


def fit_threshold_for_class(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    target_sensitivity: float,
) -> tuple[float, float, float]:
    """
    Pick the threshold achieving at least `target_sensitivity`.

    Returns (threshold, achieved_sensitivity, achieved_specificity).

    Walks the ROC curve and selects the operating point with the HIGHEST
    specificity among those meeting the sensitivity target - i.e. the fewest
    false positives for the sensitivity you demanded.
    """
    if len(np.unique(y_true)) < 2:
        # Degenerate class in this split; fall back to the generic 0.5.
        return 0.5, float("nan"), float("nan")

    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    specificity = 1.0 - fpr

    # finite thresholds only (roc_curve prepends inf)
    finite = np.isfinite(thresholds)
    tpr, specificity, thresholds = tpr[finite], specificity[finite], thresholds[finite]

    meets = tpr >= target_sensitivity
    if not np.any(meets):
        # The model cannot reach the requested sensitivity on this split at any
        # threshold. Take the best sensitivity available and say so.
        best_idx = int(np.argmax(tpr))
        logger.warning(
            "  target sensitivity %.2f unreachable (max %.3f); using the best available point.",
            target_sensitivity, float(tpr[best_idx]),
        )
        return (
            float(thresholds[best_idx]),
            float(tpr[best_idx]),
            float(specificity[best_idx]),
        )

    # Among those meeting the target, prefer the highest specificity.
    candidates = np.where(meets)[0]
    best = candidates[int(np.argmax(specificity[candidates]))]
    return float(thresholds[best]), float(tpr[best]), float(specificity[best])


def main() -> int:
    global _model

    parser = argparse.ArgumentParser(description="Fit per-class thresholds and calibrate the M1 model")
    parser.add_argument("--target-sensitivity", type=float, default=TARGET_SENSITIVITY)
    parser.add_argument("--split", choices=["val", "test"], default="val",
                        help="Fit on 'val'; report on 'test'.")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=4)
    args = parser.parse_args()

    if not RADIOLOGY_CHECKPOINT.exists():
        logger.error("No checkpoint at %s. Train first.", RADIOLOGY_CHECKPOINT)
        return 1

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    checkpoint = torch.load(RADIOLOGY_CHECKPOINT, map_location=device, weights_only=False)
    _model = build_model(num_labels=NUM_LABELS, init="scratch", verbose=False).to(device)
    _model.load_state_dict(checkpoint["model_state_dict"])
    _model.eval()
    logger.info("Loaded checkpoint (epoch %s, mean val AUC %.4f)",
                checkpoint.get("epoch"), float(checkpoint.get("mean_val_auc", float("nan"))))

    df = load_nih_dataframe()
    loaders = build_dataloaders(df, batch_size=args.batch_size, num_workers=args.num_workers)
    if args.split not in loaders:
        logger.error("Split %r not available. Available: %s", args.split, sorted(loaders))
        return 1

    targets, probs = collect_probabilities(loaders[args.split], device)
    logger.info("Evaluating on the %s split: %d images", args.split, len(targets))

    # ---- uncalibrated metrics --------------------------------------------
    ece_before = expected_calibration_error(targets, probs)
    brier_before = mean_brier_score(targets, probs)

    # ---- per-class isotonic calibration ----------------------------------
    # Isotonic regression is used rather than Platt scaling because chest X-ray
    # probabilities are typically over-confident in a non-sigmoidal way on the
    # rare classes. Isotonic is monotone and non-parametric; the cost is that it
    # needs a reasonable number of positives to be stable, which is why the
    # validation split (not the test split) is used to fit it.
    probs_calibrated = probs.copy()
    calibrators: dict[str, dict] = {}
    for i, name in enumerate(NIH_CHESTXRAY14_LABELS):
        y = targets[:, i]
        if len(np.unique(y)) < 2 or int(y.sum()) < 10:
            calibrators[name] = {"fitted": False, "reason": "insufficient positives"}
            continue
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
        iso.fit(probs[:, i], y)
        probs_calibrated[:, i] = iso.predict(probs[:, i])
        calibrators[name] = {"fitted": True}

    ece_after = expected_calibration_error(targets, probs_calibrated)
    brier_after = mean_brier_score(targets, probs_calibrated)

    # ---- thresholds -------------------------------------------------------
    thresholds: dict[str, dict] = {}
    print()
    print(f"Per-class thresholds at target sensitivity {args.target_sensitivity:.2f}")
    print("-" * 78)
    print(f"{'Label':<22}{'thresh':>9}{'sens':>9}{'spec':>9}{'pos@t':>9}{'pos@0.5':>10}")
    print("-" * 78)

    for i, name in enumerate(NIH_CHESTXRAY14_LABELS):
        thresh, sens, spec = fit_threshold_for_class(
            targets[:, i], probs_calibrated[:, i], args.target_sensitivity
        )
        flagged_at_t = int(np.sum(probs_calibrated[:, i] > thresh))
        flagged_at_half = int(np.sum(probs_calibrated[:, i] > 0.5))

        thresholds[name] = {
            "threshold": round(thresh, 4),
            "achieved_sensitivity": None if not np.isfinite(sens) else round(sens, 4),
            "achieved_specificity": None if not np.isfinite(spec) else round(spec, 4),
            "flagged_at_threshold": flagged_at_t,
            "flagged_at_0_5": flagged_at_half,
            "positives_in_split": int(targets[:, i].sum()),
        }

        print(f"{name:<22}{thresh:>9.3f}{sens:>9.3f}{spec:>9.3f}{flagged_at_t:>9}{flagged_at_half:>10}")

    print("-" * 78)
    print()
    print("Calibration")
    print("-" * 78)
    print(f"  ECE   before isotonic : {ece_before:.4f}")
    print(f"  ECE   after  isotonic : {ece_after:.4f}")
    print(f"  Brier before          : {brier_before:.4f}")
    print(f"  Brier after           : {brier_after:.4f}")
    print("-" * 78)

    # ---- write artefacts --------------------------------------------------
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    thresholds_doc = {
        "split": args.split,
        "target_sensitivity": args.target_sensitivity,
        "note": (
            "Port these into server/models/radiologyModel.ts, replacing the "
            "hardcoded 'probability > 0.5'. Keep them in the same order as "
            "PATHOLOGY_LABELS."
        ),
        "thresholds": thresholds,
        "calibration": {
            "effective_probabilities_are_isotonic_calibrated": True,
            "ece_before": None if not np.isfinite(ece_before) else round(float(ece_before), 4),
            "ece_after": None if not np.isfinite(ece_after) else round(float(ece_after), 4),
            "brier_before": None if not np.isfinite(brier_before) else round(float(brier_before), 4),
            "brier_after": None if not np.isfinite(brier_after) else round(float(brier_after), 4),
        },
        "per_class_calibrators": calibrators,
    }
    (OUT_DIR / "thresholds.json").write_text(json.dumps(thresholds_doc, indent=2), encoding="utf-8")
    logger.info("Wrote %s", OUT_DIR / "thresholds.json")

    # Reliability curve data (calibrated), for the report diagram.
    mean_pred, frac_pos, counts = reliability_curve(targets, probs_calibrated, n_bins=15)
    csv_path = OUT_DIR / f"reliability_{args.split}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["bin_mean_predicted", "bin_fraction_positive", "count"])
        for mp, fp, ct in zip(mean_pred, frac_pos, counts):
            writer.writerow([mp, fp, ct])
    logger.info("Wrote %s", csv_path)

    # Text report
    report_lines = [
        f"Calibration and threshold report ({args.split} split)",
        "=" * 78,
        f"Target sensitivity : {args.target_sensitivity}",
        f"ECE  before/after  : {ece_before:.4f} / {ece_after:.4f}",
        f"Brier before/after : {brier_before:.4f} / {brier_after:.4f}",
        "",
        "Per-class thresholds:",
    ]
    for name in NIH_CHESTXRAY14_LABELS:
        entry = thresholds[name]
        report_lines.append(
            f"  {name:<22} t={entry['threshold']:.3f}  "
            f"sens={entry['achieved_sensitivity']}  spec={entry['achieved_specificity']}"
        )
    (OUT_DIR / "calibration_report.txt").write_text("\n".join(report_lines), encoding="utf-8")

    logger.info("Next: python training/export_radiology_onnx.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
